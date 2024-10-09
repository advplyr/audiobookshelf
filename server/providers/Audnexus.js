const axios = require('axios').default
const Throttle = require('p-throttle')
const Logger = require('../Logger')
const { levenshteinDistance } = require('../utils/index')
const { isValidASIN } = require('../utils/index')

/**
 * @typedef AuthorSearchObj
 * @property {string} asin
 * @property {string} description
 * @property {string} image
 * @property {string} name
 */

class Audnexus {
  static _instance = null

  constructor() {
    // ensures Audnexus class is singleton
    if (Audnexus._instance) {
      return Audnexus._instance
    }

    this.baseUrl = 'https://api.audnex.us'

    // Rate limit is 100 requests per minute.
    // @see https://github.com/laxamentumtech/audnexus#-deployment-
    this.limiter = Throttle({
      // Setting the limit to 1 allows for a short pause between requests that is imperceptible to the end user.
      // A larger limit will grab blocks faster and then wait for the alloted time(interval) before
      // fetching another batch, but with a discernable pause from the user perspective.
      limit: 1,
      strict: true,
      interval: 150
    })

    Audnexus._instance = this
  }

  /**
   *
   * @param {string} name
   * @param {string} region
   * @returns {Promise<{asin:string, name:string}[]>}
   */
  authorASINsRequest(name, region) {
    const searchParams = new URLSearchParams()
    searchParams.set('name', name)

    if (region) searchParams.set('region', region)

    const authorRequestUrl = `${this.baseUrl}/authors?${searchParams.toString()}`
    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    return this._processRequest(this.limiter(() => axios.get(authorRequestUrl)))
      .then((res) => res.data || [])
      .catch((error) => {
        Logger.error(`[Audnexus] Author ASIN request failed for ${name}`, error)
        return []
      })
  }

  /**
   *
   * @param {string} asin
   * @param {string} region
   * @returns {Promise<AuthorSearchObj>}
   */
  authorRequest(asin, region) {
    if (!isValidASIN(asin?.toUpperCase?.())) {
      Logger.error(`[Audnexus] Invalid ASIN ${asin}`)
      return null
    }

    asin = encodeURIComponent(asin.toUpperCase())

    const authorRequestUrl = new URL(`${this.baseUrl}/authors/${asin}`)
    if (region) authorRequestUrl.searchParams.set('region', region)

    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    return this._processRequest(this.limiter(() => axios.get(authorRequestUrl.toString())))
      .then((res) => res.data)
      .catch((error) => {
        Logger.error(`[Audnexus] Author request failed for ${asin}`, error)
        return null
      })
  }

  /**
   *
   * @param {string} asin
   * @param {string} region
   * @returns {Promise<AuthorSearchObj>}
   */
  async findAuthorByASIN(asin, region) {
    const author = await this.authorRequest(asin, region)

    return author
      ? {
          asin: author.asin,
          description: author.description,
          image: author.image || null,
          name: author.name
        }
      : null
  }

  /**
   *
   * @param {string} name
   * @param {string} region
   * @param {number} maxLevenshtein
   * @returns {Promise<AuthorSearchObj>}
   */
  async findAuthorByName(name, region, maxLevenshtein = 3) {
    Logger.debug(`[Audnexus] Looking up author by name ${name}`)
    const authorAsinObjs = await this.authorASINsRequest(name, region)

    let closestMatch = null
    authorAsinObjs.forEach((authorAsinObj) => {
      authorAsinObj.levenshteinDistance = levenshteinDistance(authorAsinObj.name, name)
      if (!closestMatch || closestMatch.levenshteinDistance > authorAsinObj.levenshteinDistance) {
        closestMatch = authorAsinObj
      }
    })

    if (!closestMatch || closestMatch.levenshteinDistance > maxLevenshtein) {
      return null
    }

    const author = await this.authorRequest(closestMatch.asin, region)
    if (!author) {
      return null
    }

    return {
      asin: author.asin,
      description: author.description,
      image: author.image || null,
      name: author.name
    }
  }

  /**
   *
   * @param {string} asin
   * @param {string} region
   * @returns {Promise<Object>}
   */
  getChaptersByASIN(asin, region) {
    Logger.debug(`[Audnexus] Get chapters for ASIN ${asin}/${region}`)

    asin = encodeURIComponent(asin.toUpperCase())
    const chaptersRequestUrl = new URL(`${this.baseUrl}/books/${asin}/chapters`)
    if (region) chaptersRequestUrl.searchParams.set('region', region)

    return this._processRequest(this.limiter(() => axios.get(chaptersRequestUrl.toString())))
      .then((res) => res.data)
      .catch((error) => {
        Logger.error(`[Audnexus] Chapter ASIN request failed for ${asin}/${region}`, error)
        return null
      })
  }

  /**
   * Internal method to process requests and retry if rate limit is exceeded.
   */
  async _processRequest(request) {
    try {
      return await request()
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers?.['retry-after'], 10) || 5

        Logger.warn(`[Audnexus] Rate limit exceeded. Retrying in ${retryAfter} seconds.`)
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))

        return this._processRequest(request)
      }

      throw error
    }
  }
}

module.exports = Audnexus
