const axios = require('axios')
const { levenshteinDistance } = require('../utils/index')
const Logger = require('../Logger')

class Audnexus {
  constructor() {
    this.baseUrl = 'https://api.audnex.us'
  }

  authorASINsRequest(name, region) {
    name = encodeURIComponent(name)
    const regionQuery = region ? `&region=${region}` : ''
    const authorRequestUrl = `${this.baseUrl}/authors?name=${name}${regionQuery}`
    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)
    return axios.get(authorRequestUrl).then((res) => {
      return res.data || []
    }).catch((error) => {
      Logger.error(`[Audnexus] Author ASIN request failed for ${name}`, error)
      return []
    })
  }

  authorRequest(asin, region) {
    asin = encodeURIComponent(asin)
    const regionQuery = region ? `?region=${region}` : ''
    const authorRequestUrl = `${this.baseUrl}/authors/${asin}${regionQuery}`
    Logger.info(`[Audnexus] Searching for author "${authorRequestUrl}"`)
    return axios.get(authorRequestUrl).then((res) => {
      return res.data
    }).catch((error) => {
      Logger.error(`[Audnexus] Author request failed for ${asin}`, error)
      return null
    })
  }

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

  async findAuthorByName(name, region, maxLevenshtein = 3) {
    Logger.debug(`[Audnexus] Looking up author by name ${name}`)
    const asins = await this.authorASINsRequest(name, region)
    const matchingAsin = asins.find(obj => levenshteinDistance(obj.name, name) <= maxLevenshtein)
    if (!matchingAsin) {
      return null
    }
    const author = await this.authorRequest(matchingAsin.asin)
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
    return axios.get(`${this.baseUrl}/books/${asin}/chapters?region=${region}`).then((res) => {
      return res.data
    }).catch((error) => {
      Logger.error(`[Audnexus] Chapter ASIN request failed for ${asin}/${region}`, error)
      return null
    })
  }
}
module.exports = Audnexus