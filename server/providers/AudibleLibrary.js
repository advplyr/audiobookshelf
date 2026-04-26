const axios = require('axios').default
const Logger = require('../Logger')

const REGION_DOMAINS = {
  us: 'com',
  ca: 'ca',
  uk: 'co.uk',
  au: 'com.au',
  fr: 'fr',
  de: 'de',
  jp: 'co.jp',
  it: 'it',
  in: 'in',
  es: 'es'
}

const ALLOWED_REGIONS = new Set(Object.keys(REGION_DOMAINS))

class AudibleLibrary {
  #timeout = 15000

  /**
   * @param {string} region
   * @returns {string}
   */
  getApiBaseUrl(region) {
    const domain = REGION_DOMAINS[region] || 'com'
    return `https://api.audible.${domain}`
  }

  /**
   * Build auth headers.
   *
   * @param {string} accessToken
   * @returns {Object}
   */
  authHeaders(accessToken) {
    return {
      Authorization: `Bearer ${accessToken}`,
      'x-amz-access-token': accessToken,
      'User-Agent': 'Audible/671 CFNetwork/1240.0.4 Darwin/20.6.0'
    }
  }

  /**
   * Refresh an expired access token using the stored refresh token.
   *
   * @param {string} refreshToken
   * @returns {Promise<{accessToken: string, expiresIn: number}|null>}
   */
  async refreshAccessToken(refreshToken) {
    try {
      const params = new URLSearchParams({
        app_name: 'Audible',
        app_version: '3.56.2',
        source_token: refreshToken,
        requested_token_type: 'access_token',
        source_token_type: 'refresh_token'
      })

      const response = await axios.post('https://api.amazon.com/auth/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.#timeout
      })

      const accessToken = response.data?.access_token
      if (!accessToken) {
        Logger.error('[AudibleLibrary] Refresh response missing access_token')
        return null
      }

      return {
        accessToken,
        expiresIn: response.data.expires_in || 3600
      }
    } catch (err) {
      Logger.error('[AudibleLibrary] Failed to refresh access token', err.message, JSON.stringify(err.response?.data || ''))
      return null
    }
  }

  /**
   * Fetch preorders via the Audible orders API (/1.0/orders).
   *
   * Steps:
   *  1. Fetch all orders (the endpoint returns everything in one response).
   *  2. Collect ASINs where is_preorder=true.
   *  3. Fetch catalog details for each ASIN individually.
   *  4. Filter to products with a future release_date.
   *
   * @param {string} accessToken
   * @param {string} region
   * @returns {Promise<Object[]>} catalog product objects ready for mapItem()
   */
  async fetchPreordersFromOrders(accessToken, region = 'us') {
    const baseUrl = this.getApiBaseUrl(region)

    let ordersResponse
    try {
      ordersResponse = await axios.get(`${baseUrl}/1.0/orders`, {
        params: { num_results: 999, sort_by: '-PurchaseDate' },
        headers: this.authHeaders(accessToken),
        timeout: this.#timeout
      })
    } catch (err) {
      const status = err.response?.status
      if (status === 401 || status === 403) throw new Error('UNAUTHORIZED')
      Logger.error('[AudibleLibrary] fetchPreordersFromOrders failed', err.message, JSON.stringify(err.response?.data || ''))
      throw err
    }

    const orders = ordersResponse.data?.orders || []
    Logger.info(`[AudibleLibrary] Orders API returned ${orders.length} order(s)`)

    // Warn if the response may be truncated (some API versions include pagination metadata)
    if (ordersResponse.data?.has_more || ordersResponse.data?.next_token) {
      Logger.warn('[AudibleLibrary] Orders response indicates more pages exist — some preorders may be missed. Consider implementing pagination.')
    }

    const preorderAsins = []
    for (const order of orders) {
      for (const item of order.items || []) {
        if (item.is_preorder === true && item.asin) {
          preorderAsins.push(item.asin)
        }
      }
    }

    Logger.info(`[AudibleLibrary] Found ${preorderAsins.length} historical preorder ASIN(s)`)

    if (!preorderAsins.length) return []

    const allProducts = []
    const results = await Promise.allSettled(
      preorderAsins.map(async (asin) => {
        const resp = await axios.get(`${baseUrl}/1.0/catalog/products/${asin}`, {
          params: { response_groups: 'product_attrs,product_details,media,series,contributors', image_sizes: '500' },
          headers: this.authHeaders(accessToken),
          timeout: this.#timeout
        })
        const product = resp.data?.product
        // Require asin and title — title is NOT NULL in the DB schema
        if (product?.asin && product?.title) return product
        return null
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        allProducts.push(result.value)
      } else if (result.status === 'rejected') {
        const status = result.reason?.response?.status
        if (status === 401 || status === 403) throw new Error('UNAUTHORIZED')
        Logger.warn(`[AudibleLibrary] Catalog fetch failed for one ASIN`, result.reason?.message)
      }
    }

    const now = new Date()
    const upcoming = allProducts.filter((p) => {
      const dateStr = p.release_date || p.publication_datetime || p.product_site_launch_date
      if (!dateStr) return false
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return false
      return d > now
    })

    Logger.info(`[AudibleLibrary] ${upcoming.length} upcoming preorder(s) (of ${allProducts.length} ever preordered)`)
    return upcoming
  }

  /**
   * Map a raw Audible catalog product to our AudibleBook fields.
   * Uses the same date field priority as the upcoming-filter above.
   *
   * @param {Object} item
   * @returns {Object}
   */
  mapItem(item) {
    const authors = (item.authors || []).map((a) => a.name).filter(Boolean)
    const narrators = (item.narrators || []).map((n) => n.name).filter(Boolean)

    let seriesName = null
    let seriesPosition = null
    const series = item.series || []
    if (series.length > 0) {
      seriesName = series[0].title || series[0].asin || null
      seriesPosition = series[0].sequence || null
    }

    // Pick the best available cover image size (prefer 500, then descend)
    let coverUrl = null
    const images = item.product_images || {}
    const preferredSizes = ['500', '1215', '1024', '730', '408', '360', '300', '252', '200']
    for (const size of preferredSizes) {
      if (images[size]) { coverUrl = images[size]; break }
    }
    if (!coverUrl) {
      const available = Object.keys(images).sort((a, b) => Number(b) - Number(a))
      if (available.length) coverUrl = images[available[0]]
    }

    return {
      asin: item.asin,
      title: item.title,
      subtitle: item.subtitle || null,
      authors,
      narrators,
      seriesName,
      seriesPosition,
      releaseDate: item.release_date || item.publication_datetime || item.product_site_launch_date || null,
      coverUrl,
      publisherName: item.publisher_name || null,
      summary: item.merchandising_summary || item.publisher_summary || null,
      runtimeLengthMin: item.runtime_length_min || null,
      status: 'preorder',
      lastChecked: new Date()
    }
  }

  /**
   * Returns the set of valid region codes.
   * @returns {Set<string>}
   */
  get allowedRegions() {
    return ALLOWED_REGIONS
  }
}

module.exports = new AudibleLibrary()
