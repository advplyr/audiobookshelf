const Path = require('path')
const Logger = require('../Logger')
const parseAuthors = require('../utils/parseAuthors')

class Book {
  constructor(book = null) {
    this.title = null
    this.subtitle = null
    this.author = null
    this.authorFL = null
    this.authorLF = null
    this.authors = []
    this.narrator = null
    this.narratorFL = null
    this.series = null
    this.volumeNumber = null
    this.publishYear = null
    this.publisher = null
    this.description = null
    this.isbn = null
    this.langauge = null
    this.cover = null
    this.coverFullPath = null
    this.genres = []

    this.lastUpdate = null

    // Should not continue looking up a cover when it is not findable
    this.lastCoverSearch = null
    this.lastCoverSearchTitle = null
    this.lastCoverSearchAuthor = null

    if (book) {
      this.construct(book)
    }
  }

  get _title() { return this.title || '' }
  get _subtitle() { return this.subtitle || '' }
  get _narrator() { return this.narrator || '' }
  get _author() { return this.authorFL || '' }
  get _series() { return this.series || '' }
  get _authorsList() { return this._author.split(', ') }
  get _narratorsList() { return this._narrator.split(', ') }
  get _genres() { return this.genres || [] }

  get shouldSearchForCover() {
    if (this.cover) return false
    if (this.authorFL !== this.lastCoverSearchAuthor || this.title !== this.lastCoverSearchTitle || !this.lastCoverSearch) return true
    var timeSinceLastSearch = Date.now() - this.lastCoverSearch
    return timeSinceLastSearch > 1000 * 60 * 60 * 24 * 7 // every 7 days do another lookup
  }

  construct(book) {
    this.title = book.title
    this.subtitle = book.subtitle || null
    this.author = book.author
    this.authors = (book.authors || []).map(a => ({ ...a }))
    this.authorFL = book.authorFL || null
    this.authorLF = book.authorLF || null
    this.narrator = book.narrator || book.narrarator || null // Mispelled initially... need to catch those
    this.narratorFL = book.narratorFL || null
    this.series = book.series
    this.volumeNumber = book.volumeNumber || null
    this.publishYear = book.publishYear
    this.publisher = book.publisher
    this.description = book.description
    this.isbn = book.isbn || null
    this.language = book.language || null
    this.cover = book.cover
    this.coverFullPath = book.coverFullPath || null
    this.genres = book.genres
    this.lastUpdate = book.lastUpdate || Date.now()
    this.lastCoverSearch = book.lastCoverSearch || null
    this.lastCoverSearchTitle = book.lastCoverSearchTitle || null
    this.lastCoverSearchAuthor = book.lastCoverSearchAuthor || null

    // narratorFL added in v1.6.21 to support multi-narrators
    if (this.narrator && !this.narratorFL) {
      this.setParseNarrator(this.narrator)
    }
  }

  toJSON() {
    return {
      title: this.title,
      subtitle: this.subtitle,
      author: this.author,
      authors: this.authors,
      authorFL: this.authorFL,
      authorLF: this.authorLF,
      narrator: this.narrator,
      narratorFL: this.narratorFL,
      series: this.series,
      volumeNumber: this.volumeNumber,
      publishYear: this.publishYear,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      language: this.language,
      cover: this.cover,
      coverFullPath: this.coverFullPath,
      genres: this.genres,
      lastUpdate: this.lastUpdate,
      lastCoverSearch: this.lastCoverSearch,
      lastCoverSearchTitle: this.lastCoverSearchTitle,
      lastCoverSearchAuthor: this.lastCoverSearchAuthor
    }
  }

  setParseAuthor(author) {
    if (!author) {
      var hasUpdated = this.authorFL || this.authorLF
      this.authorFL = null
      this.authorLF = null
      return hasUpdated
    }
    try {
      var { authorLF, authorFL } = parseAuthors(author)
      var hasUpdated = authorLF !== this.authorLF || authorFL !== this.authorFL
      this.authorFL = authorFL || null
      this.authorLF = authorLF || null
      return hasUpdated
    } catch (err) {
      Logger.error('[Book] Parse authors failed', err)
      return false
    }
  }

