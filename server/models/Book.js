const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')

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

    /** @type {import('./Author')[]} - optional if expanded */
    this.authors
  }

  static getOldBook(libraryItemExpanded) {
    const bookExpanded = libraryItemExpanded.media
    let authors = []
    if (bookExpanded.authors?.length) {
      authors = bookExpanded.authors.map((au) => {
        return {
          id: au.id,
          name: au.name
        }
      })
    } else if (bookExpanded.bookAuthors?.length) {
      authors = bookExpanded.bookAuthors
        .map((ba) => {
          if (ba.author) {
            return {
              id: ba.author.id,
              name: ba.author.name
            }
          } else {
            Logger.error(`[Book] Invalid bookExpanded bookAuthors: no author`, ba)
            return null
          }
        })
        .filter((a) => a)
    }

    let series = []
    if (bookExpanded.series?.length) {
      series = bookExpanded.series.map((se) => {
        return {
          id: se.id,
          name: se.name,
          sequence: se.bookSeries.sequence
        }
      })
    } else if (bookExpanded.bookSeries?.length) {
      series = bookExpanded.bookSeries
        .map((bs) => {
          if (bs.series) {
            return {
              id: bs.series.id,
              name: bs.series.name,
              sequence: bs.sequence
            }
          } else {
            Logger.error(`[Book] Invalid bookExpanded bookSeries: no series`, bs)
            return null
          }
        })
        .filter((s) => s)
    }

    return {
      id: bookExpanded.id,
      libraryItemId: libraryItemExpanded.id,
      coverPath: bookExpanded.coverPath,
      tags: bookExpanded.tags,
      audioFiles: bookExpanded.audioFiles,
      chapters: bookExpanded.chapters,
      ebookFile: bookExpanded.ebookFile,
      metadata: {
        title: bookExpanded.title,
        subtitle: bookExpanded.subtitle,
        authors: authors,
        narrators: bookExpanded.narrators,
        series: series,
        genres: bookExpanded.genres,
        publishedYear: bookExpanded.publishedYear,
        publishedDate: bookExpanded.publishedDate,
        publisher: bookExpanded.publisher,
        description: bookExpanded.description,
        isbn: bookExpanded.isbn,
        asin: bookExpanded.asin,
        language: bookExpanded.language,
        explicit: bookExpanded.explicit,
        abridged: bookExpanded.abridged
      }
    }
  }

  /**
   * @param {object} oldBook
   * @returns {boolean} true if updated
   */
  static saveFromOld(oldBook) {
    const book = this.getFromOld(oldBook)
    return this.update(book, {
      where: {
        id: book.id
      }
    })
      .then((result) => result[0] > 0)
      .catch((error) => {
        Logger.error(`[Book] Failed to save book ${book.id}`, error)
        return false
      })
  }

  static getFromOld(oldBook) {
    return {
      id: oldBook.id,
      title: oldBook.metadata.title,
      titleIgnorePrefix: oldBook.metadata.titleIgnorePrefix,
      subtitle: oldBook.metadata.subtitle,
      publishedYear: oldBook.metadata.publishedYear,
      publishedDate: oldBook.metadata.publishedDate,
      publisher: oldBook.metadata.publisher,
      description: oldBook.metadata.description,
      isbn: oldBook.metadata.isbn,
      asin: oldBook.metadata.asin,
      language: oldBook.metadata.language,
      explicit: !!oldBook.metadata.explicit,
      abridged: !!oldBook.metadata.abridged,
      narrators: oldBook.metadata.narrators,
      ebookFile: oldBook.ebookFile?.toJSON() || null,
      coverPath: oldBook.coverPath,
      duration: oldBook.duration,
      audioFiles: oldBook.audioFiles?.map((af) => af.toJSON()) || [],
      chapters: oldBook.chapters,
      tags: oldBook.tags,
      genres: oldBook.metadata.genres
    }
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
          }
          // {
          //   fields: ['duration']
          // }
        ]
      }
    )
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
  get includedAudioFiles() {
    return this.audioFiles.filter((af) => !af.exclude)
  }
  get trackList() {
    let startOffset = 0
    return this.includedAudioFiles.map((af) => {
      const track = structuredClone(af)
      track.startOffset = startOffset
      startOffset += track.duration
      return track
    })
  }
}

module.exports = Book
