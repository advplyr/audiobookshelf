const axios = require('axios')
const Logger = require('../Logger')

class AudiobookCovers {
  constructor() { }

  async search(search) {
    const url = `https://api.audiobookcovers.com/cover/bytext/`
    const params = new URLSearchParams([['q', search]])
    const items = await axios.get(url, { params }).then((res) => {
      if (!res || !res.data) return []
      return res.data
    }).catch(error => {
      Logger.error('[AudiobookCovers] Cover search error', error)
      return []
    })
    return items.map(item => ({ cover: item.versions.png.original }))
  }
}



module.exports = AudiobookCovers
