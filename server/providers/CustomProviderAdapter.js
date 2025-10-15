const axios = require('axios').default
const Database = require('../Database')
const Logger = require('../Logger')
const htmlSanitizer = require('../utils/htmlSanitizer')

class CustomProviderAdapter {
  #responseTimeout = 10000

  constructor() {}

  /**
   *
   * @param {string} title
   * @param {string} author
   * @param {string} isbn
   * @param {string} providerSlug
   * @param {string} mediaType
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  async search(title, author, isbn, providerSlug, mediaType, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    const providerId = providerSlug.split('custom-')[1]
    const provider = await Database.customMetadataProviderModel.findByPk(providerId)

    if (!provider) {
      throw new Error('Custom provider not found for the given id')
    }

    // Setup query params
    const queryObj = {
      mediaType,
      query: title
    }
    if (author) {
      queryObj.author = author
    }
    if (isbn) {
      queryObj.isbn = isbn
    }
    const queryString = new URLSearchParams(queryObj).toString()

    const url = `${provider.url}/search?${queryString}`
    Logger.debug(`[CustomMetadataProvider] Search url: ${url}`)

    // Setup headers
    const axiosOptions = {
      timeout
    }
    if (provider.authHeaderValue) {
      axiosOptions.headers = {
        Authorization: provider.authHeaderValue
      }
    }

    const matches = await axios
      .get(url, axiosOptions)
      .then((res) => {
        if (!res?.data || !Array.isArray(res.data.matches)) return null
        return res.data.matches
      })
      .catch((error) => {
        Logger.error('[CustomMetadataProvider] Search error', error.message)
        return []
      })

    if (!matches) {
      throw new Error('Custom provider returned malformed response')
    }

    const toStringOrUndefined = (value) => {
      if (typeof value === 'string' || typeof value === 'number') return String(value)
      if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) return value.join(',')
      return undefined
    }
    const validateSeriesArray = (series) => {
      if (!Array.isArray(series) || !series.length) return undefined
      return series
        .map((s) => {
          if (!s?.series || typeof s.series !== 'string') return undefined
          const _series = {
            series: s.series
          }
          if (s.sequence && (typeof s.sequence === 'string' || typeof s.sequence === 'number')) {
            _series.sequence = String(s.sequence)
          }
          return _series
        })
        .filter((s) => s !== undefined)
    }

    // re-map keys to throw out
    return matches.map((match) => {
      const { title, subtitle, author, narrator, publisher, publishedYear, description, cover, isbn, asin, genres, tags, series, language, duration } = match

      const payload = {
        title: toStringOrUndefined(title),
        subtitle: toStringOrUndefined(subtitle),
        author: toStringOrUndefined(author),
        narrator: toStringOrUndefined(narrator),
        publisher: toStringOrUndefined(publisher),
        publishedYear: toStringOrUndefined(publishedYear),
        description: description && typeof description === 'string' ? htmlSanitizer.sanitize(description) : undefined,
        cover: toStringOrUndefined(cover),
        isbn: toStringOrUndefined(isbn),
        asin: toStringOrUndefined(asin),
        genres: Array.isArray(genres) && genres.every((g) => typeof g === 'string') ? genres : undefined,
        tags: toStringOrUndefined(tags),
        series: validateSeriesArray(series),
        language: toStringOrUndefined(language),
        duration: !isNaN(duration) && duration !== null ? Number(duration) : undefined
      }

      // Remove undefined values
      for (const key in payload) {
        if (payload[key] === undefined) {
          delete payload[key]
        }
      }

      return payload
    })
  }
}

module.exports = CustomProviderAdapter
