const fs = require('fs-extra')
const Path = require('path')
const Logger = require('../Logger')
const parseAuthors = require('../utils/parseAuthors')

class Book {
  constructor(book = null) {
    this.olid = null
    this.title = null
    this.subtitle = null
    this.author = null
    this.authorFL = null
    this.authorLF = null
    this.narrarator = null
    this.series = null
    this.volumeNumber = null
    this.publishYear = null
    this.publisher = null
    this.description = null
    this.cover = null
    this.coverFullPath = null
    this.genres = []
    this.lastUpdate = null

    if (book) {
      this.construct(book)
    }
  }

  get _title() { return this.title || '' }
  get _subtitle() { return this.subtitle || '' }
  get _narrarator() { return this.narrarator || '' }
  get _author() { return this.author || '' }
  get _series() { return this.series || '' }

  construct(book) {
    this.olid = book.olid
    this.title = book.title
    this.subtitle = book.subtitle || null
    this.author = book.author
    this.authorFL = book.authorFL || null
    this.authorLF = book.authorLF || null
    this.narrarator = book.narrarator || null
    this.series = book.series
    this.volumeNumber = book.volumeNumber || null
    this.publishYear = book.publishYear
    this.publisher = book.publisher
    this.description = book.description
    this.cover = book.cover
    this.coverFullPath = book.coverFullPath || null
    this.genres = book.genres
    this.lastUpdate = book.lastUpdate || Date.now()
  }

  toJSON() {
    return {
      olid: this.olid,
      title: this.title,
      subtitle: this.subtitle,
      author: this.author,
      authorFL: this.authorFL,
      authorLF: this.authorLF,
      narrarator: this.narrarator,
      series: this.series,
      volumeNumber: this.volumeNumber,
      publishYear: this.publishYear,
      publisher: this.publisher,
      description: this.description,
      cover: this.cover,
      coverFullPath: this.coverFullPath,
      genres: this.genres,
      lastUpdate: this.lastUpdate
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

  setData(data) {
    this.olid = data.olid || null
    this.title = data.title || null
    this.subtitle = data.subtitle || null
    this.author = data.author || null
    this.narrarator = data.narrarator || null
    this.series = data.series || null
    this.volumeNumber = data.volumeNumber || null
    this.publishYear = data.publishYear || null
    this.description = data.description || null
    this.cover = data.cover || null
    this.coverFullPath = data.coverFullPath || null
    this.genres = data.genres || []
    this.lastUpdate = Date.now()

    if (data.author) {
      this.setParseAuthor(this.author)
    }
  }

  update(payload) {
    var hasUpdates = false

    if (payload.cover) {
      // If updating to local cover then normalize path
      if (!payload.cover.startsWith('http:') && !payload.cover.startsWith('https:')) {
        payload.cover = Path.normalize(payload.cover)
      }
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

  updateCover(cover) {
    if (!cover) return false
    if (!cover.startsWith('http:') && !cover.startsWith('https:')) {
      cover = Path.normalize(cover)
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

  setDetailsFromFileMetadata(audioFileMetadata) {
    const MetadataMapArray = [
      {
        tag: 'tagComposer',
        key: 'narrarator'
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
        tag: 'tagArtist',
        key: 'author'
      }
    ]

    var updatePayload = {}
    MetadataMapArray.forEach((mapping) => {
      if (!this[mapping.key] && audioFileMetadata[mapping.tag]) {
        updatePayload[mapping.key] = audioFileMetadata[mapping.tag]
        Logger.debug(`[Book] Mapping metadata to key ${mapping.tag} => ${mapping.key}: ${updatePayload[mapping.key]}`)
      }
    })

    if (Object.keys(updatePayload).length) {
      return this.update(updatePayload)
    }
    return false
  }
}
module.exports = Book