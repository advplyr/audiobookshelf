const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')
const { getTitlePrefixAtEnd, getTitleIgnorePrefix } = require('../utils')
const parseNameString = require('../utils/parsers/parseNameString')
const htmlSanitizer = require('../utils/htmlSanitizer')
const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')

/**
 * @typedef EBookFileObject
 * @property {string} ino
 * @property {string} ebookFormat
 * @property {number} addedAt
 * @property {number} updatedAt
 * @property {{filename:string, ext:string, path:string, relPath:strFing, size:number, mtimeMs:number, ctimeMs:number, birthtimeMs:number}} metadata
 */

/**
 * @typedef ChapterObject
 * @property {number} id
 * @property {number} start
 * @property {number} end
 * @property {string} title
 */

/**
 * @typedef SeriesExpandedProperties
 * @property {{sequence:string}} bookSeries
 *
 * @typedef {import('./Series') & SeriesExpandedProperties} SeriesExpanded
 *
 * @typedef BookExpandedProperties
 * @property {import('./Author')[]} authors
 * @property {SeriesExpanded[]} series
 *
 * @typedef {Book & BookExpandedProperties} BookExpanded
 *
 * Collections use BookExpandedWithLibraryItem
 * @typedef BookExpandedWithLibraryItemProperties
 * @property {import('./LibraryItem')} libraryItem
 *
 * @typedef {BookExpanded & BookExpandedWithLibraryItemProperties} BookExpandedWithLibraryItem
 */

/**
 * @typedef AudioFileObject
 * @property {number} index
 * @property {string} ino
 * @property {{filename:string, ext:string, path:string, relPath:string, size:number, mtimeMs:number, ctimeMs:number, birthtimeMs:number}} metadata
 * @property {number} addedAt
 * @property {number} updatedAt
 * @property {number} trackNumFromMeta
 * @property {number} discNumFromMeta
 * @property {number} trackNumFromFilename
 * @property {number} discNumFromFilename
 * @property {boolean} manuallyVerified
 * @property {string} format
 * @property {number} duration
 * @property {number} bitRate
 * @property {string} language
 * @property {string} codec
 * @property {string} timeBase
 * @property {number} channels
 * @property {string} channelLayout
 * @property {ChapterObject[]} chapters
 * @property {Object} metaTags
 * @property {string} mimeType
 *
 * @typedef AudioTrackProperties
 * @property {string} title
 * @property {string} contentUrl
 * @property {number} startOffset
 *
 * @typedef {AudioFileObject & AudioTrackProperties} AudioTrack
 */

