const Logger = require('../Logger')
const { fetchJson } = require('../utils/fetchUtils')

class AudiobookCovers {
  #responseTimeout = 10000

  constructor() {}

  /**
   *
   * @param {string} search
   * @param {number} [timeout]
   * @returns {Promise<{cover: string}[]>}
   */
  async search(search, timeout = this.#responseTimeout) {
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    const url = new URL('https://api.audiobookcovers.com/cover/bytext/')
    url.searchParams.set('q', search)
    const items = await fetchJson(url, { timeout })
      .then((data) => data || [])
      .catch((error) => {
        Logger.error('[AudiobookCovers] Cover search error', error.message)
        return []
      })
    return items.map((item) => ({ cover: item.versions.png.original }))
  }
}
module.exports = AudiobookCovers
