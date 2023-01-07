const axios = require('axios')
const packageJson = require('../../package.json')
const Logger = require('../Logger')
const { isNullOrNaN } = require('../utils/index')

class MusicBrainz {
  constructor() { }

  get userAgentString() {
    return `audiobookshelf/${packageJson.version} (https://audiobookshelf.org)`
  }

  // https://musicbrainz.org/doc/MusicBrainz_API/Search
  searchTrack(options) {
    let luceneParts = []
    if (options.artist) {
      luceneParts.push(`artist:${options.artist}`)
    }
    if (options.isrc) {
      luceneParts.push(`isrc:${options.isrc}`)
    }
    if (options.title) {
      luceneParts.push(`recording:${options.title}`)
    }
    if (options.album) {
      luceneParts.push(`release:${options.album}`)
    }
    if (!luceneParts.length) {
      Logger.error(`[MusicBrainz] Invalid search options - must have at least one of artist, isrc, title, album`)
      return []
    }

    const query = {
      query: luceneParts.join(' AND '),
      limit: isNullOrNaN(options.limit) ? 15 : Number(options.limit),
      fmt: 'json'
    }
    const config = {
      headers: {
        'User-Agent': this.userAgentString
      }
    }
    return axios.get('https://musicbrainz.org/ws/2/recording', { params: query }, config).then((response) => {
      return response.data.recordings || []
    }).catch((error) => {
      Logger.error(`[MusicBrainz] search request error`, error)
      return []
    })
  }
}
module.exports = MusicBrainz