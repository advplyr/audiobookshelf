const axios = require('axios')
const { levenshteinDistance } = require('../utils/index')
const Logger = require('../Logger')

class Audnexus {
  constructor() {
    this.baseUrl = 'https://api.audnex.us'
  }

  authorASINsRequest(name) {
    name = encodeURIComponent(name);
    return axios.get(`${this.baseUrl}/authors?name=${name}`).then((res) => {
      return res.data || []
    }).catch((error) => {
      Logger.error(`[Audnexus] Author ASIN request failed for ${name}`, error)
      return []
    })
  }

  authorRequest(asin) {
    asin = encodeURIComponent(asin);
    return axios.get(`${this.baseUrl}/authors/${asin}`).then((res) => {
      return res.data
    }).catch((error) => {
      Logger.error(`[Audnexus] Author request failed for ${asin}`, error)
      return null
    })
  }

  async findAuthorByASIN(asin) {
    var author = await this.authorRequest(asin)
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

  async findAuthorByName(name, maxLevenshtein = 3) {
    Logger.debug(`[Audnexus] Looking up author by name ${name}`)
    var asins = await this.authorASINsRequest(name)
    var matchingAsin = asins.find(obj => levenshteinDistance(obj.name, name) <= maxLevenshtein)
    if (!matchingAsin) {
      return null
    }
    var author = await this.authorRequest(matchingAsin.asin)
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

  async getChaptersByASIN(asin) {
    Logger.debug(`[Audnexus] Get chapters for ASIN ${asin}`)
    return axios.get(`${this.baseUrl}/books/${asin}/chapters`).then((res) => {
      return res.data
    }).catch((error) => {
      Logger.error(`[Audnexus] Chapter ASIN request failed for ${asin}`, error)
      return null
    })
  }
}
module.exports = Audnexus