class Book extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.title
    /** @type {string} */
    this.titleIgnorePrefix
    /** @type {string} */
    this.subtitle
    /** @type {string} */
    this.publishedYear
    /** @type {string} */
    this.publishedDate
    /** @type {string} */
    this.publisher
    /** @type {string} */
    this.description
    /** @type {string} */
    this.isbn
    /** @type {string} */
    this.asin
    /** @type {string} */
    this.language
    /** @type {boolean} */
    this.explicit
    /** @type {boolean} */
    this.abridged
    /** @type {string} */
    this.coverPath
    /** @type {number} */
    this.duration
    /** @type {string[]} */
    this.narrators
    /** @type {AudioFileObject[]} */
    this.audioFiles
    /** @type {EBookFileObject} */
    this.ebookFile
    /** @type {ChapterObject[]} */
    this.chapters
    /** @type {string[]} */
    this.tags
    /** @type {string[]} */
    this.genres
    /** @type {Date} */
    this.updatedAt
    /** @type {Date} */
    this.createdAt

    // Expanded properties

    /** @type {import('./Author')[]} - optional if expanded */
    this.authors
    /** @type {import('./Series')[]} - optional if expanded */
    this.series
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        title: DataTypes.STRING,
        titleIgnorePrefix: DataTypes.STRING,
        subtitle: DataTypes.STRING,
        publishedYear: DataTypes.STRING,
        publishedDate: DataTypes.STRING,
        publisher: DataTypes.STRING,
        description: DataTypes.TEXT,
        isbn: DataTypes.STRING,
        asin: DataTypes.STRING,
        language: DataTypes.STRING,
        explicit: DataTypes.BOOLEAN,
        abridged: DataTypes.BOOLEAN,
        coverPath: DataTypes.STRING,
        duration: DataTypes.FLOAT,

        narrators: DataTypes.JSON,
        audioFiles: DataTypes.JSON,
        ebookFile: DataTypes.JSON,
        chapters: DataTypes.JSON,
        tags: DataTypes.JSON,
        genres: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'book',
        indexes: [
          {
            fields: [
              {
                name: 'title',
                collate: 'NOCASE'
              }
            ]
          },
          // {
          //   fields: [{
          //     name: 'titleIgnorePrefix',
          //     collate: 'NOCASE'
          //   }]
          // },
          {
            fields: ['publishedYear']
          },
          {
            fields: ['duration']
          }
        ]
      }
    )

    Book.addHook('afterDestroy', async (instance) => {
      libraryItemsBookFilters.clearCountCache('afterDestroy')
    })

    Book.addHook('afterCreate', async (instance) => {
      libraryItemsBookFilters.clearCountCache('afterCreate')
    })
  }

  /**
   * Comma separated array of author names
   * Requires authors to be loaded
   *
   * @returns {string}
   */
  get authorName() {
    if (this.authors === undefined) {
      Logger.error(`[Book] authorName: Cannot get authorName because authors are not loaded`)
      return ''
    }
    return this.authors.map((au) => au.name).join(', ')
  }

  /**
   * Comma separated array of author names in Last, First format
   * Requires authors to be loaded
   *
   * @returns {string}
   */
  get authorNameLF() {
    if (this.authors === undefined) {
      Logger.error(`[Book] authorNameLF: Cannot get authorNameLF because authors are not loaded`)
      return ''
    }

    // Last, First
    if (!this.authors.length) return ''
    return this.authors.map((au) => parseNameString.nameToLastFirst(au.name)).join(', ')
  }

  /**
   * Comma separated array of series with sequence
   * Requires series to be loaded
   *
   * @returns {string}
   */
  get seriesName() {
    if (this.series === undefined) {
      Logger.error(`[Book] seriesName: Cannot get seriesName because series are not loaded`)
      return ''
    }

    if (!this.series.length) return ''
    return this.series
      .map((se) => {
        const sequence = se.bookSeries?.sequence || ''
        if (!sequence) return se.name
        return `${se.name} #${sequence}`
      })
      .join(', ')
  }

  get includedAudioFiles() {
    return this.audioFiles.filter((af) => !af.exclude)
  }

  get hasMediaFiles() {
    return !!this.hasAudioTracks || !!this.ebookFile
  }

  get hasAudioTracks() {
    return !!this.includedAudioFiles.length
  }

  /**
   * Supported mime types are sent from the web client and are retrieved using the browser Audio player "canPlayType" function.
   *
   * @param {string[]} supportedMimeTypes
   * @returns {boolean}
   */
  checkCanDirectPlay(supportedMimeTypes) {
    if (!Array.isArray(supportedMimeTypes)) {
      Logger.error(`[Book] checkCanDirectPlay: supportedMimeTypes is not an array`, supportedMimeTypes)
      return false
    }
    return this.includedAudioFiles.every((af) => supportedMimeTypes.includes(af.mimeType))
  }

  /**
   * Get the track list to be used in client audio players
   * AudioTrack is the AudioFile with startOffset, contentUrl and title
   *
   * @param {string} libraryItemId
   * @returns {AudioTrack[]}
   */
  getTracklist(libraryItemId) {
    let startOffset = 0
    return this.includedAudioFiles.map((af) => {
      const track = structuredClone(af)
      track.title = af.metadata.filename
      track.startOffset = startOffset
      track.contentUrl = `/api/items/${libraryItemId}/file/${track.ino}`
      startOffset += track.duration
      return track
    })
  }

  /**
   *
   * @returns {ChapterObject[]}
   */
  getChapters() {
    return structuredClone(this.chapters) || []
  }

  getPlaybackTitle() {
    return this.title
  }

  getPlaybackAuthor() {
    return this.authorName
  }

  getPlaybackDuration() {
    return this.duration
  }

  /**
   * Total file size of all audio files and ebook file
   *
   * @returns {number}
   */
  get size() {
    let total = 0
    this.audioFiles.forEach((af) => (total += af.metadata.size))
    if (this.ebookFile) {
      total += this.ebookFile.metadata.size
    }
    return total
  }

  getAbsMetadataJson() {
    return {
      tags: this.tags || [],
      chapters: this.chapters?.map((c) => ({ ...c })) || [],
      title: this.title,
      subtitle: this.subtitle,
      authors: this.authors.map((a) => a.name),
      narrators: this.narrators,
      series: this.series.map((se) => {
        const sequence = se.bookSeries?.sequence || ''
        if (!sequence) return se.name
        return `${se.name} #${sequence}`
      }),
      genres: this.genres || [],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: !!this.explicit,
      abridged: !!this.abridged
    }
  }

  /**
   *
   * @param {Object} payload - old book object
   * @returns {Promise<boolean>}
   */
  async updateFromRequest(payload) {
    if (!payload) return false

    let hasUpdates = false

    if (payload.metadata) {
      const metadataStringKeys = ['title', 'subtitle', 'publishedYear', 'publishedDate', 'publisher', 'description', 'isbn', 'asin', 'language']
      metadataStringKeys.forEach((key) => {
        if (typeof payload.metadata[key] == 'number') {
          payload.metadata[key] = String(payload.metadata[key])
        }

        if ((typeof payload.metadata[key] === 'string' || payload.metadata[key] === null) && this[key] !== payload.metadata[key]) {
          // Sanitize description HTML
          if (key === 'description' && payload.metadata[key]) {
            const sanitizedDescription = htmlSanitizer.sanitize(payload.metadata[key])
            if (sanitizedDescription !== payload.metadata[key]) {
              Logger.debug(`[Book] "${this.title}" Sanitized description from "${payload.metadata[key]}" to "${sanitizedDescription}"`)
              payload.metadata[key] = sanitizedDescription
            }
          }

          this[key] = payload.metadata[key] || null

          if (key === 'title') {
            this.titleIgnorePrefix = getTitleIgnorePrefix(this.title)
          }

          hasUpdates = true
        }
      })
      if (payload.metadata.explicit !== undefined && this.explicit !== !!payload.metadata.explicit) {
        this.explicit = !!payload.metadata.explicit
        hasUpdates = true
      }
      if (payload.metadata.abridged !== undefined && this.abridged !== !!payload.metadata.abridged) {
        this.abridged = !!payload.metadata.abridged
        hasUpdates = true
      }
      const arrayOfStringsKeys = ['narrators', 'genres']
      arrayOfStringsKeys.forEach((key) => {
        if (Array.isArray(payload.metadata[key]) && !payload.metadata[key].some((item) => typeof item !== 'string') && JSON.stringify(this[key]) !== JSON.stringify(payload.metadata[key])) {
          this[key] = payload.metadata[key]
          this.changed(key, true)
          hasUpdates = true
        }
      })
    }

    if (Array.isArray(payload.tags) && !payload.tags.some((tag) => typeof tag !== 'string') && JSON.stringify(this.tags) !== JSON.stringify(payload.tags)) {
      this.tags = payload.tags
      this.changed('tags', true)
      hasUpdates = true
    }

    // TODO: Remove support for updating audioFiles, chapters and ebookFile here
    const arrayOfObjectsKeys = ['audioFiles', 'chapters']
    arrayOfObjectsKeys.forEach((key) => {
      if (Array.isArray(payload[key]) && !payload[key].some((item) => typeof item !== 'object') && JSON.stringify(this[key]) !== JSON.stringify(payload[key])) {
        this[key] = payload[key]
        this.changed(key, true)
        hasUpdates = true
      }
    })
    if (payload.ebookFile && JSON.stringify(this.ebookFile) !== JSON.stringify(payload.ebookFile)) {
      this.ebookFile = payload.ebookFile
      this.changed('ebookFile', true)
      hasUpdates = true
    }

    if (hasUpdates) {
      Logger.debug(`[Book] "${this.title}" changed keys:`, this.changed())
      await this.save()
    }

    return hasUpdates
  }

  /**
   * Creates or removes authors from the book using the author names from the request
   *
   * @param {string[]} authors
   * @param {string} libraryId
   * @returns {Promise<{authorsRemoved: import('./Author')[], authorsAdded: import('./Author')[]}>}
   */
  async updateAuthorsFromRequest(authors, libraryId) {
    if (!Array.isArray(authors)) return null

    if (!this.authors) {
      throw new Error(`[Book] Cannot update authors because authors are not loaded for book ${this.id}`)
    }

    /** @type {typeof import('./Author')} */
    const authorModel = this.sequelize.models.author

    /** @type {typeof import('./BookAuthor')} */
    const bookAuthorModel = this.sequelize.models.bookAuthor

    const authorsCleaned = authors.map((a) => a.toLowerCase()).filter((a) => a)
    const authorsRemoved = this.authors.filter((au) => !authorsCleaned.includes(au.name.toLowerCase()))
    const newAuthorNames = authors.filter((a) => !this.authors.some((au) => au.name.toLowerCase() === a.toLowerCase()))

    for (const author of authorsRemoved) {
      await bookAuthorModel.removeByIds(author.id, this.id)
      Logger.debug(`[Book] "${this.title}" Removed author "${author.name}"`)
      this.authors = this.authors.filter((au) => au.id !== author.id)
    }
    const authorsAdded = []
    for (const authorName of newAuthorNames) {
      const author = await authorModel.findOrCreateByNameAndLibrary(authorName, libraryId)
      await bookAuthorModel.create({ bookId: this.id, authorId: author.id })
      Logger.debug(`[Book] "${this.title}" Added author "${author.name}"`)
      this.authors.push(author)
      authorsAdded.push(author)
    }

    return {
      authorsRemoved,
      authorsAdded
    }
  }

  /**
   * Creates or removes series from the book using the series names from the request.
   * Updates series sequence if it has changed.
   *
   * @param {{ name: string, sequence: string }[]} seriesObjects
   * @param {string} libraryId
   * @returns {Promise<{seriesRemoved: import('./Series')[], seriesAdded: import('./Series')[], hasUpdates: boolean}>}
   */
  async updateSeriesFromRequest(seriesObjects, libraryId) {
    if (!Array.isArray(seriesObjects) || seriesObjects.some((se) => !se.name || typeof se.name !== 'string')) return null

    if (!this.series) {
      throw new Error(`[Book] Cannot update series because series are not loaded for book ${this.id}`)
    }

    /** @type {typeof import('./Series')} */
    const seriesModel = this.sequelize.models.series

    /** @type {typeof import('./BookSeries')} */
    const bookSeriesModel = this.sequelize.models.bookSeries

    const seriesNamesCleaned = seriesObjects.map((se) => se.name.toLowerCase())
    const seriesRemoved = this.series.filter((se) => !seriesNamesCleaned.includes(se.name.toLowerCase()))
    const seriesAdded = []
    let hasUpdates = false
    for (const seriesObj of seriesObjects) {
      const seriesObjSequence = typeof seriesObj.sequence === 'string' ? seriesObj.sequence : null

      const existingSeries = this.series.find((se) => se.name.toLowerCase() === seriesObj.name.toLowerCase())
      if (existingSeries) {
        if (existingSeries.bookSeries.sequence !== seriesObjSequence) {
          existingSeries.bookSeries.sequence = seriesObjSequence
          await existingSeries.bookSeries.save()
          hasUpdates = true
          Logger.debug(`[Book] "${this.title}" Updated series "${existingSeries.name}" sequence ${seriesObjSequence}`)
        }
      } else {
        const series = await seriesModel.findOrCreateByNameAndLibrary(seriesObj.name, libraryId)
        series.bookSeries = await bookSeriesModel.create({ bookId: this.id, seriesId: series.id, sequence: seriesObjSequence })
        this.series.push(series)
        seriesAdded.push(series)
        hasUpdates = true
        Logger.debug(`[Book] "${this.title}" Added series "${series.name}"`)
      }
    }

    for (const series of seriesRemoved) {
      await bookSeriesModel.removeByIds(series.id, this.id)
      this.series = this.series.filter((se) => se.id !== series.id)
      Logger.debug(`[Book] "${this.title}" Removed series ${series.id}`)
      hasUpdates = true
    }

    return {
      seriesRemoved,
      seriesAdded,
      hasUpdates
    }
  }

  /**
   * Old model kept metadata in a separate object
   */
  oldMetadataToJSON() {
    const authors = this.authors.map((au) => ({ id: au.id, name: au.name }))
    const series = this.series.map((se) => ({ id: se.id, name: se.name, sequence: se.bookSeries.sequence }))
    return {
      title: this.title,
      subtitle: this.subtitle,
      authors,
      narrators: [...(this.narrators || [])],
      series,
      genres: [...(this.genres || [])],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged
    }
  }

  oldMetadataToJSONMinified() {
    return {
      title: this.title,
      titleIgnorePrefix: getTitlePrefixAtEnd(this.title),
      subtitle: this.subtitle,
      authorName: this.authorName,
      authorNameLF: this.authorNameLF,
      narratorName: (this.narrators || []).join(', '),
      seriesName: this.seriesName,
      genres: [...(this.genres || [])],
      publishedYear: this.publishedYear,
      publishedDate: this.publishedDate,
      publisher: this.publisher,
      description: this.description,
      isbn: this.isbn,
      asin: this.asin,
      language: this.language,
      explicit: this.explicit,
      abridged: this.abridged
    }
  }

  oldMetadataToJSONExpanded() {
    const oldMetadataJSON = this.oldMetadataToJSON()
    oldMetadataJSON.titleIgnorePrefix = getTitlePrefixAtEnd(this.title)
    oldMetadataJSON.authorName = this.authorName
    oldMetadataJSON.authorNameLF = this.authorNameLF
    oldMetadataJSON.narratorName = (this.narrators || []).join(', ')
    oldMetadataJSON.seriesName = this.seriesName
    oldMetadataJSON.descriptionPlain = this.description ? htmlSanitizer.stripAllTags(this.description) : null
    return oldMetadataJSON
  }

  /**
   * The old model stored a minified series and authors array with the book object.
   * Minified series is { id, name, sequence }
   * Minified author is { id, name }
   *
   * @param {string} libraryItemId
   */
  toOldJSON(libraryItemId) {
    if (!libraryItemId) {
      throw new Error(`[Book] Cannot convert to old JSON because libraryItemId is not provided`)
    }
    if (!this.authors) {
      throw new Error(`[Book] Cannot convert to old JSON because authors are not loaded`)
    }
    if (!this.series) {
      throw new Error(`[Book] Cannot convert to old JSON because series are not loaded`)
    }

    return {
      id: this.id,
      libraryItemId: libraryItemId,
      metadata: this.oldMetadataToJSON(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      audioFiles: structuredClone(this.audioFiles),
      chapters: structuredClone(this.chapters),
      ebookFile: structuredClone(this.ebookFile)
    }
  }

  toOldJSONMinified() {
    if (!this.authors) {
      throw new Error(`[Book] Cannot convert to old JSON because authors are not loaded`)
    }
    if (!this.series) {
      throw new Error(`[Book] Cannot convert to old JSON because series are not loaded`)
    }

    return {
      id: this.id,
      metadata: this.oldMetadataToJSONMinified(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      numTracks: this.includedAudioFiles.length,
      numAudioFiles: this.audioFiles?.length || 0,
      numChapters: this.chapters?.length || 0,
      duration: this.duration,
      size: this.size,
      ebookFormat: this.ebookFile?.ebookFormat
    }
  }

  toOldJSONExpanded(libraryItemId) {
    if (!libraryItemId) {
      throw new Error(`[Book] Cannot convert to old JSON because libraryItemId is not provided`)
    }
    if (!this.authors) {
      throw new Error(`[Book] Cannot convert to old JSON because authors are not loaded`)
    }
    if (!this.series) {
      throw new Error(`[Book] Cannot convert to old JSON because series are not loaded`)
    }

    return {
      id: this.id,
      libraryItemId: libraryItemId,
      metadata: this.oldMetadataToJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      audioFiles: structuredClone(this.audioFiles),
      chapters: structuredClone(this.chapters),
      ebookFile: structuredClone(this.ebookFile),
      duration: this.duration,
      size: this.size,
      tracks: this.getTracklist(libraryItemId)
    }
  }
}

module.exports = Book
