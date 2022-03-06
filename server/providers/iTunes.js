const axios = require('axios')
const Logger = require('../Logger')

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
    console.log('Query', query)

    return axios.get('https://itunes.apple.com/search', { params: query }).then((response) => {
      var data = response.data
      console.log('data', data)
      return data.results || []
    }).catch((error) => {
      Logger.error(`[iTunes] search request error`, error)
      return []
    })
  }
}
module.exports = iTunes