  setParseNarrator(narrator) {
    if (!narrator) {
      var hasUpdated = this.narratorFL
      this.narratorFL = null
      return hasUpdated
    }
    try {
      var { authorFL } = parseAuthors(narrator)
      var hasUpdated = authorFL !== this.narratorFL
      this.narratorFL = authorFL || null
      return hasUpdated
    } catch (err) {
      Logger.error('[Book] Parse narrator failed', err)
      return false
    }
  }

  setData(data) {
    this.title = data.title || null
    this.subtitle = data.subtitle || null
    this.author = data.author || null
    this.authors = data.authors || []
    this.narrator = data.narrator || data.narrarator || null
    this.series = data.series || null
    this.volumeNumber = data.volumeNumber || null
    this.publishYear = data.publishYear || null
    this.description = data.description || null
    this.isbn = data.isbn || null
    this.language = data.language || null
    this.cover = data.cover || null
    this.coverFullPath = data.coverFullPath || null
    this.genres = data.genres || []
    this.lastUpdate = Date.now()
    this.lastCoverSearch = data.lastCoverSearch || null
    this.lastCoverSearchTitle = data.lastCoverSearchTitle || null
    this.lastCoverSearchAuthor = data.lastCoverSearchAuthor || null

    if (data.author) {
      this.setParseAuthor(this.author)
    }
    if (data.narrator) {
      this.setParseNarrator(this.narrator)
    }
  }

