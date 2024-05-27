const axios = require('axios').default
const { levenshteinDistance } = require('../utils/index')
const Logger = require('../Logger')

/**
 * @typedef AuthorSearchObj
 * @property {string} asin
 * @property {string} description
 * @property {string} image
 * @property {string} name
 */

class Audnexus {
  constructor() {
    this.baseUrl = 'https://api.audnex.us'
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
    return axios
      .get(authorRequestUrl)
      .then((res) => {
        return res.data || []
      })
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
    asin = encodeURIComponent(asin)
    const regionQuery = region ? `?region=${region}` : ''
    const authorRequestUrl = `${this.baseUrl}/authors/${asin}${regionQuery}`
    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)
    return axios
      .get(authorRequestUrl)
      .then((res) => {
        return res.data
      })
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
    const author = await this.authorRequest(closestMatch.asin)
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

  getChaptersByASIN(asin, region) {
    Logger.debug(`[Audnexus] Get chapters for ASIN ${asin}/${region}`)
    return axios
      .get(`${this.baseUrl}/books/${asin}/chapters?region=${region}`)
      .then((res) => {
        return res.data
      })
      .catch((error) => {
        Logger.error(`[Audnexus] Chapter ASIN request failed for ${asin}/${region}`, error)
        return null
      })
  }
}
module.exports = Audnexus
