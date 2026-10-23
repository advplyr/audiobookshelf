import axios from 'axios'
import Logger from '../Logger'
import htmlSanitizer from '../utils/htmlSanitizer'

type SearchOptions = {
  term: string; country?: string; media?: string; entity?: string; lang?: string; limit?: number
}
// Search responses have numeric IDs. Extra fields are passed through by search().
type SearchItem = {
  collectionId?: number; artistId?: number; collectionName?: string; artistName?: string
  description?: string; releaseDate?: string; genres?: string[]; primaryGenreName?: string
  trackCount?: number; feedUrl?: string; collectionViewUrl?: string; trackExplicitness?: string
  [key: `artworkUrl${string}`]: string
  [key: string]: unknown
}

class iTunes {
  #responseTimeout = 10000


  /**
   * @see https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
   *
   * @param {iTunesSearchParams} options
   * @param {number} [timeout] response timeout in ms
   * @returns {Promise<Object[]>}
   */
  search(options: SearchOptions, timeout = this.#responseTimeout) {
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
      .get<{ results?: SearchItem[] }>('https://itunes.apple.com/search', {
        params: query,
        timeout
      })
      .then((response) => {
        return response.data.results || []
      })
      .catch((error: Error) => {
        Logger.error(`[iTunes] search request error`, error.message)
        return []
      })
  }

  // Example cover art: https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/cb/ea/73/cbea739b-ff3b-11c4-fb93-7889fbec7390/9781598874983_cover.jpg/100x100bb.jpg
  // 100x100bb can be replaced by other values https://github.com/bendodson/itunes-artwork-finder
  // Target size 600 or larger
  getCoverArtwork(data: SearchItem) {
    if (data.artworkUrl600) {
      return data.artworkUrl600
    }
    // Should already be sorted from small to large
    var artworkSizes = Object.keys(data)
      .filter((key) => key.startsWith('artworkUrl'))
      .map((key) => {
        return {
          url: data[key as `artworkUrl${string}`],
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

  cleanAudiobook(data: SearchItem) {
    // artistName can be "Name1, Name2 & Name3" so we refactor this to "Name1, Name2, Name3"
    //  see: https://github.com/advplyr/audiobookshelf/issues/1022
    const author = (data.artistName || '').split(' & ').join(', ')

    return {
      id: data.collectionId,
      artistId: data.artistId,
      title: data.collectionName,
      author,
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
  // The legacy wrappers assume a Promise; an empty term still throws on .then().
  searchAudiobooks(term: string, timeout = this.#responseTimeout) {
    return (this.search({ term, entity: 'audiobook', media: 'audiobook' }, timeout) as Promise<SearchItem[]>).then((results) => {
      return results.map(this.cleanAudiobook.bind(this))
    })
  }

  /**
   *
   * @param {Object} data
   * @returns {iTunesPodcastSearchResult}
   */
  cleanPodcast(data: SearchItem) {
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
  searchPodcasts(term: string, options: { country?: string } = {}, timeout = this.#responseTimeout) {
    return (this.search({ term, entity: 'podcast', media: 'podcast', ...options }, timeout) as Promise<SearchItem[]>).then((results) => {
      return results.map(this.cleanPodcast.bind(this))
    })
  }
}
declare namespace iTunes {
  type iTunesSearchParams = SearchOptions
  type iTunesPodcastSearchResult = ReturnType<iTunes['cleanPodcast']>
}

export = iTunes
