const Logger = require('../Logger')
const iTunes = require('../providers/iTunes')

class PodcastFinder {
  constructor() {
    this.iTunesApi = new iTunes()
  }

  /**
   * 
   * @param {string} term 
   * @param {{country:string}} options 
   * @returns {Promise<import('../providers/iTunes').iTunesPodcastSearchResult[]>}
   */
  async search(term, options = {}) {
    if (!term) return null
    Logger.debug(`[iTunes] Searching for podcast with term "${term}"`)
    const results = await this.iTunesApi.searchPodcasts(term, options)
    Logger.debug(`[iTunes] Podcast search for "${term}" returned ${results.length} results`)
    return results
  }

  async findCovers(term) {
    if (!term) return null
    Logger.debug(`[iTunes] Searching for podcast covers with term "${term}"`)
    var results = await this.iTunesApi.searchPodcasts(term)
    if (!results) return []
    return results.map(r => r.cover).filter(r => r)
  }
}
module.exports = new PodcastFinder()