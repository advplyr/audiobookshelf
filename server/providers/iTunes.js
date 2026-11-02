const axios = require('axios')
const Logger = require('../Logger')
const htmlSanitizer = require('../utils/htmlSanitizer')

/**
 * @typedef iTunesSearchParams
 * @property {string} term
 * @property {string} country
 * @property {string} media
 * @property {string} entity
 * @property {number} limit
 */

/**
 * @typedef iTunesPodcastSearchResult
 * @property {string} id
 * @property {string} artistId
 * @property {string} title
 * @property {string} artistName
 * @property {string} description
 * @property {string} descriptionPlain
 * @property {string} releaseDate
 * @property {string[]} genres
 * @property {string} cover
 * @property {string} feedUrl
 * @property {string} pageUrl
 * @property {boolean} explicit
 */

/**
 * Split a list of authors on commas. A piece with no space is a credential and is glued onto the previous name.
 *
 * @param {string} text
 * @returns {string[]}
 */
function parseAuthorPieces(text) {
  const authors = []
  for (const piece of (text || '').split(',')) {
    const name = piece.trim()
    if (!name) continue
    if (!name.includes(' ') && authors.length) {
      authors[authors.length - 1] = `${authors[authors.length - 1]} ${name}`
    } else {
      authors.push(name)
    }
  }
  return authors
}

function stripCommasFromName(name) {
  return (name || '').replace(/,/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Apple lists authors as "Name1, Name2 & Name3", but a comma can also sit inside one name ("Rick Hanson, PhD").
 * A comma-separated piece with no space is treated as a credential and glued onto the previous name.
 * The text after the last " & " is a single author, so commas there are removed.
 * @see https://github.com/advplyr/audiobookshelf/issues/1022
 * @see https://github.com/advplyr/audiobookshelf/issues/2661
 *
 * @param {string} artistName
 * @returns {string}
 */
function cleanAuthor(artistName) {
  const raw = (artistName || '').trim()
  if (!raw) return ''

  const lastAmpIndex = raw.lastIndexOf(' & ')
  if (lastAmpIndex === -1) {
    return stripCommasFromName(raw)
  }

  const authors = parseAuthorPieces(raw.slice(0, lastAmpIndex))
  const lastAuthor = stripCommasFromName(raw.slice(lastAmpIndex + 3))
  if (lastAuthor) authors.push(lastAuthor)
  return authors.join(', ')
}

class iTunes {
  #responseTimeout = 10000

  constructor() {}

  /**
   * @see https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
   *
   * @param {iTunesSearchParams} options
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  search(options, timeout = this.#responseTimeout) {
    if (!options.term) {
      Logger.error('[iTunes] Invalid search options - no term')
      return []
    }
    if (!timeout || isNaN(timeout)) timeout = this.#responseTimeout

    const query = {
      term: options.term,
      media: options.media,
      entity: options.entity,
      lang: options.lang,
      limit: options.limit,
      country: options.country
    }
    return axios
      .get('https://itunes.apple.com/search', {
        params: query,
        timeout
      })
      .then((response) => {
        return response.data.results || []
      })
      .catch((error) => {
        Logger.error(`[iTunes] search request error`, error.message)
        return []
      })
  }

  // Example cover art: https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/cb/ea/73/cbea739b-ff3b-11c4-fb93-7889fbec7390/9781598874983_cover.jpg/100x100bb.jpg
  // 100x100bb can be replaced by other values https://github.com/bendodson/itunes-artwork-finder
  // Target size 600 or larger
  getCoverArtwork(data) {
    if (data.artworkUrl600) {
      return data.artworkUrl600
    }
    // Should already be sorted from small to large
    var artworkSizes = Object.keys(data)
      .filter((key) => key.startsWith('artworkUrl'))
      .map((key) => {
        return {
          url: data[key],
          size: Number(key.replace('artworkUrl', ''))
        }
      })
    if (!artworkSizes.length) return null

    // Return next biggest size > 600
    var nextBestSize = artworkSizes.find((size) => size.size > 600)
    if (nextBestSize) return nextBestSize.url

    // Find square artwork
    var squareArtwork = artworkSizes.find((size) => size.url.includes(`${size.size}x${size.size}bb`))

    // Square cover replace with 600x600bb
    if (squareArtwork) {
      return squareArtwork.url.replace(`${squareArtwork.size}x${squareArtwork.size}bb`, '600x600bb')
    }

    // Last resort just return biggest size
    return artworkSizes[artworkSizes.length - 1].url
  }

  cleanAudiobook(data) {
    return {
      id: data.collectionId,
      artistId: data.artistId,
      title: data.collectionName,
      author: cleanAuthor(data.artistName),
      description: data.description || null,
      publishedYear: data.releaseDate ? data.releaseDate.split('-')[0] : null,
      genres: data.primaryGenreName ? [data.primaryGenreName] : null,
      cover: this.getCoverArtwork(data)
    }
  }

  /**
   *
   * @param {string} term
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  searchAudiobooks(term, timeout = this.#responseTimeout) {
    return this.search({ term, entity: 'audiobook', media: 'audiobook' }, timeout).then((results) => {
      return results.map(this.cleanAudiobook.bind(this))
    })
  }

  /**
   *
   * @param {Object} data
   * @returns {iTunesPodcastSearchResult}
   */
  cleanPodcast(data) {
    return {
      id: data.collectionId,
      artistId: data.artistId || null,
      title: data.collectionName,
      artistName: data.artistName,
      description: htmlSanitizer.sanitize(data.description || ''),
      descriptionPlain: htmlSanitizer.stripAllTags(data.description || ''),
      releaseDate: data.releaseDate,
      genres: data.genres || [],
      cover: this.getCoverArtwork(data),
      trackCount: data.trackCount,
      feedUrl: data.feedUrl,
      pageUrl: data.collectionViewUrl,
      explicit: data.trackExplicitness === 'explicit'
    }
  }

  /**
   *
   * @param {string} term
   * @param {{country:string}} options
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<iTunesPodcastSearchResult[]>}
   */
  searchPodcasts(term, options = {}, timeout = this.#responseTimeout) {
    return this.search({ term, entity: 'podcast', media: 'podcast', ...options }, timeout).then((results) => {
      return results.map(this.cleanPodcast.bind(this))
    })
  }
}
module.exports = iTunes
