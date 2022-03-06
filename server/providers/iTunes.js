const axios = require('axios')
const Logger = require('../Logger')
const { stripHtml } = require('string-strip-html')
class iTunes {
  constructor() { }

  // https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
  search(options) {
    if (!options.term) {
      Logger.error('[iTunes] Invalid search options - no term')
      return []
    }
    var query = {
      term: options.term,
      media: options.media,
      entity: options.entity,
      lang: options.lang,
      limit: options.limit,
      country: options.country
    }
    return axios.get('https://itunes.apple.com/search', { params: query }).then((response) => {
      return response.data.results || []
    }).catch((error) => {
      Logger.error(`[iTunes] search request error`, error)
      return []
    })
  }

  cleanAudiobook(data) {
    // Example cover art: https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/cb/ea/73/cbea739b-ff3b-11c4-fb93-7889fbec7390/9781598874983_cover.jpg/100x100bb.jpg
    // 100x100bb can be replaced by other values https://github.com/bendodson/itunes-artwork-finder
    var cover = data.artworkUrl100 || data.artworkUrl60 || ''
    cover = cover.replace('100x100bb', '600x600bb').replace('60x60bb', '600x600bb')
    return {
      id: data.collectionId,
      artistId: data.artistId,
      title: data.collectionName,
      author: data.artistName,
      description: stripHtml(data.description || '').result,
      publishYear: data.releaseDate ? data.releaseDate.split('-')[0] : null,
      genres: data.primaryGenreName ? [data.primaryGenreName] : [],
      cover
    }
  }

  searchAudiobooks(term) {
    return this.search({ term, entity: 'audiobook', media: 'audiobook' }).then((results) => {
      return results.map(this.cleanAudiobook)
    })
  }
}
module.exports = iTunes