const axios = require('axios')
const Logger = require('../Logger')

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

    const url = `https://api.audiobookcovers.com/cover/bytext/`
    const params = new URLSearchParams([['q', search]])
    const items = await axios
      .get(url, {
        params,
        timeout
      })
      .then((res) => res?.data || [])
      .catch((error) => {
        Logger.error('[AudiobookCovers] Cover search error', error.message)
        return []
      })
    return items.map((item) => ({ cover: item.versions.png.original }))
  }
}
module.exports = AudiobookCovers