  update(payload) {
    var hasUpdates = false

    // Clean cover paths if passed
    if (payload.cover) {
      if (!payload.cover.startsWith('http:') && !payload.cover.startsWith('https:')) {
        payload.cover = payload.cover.replace(/\\/g, '/')
        if (payload.coverFullPath) payload.coverFullPath = payload.coverFullPath.replace(/\\/g, '/')
        else {
          Logger.warn(`[Book] "${this.title}" updating book cover to "${payload.cover}" but no full path was passed`)
        }
      }
    } else if (payload.coverFullPath) {
      Logger.warn(`[Book] "${this.title}" updating book full cover path to "${payload.coverFullPath}" but no relative path was passed`)
      payload.coverFullPath = payload.coverFullPath.replace(/\\/g, '/')
    }

    for (const key in payload) {
      if (payload[key] === undefined) continue;

      if (key === 'genres') {
        if (payload['genres'] === null && this.genres !== null) {
          this.genres = []
          hasUpdates = true
        } else if (payload['genres'].join(',') !== this.genres.join(',')) {
          this.genres = payload['genres']
          hasUpdates = true
        }
      } else if (key === 'author') {
        if (this.author !== payload.author) {
          this.author = payload.author || null
          hasUpdates = true
        }
        if (this.setParseAuthor(this.author)) {
          hasUpdates = true
        }
      } else if (key === 'narrator') {
        if (this.narrator !== payload.narrator) {
          this.narrator = payload.narrator || null
          hasUpdates = true
        }
        if (this.setParseNarrator(this.narrator)) {
          hasUpdates = true
        }
      } else if (this[key] !== undefined && payload[key] !== this[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      this.lastUpdate = Date.now()
    }

    return hasUpdates
  }

  updateLastCoverSearch(coverWasFound) {
    this.lastCoverSearch = coverWasFound ? null : Date.now()
    this.lastCoverSearchAuthor = coverWasFound ? null : this.authorFL
    this.lastCoverSearchTitle = coverWasFound ? null : this.title
  }

  updateCover(cover, coverFullPath) {
    if (!cover) return false
    if (!cover.startsWith('http:') && !cover.startsWith('https:')) {
      cover = cover.replace(/\\/g, '/')
      this.coverFullPath = coverFullPath.replace(/\\/g, '/')
    } else {
      this.coverFullPath = cover
    }
    this.cover = cover
    this.lastUpdate = Date.now()
    return true
  }

  removeCover() {
    this.cover = null
    this.coverFullPath = null
    this.lastUpdate = Date.now()
  }

  // If audiobook directory path was changed, check and update properties set from dirnames
  // May be worthwhile checking if these were manually updated and not override manual updates
  syncPathsUpdated(audiobookData) {
    var keysToSync = ['author', 'title', 'series', 'publishYear', 'volumeNumber']
    var syncPayload = {}
    keysToSync.forEach((key) => {
      if (audiobookData[key]) syncPayload[key] = audiobookData[key]
    })
    if (!Object.keys(syncPayload).length) return false
    return this.update(syncPayload)
  }

  isSearchMatch(search) {
    return this._title.toLowerCase().includes(search) || this._subtitle.toLowerCase().includes(search) || this._author.toLowerCase().includes(search) || this._series.toLowerCase().includes(search)
  }

  getQueryMatches(search) {
    var titleMatch = this._title.toLowerCase().includes(search)
    var subtitleMatch = this._subtitle.toLowerCase().includes(search)

    var authorsMatched = this._authorsList.filter(auth => auth.toLowerCase().includes(search))

    // var authorMatch = this._author.toLowerCase().includes(search)
    var seriesMatch = this._series.toLowerCase().includes(search)

    // ISBN match has to be exact to prevent isbn matches to flood results. Remove dashes since isbn might have those
    var isbnMatch = this.isbn.toLowerCase().replace(/-/g, '') === search.replace(/-/g, '')

    var bookMatchKey = titleMatch ? 'title' : subtitleMatch ? 'subtitle' : authorsMatched.length ? 'authorFL' : seriesMatch ? 'series' : isbnMatch ? 'isbn' : false

    var bookMatchText = bookMatchKey ? this[bookMatchKey] : ''
    return {
      book: bookMatchKey,
      bookMatchText,
      authors: authorsMatched.length ? authorsMatched : false,
      series: seriesMatch ? this._series : false
    }
  }

  parseGenresTag(genreTag) {
    if (!genreTag || !genreTag.length) return []
    var separators = ['/', '//', ';']
    for (let i = 0; i < separators.length; i++) {
      if (genreTag.includes(separators[i])) {
        return genreTag.split(separators[i]).map(genre => genre.trim()).filter(g => !!g)
      }
    }
    return [genreTag]
  }

  setDetailsFromFileMetadata(audioFileMetadata, overrideExistingDetails = false) {
    const MetadataMapArray = [
      {
        tag: 'tagComposer',
        key: 'narrator'
      },
      {
        tag: 'tagDescription',
        key: 'description'
      },
      {
        tag: 'tagPublisher',
        key: 'publisher'
      },
      {
        tag: 'tagDate',
        key: 'publishYear'
      },
      {
        tag: 'tagSubtitle',
        key: 'subtitle'
      },
      {
        tag: 'tagAlbum',
        altTag: 'tagTitle',
        key: 'title',
      },
      {
        tag: 'tagArtist',
        altTag: 'tagAlbumArtist',
        key: 'author'
      },
      {
        tag: 'tagGenre',
        key: 'genres'
      },
      {
        tag: 'tagSeries',
        key: 'series'
      },
      {
        tag: 'tagSeriesPart',
        key: 'volumeNumber'
      },
      {
        tag: 'tagIsbn',
        key: 'isbn'
      }
    ]

    var updatePayload = {}

    // Metadata is only mapped to the book if it is empty
    MetadataMapArray.forEach((mapping) => {
      var value = audioFileMetadata[mapping.tag]
      var tagToUse = mapping.tag
      if (!value && mapping.altTag) {
        value = audioFileMetadata[mapping.altTag]
        tagToUse = mapping.altTag
      }
      if (value) {
        // Genres can contain multiple
        if (mapping.key === 'genres' && (!this[mapping.key].length || !this[mapping.key] || overrideExistingDetails)) {
          updatePayload[mapping.key] = this.parseGenresTag(audioFileMetadata[tagToUse])
          // Logger.debug(`[Book] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${updatePayload[mapping.key].join(',')}`)
        } else if (!this[mapping.key] || overrideExistingDetails) {
          updatePayload[mapping.key] = audioFileMetadata[tagToUse]
          // Logger.debug(`[Book] Mapping metadata to key ${tagToUse} => ${mapping.key}: ${updatePayload[mapping.key]}`)
        }
      }
    })

    if (Object.keys(updatePayload).length) {
      return this.update(updatePayload)
    }
    return false
  }
}
module.exports = Book