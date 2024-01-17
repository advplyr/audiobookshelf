const axios = require('axios')
const { levenshteinDistance } = require('../utils/index')
const Logger = require('../Logger')
const { RateLimiter } = require('limiter')

class Audnexus {
  static _instance = null

  constructor() {
    // ensures Audnexus class is singleton 
    if (Audnexus._instance) {
      return Audnexus._instance
    }

    this.baseUrl = 'https://api.audnex.us'

    // @see https://github.com/laxamentumtech/audnexus#-deployment-
    this.limiter = new RateLimiter({
      tokensPerInterval: 100,
      fireImmediately: true,
      interval: 'minute',
    })

    Audnexus._instance = this
  }

  authorASINsRequest(name, region) {
    name = encodeURIComponent(name)
    const regionQuery = region ? `&region=${region}` : ''
    const authorRequestUrl = `${this.baseUrl}/authors?name=${name}${regionQuery}`

    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    return this._processRequest(() => axios.get(authorRequestUrl))
      .then((res) => res.data || [])
      .catch((error) => {
        Logger.error(`[Audnexus] Author ASIN request failed for ${name}`, error)
        return []
      })
  }

  authorRequest(asin, region) {
    asin = encodeURIComponent(asin)
    const regionQuery = region ? `?region=${region}` : ''
    const authorRequestUrl = `${this.baseUrl}/authors/${asin}${regionQuery}`

    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)

    return this._processRequest(() => axios.get(authorRequestUrl))
      .then((res) => res.data)
      .catch((error) => {
        Logger.error(`[Audnexus] Author request failed for ${asin}`, error)
        return null
      })
  }

  /**
   * @description Process a request with a rate limiter
   * 
   * @param {*} request 
   * @returns 
   */
  async _processRequest(request) {
    const remainingTokens = await this.limiter.removeTokens(1)
    Logger.info(`[Audnexus] Attempting request with ${remainingTokens} remaining tokens and ${this.limiter.tokensThisInterval} this interval`)

    if (remainingTokens >= 1) {
      return request()
    }

    // 100 tokens(requests) per minute give a refresh of ~1.67 per second, 
    // so a 10 second wait will yield ~16.7 additional tokens
    Logger.info('[Audnexus] Sleeping for 10 seconds')
    await new Promise(resolve => setTimeout(resolve, 10000))

    return this._processRequest(request)
  }

  async findAuthorByASIN(asin, region) {
    const author = await this.authorRequest(asin, region)

    return author ?
      {
        asin: author.asin,
        description: author.description,
        image: author.image || null,
        name: author.name
      } : null
  }

  async findAuthorByName(name, region, maxLevenshtein = 3) {
    Logger.debug(`[Audnexus] Looking up author by name ${name}`)

    const asins = await this.authorASINsRequest(name, region)
    const matchingAsin = asins.find(obj => levenshteinDistance(obj.name, name) <= maxLevenshtein)

    if (!matchingAsin) {
      return null
    }

    const author = await this.authorRequest(matchingAsin.asin)
    return author ?
      {
        description: author.description,
        image: author.image || null,
        asin: author.asin,
        name: author.name
      } : null
  }

  getChaptersByASIN(asin, region) {
    Logger.debug(`[Audnexus] Get chapters for ASIN ${asin}/${region}`)

    return this._processRequest(() => axios.get(`${this.baseUrl}/books/${asin}/chapters?region=${region}`))
      .then((res) => res.data)
      .catch((error) => {
        Logger.error(`[Audnexus] Chapter ASIN request failed for ${asin}/${region}`, error)
        return null
      })
  }
}

module.exports = Audnexus