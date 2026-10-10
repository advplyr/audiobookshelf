import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import type Author from './Author'
import type Series from './Series'
import type BookSeries from './BookSeries'
import type BookAuthor from './BookAuthor'
import type LibraryItem from './LibraryItem'
import type AudioFile from '../objects/files/AudioFile'
import type EBookFile from '../objects/files/EBookFile'
import Logger from '../Logger'
import { getTitlePrefixAtEnd, getTitleIgnorePrefix } from '../utils'
import * as parseNameString from '../utils/parsers/parseNameString'
import htmlSanitizer from '../utils/htmlSanitizer'
import libraryItemsBookFilters from '../utils/queries/libraryItemsBookFilters'
import SocketAuthority from '../SocketAuthority'

type AudioFileJSON = ReturnType<AudioFile['toJSON']>
// Historical file JSON may omit fields added by later versions.
type AudioFileObject = Partial<Omit<AudioFileJSON, 'metadata'>> & { metadata: Partial<AudioFileJSON['metadata']> }
type EBookFileJSON = ReturnType<EBookFile['toJSON']>
type StoredEBookFile = Partial<Omit<EBookFileJSON, 'metadata'>> & { metadata: Partial<EBookFileJSON['metadata']> }
// Scanners pass a complete file to the ebook parsers; persisted historical JSON can be partial.
type EBookFileObject = {
  ino: string
  ebookFormat: string
  addedAt: number
  updatedAt: number
  metadata: { filename: string; ext: string; path: string; relPath: string; size: number; mtimeMs: number; ctimeMs: number; birthtimeMs: number }
}
type ChapterObject = { id: number; start: number; end: number; title: string }
type AudioTrackProperties = { title: string | null | undefined; contentUrl: string; startOffset: number }
type AudioTrack = AudioFileObject & AudioTrackProperties
type SeriesExpandedProperties = { bookSeries?: BookSeries }
type SeriesExpanded = Series & SeriesExpandedProperties
type BookExpandedProperties = { authors: Author[]; series: SeriesExpanded[] }
type BookExpanded = Book & BookExpandedProperties
type BookExpandedWithLibraryItemProperties = { libraryItem: LibraryItem }
type BookExpandedWithLibraryItem = BookExpanded & BookExpandedWithLibraryItemProperties
type BookRequest = { metadata?: Record<string, unknown>; tags?: unknown }
type ExpandedMetadata = ReturnType<Book['oldMetadataToJSON']> & {
  titleIgnorePrefix?: string | null | undefined
  authorName?: string
  authorNameLF?: string
  narratorName?: string
  seriesName?: string
  descriptionPlain?: string | null
}
type BookAttributes = {
  id: string
  title: string | null
  titleIgnorePrefix: string | null
  subtitle: string | null
  publishedYear: string | null
  publishedDate: string | null
  publisher: string | null
  description: string | null
  isbn: string | null
  asin: string | null
  language: string | null
  coverPath: string | null
  explicit: boolean | null
  abridged: boolean | null
  duration: number | null
  narrators: string[] | null
  tags: string[] | null
  genres: string[] | null
  audioFiles: AudioFileObject[] | null
  ebookFile: StoredEBookFile | null
  chapters: ChapterObject[] | null
  createdAt?: Date
  updatedAt?: Date
}
type BookCreation = Optional<BookAttributes, keyof BookAttributes>

class Book extends Model<BookAttributes, BookCreation> {
  declare id: string
  declare title: string | null
  declare titleIgnorePrefix: string | null
  declare subtitle: string | null
  declare publishedYear: string | null
  declare publishedDate: string | null
  declare publisher: string | null
  declare description: string | null
  declare isbn: string | null
  declare asin: string | null
  declare language: string | null
  declare coverPath: string | null
  declare explicit: boolean | null
  declare abridged: boolean | null
  declare duration: number | null
  declare narrators: string[] | null
  declare tags: string[] | null
  declare genres: string[] | null
  declare audioFiles: AudioFileObject[] | null
  declare ebookFile: StoredEBookFile | null
  declare chapters: ChapterObject[] | null
  declare createdAt: Date
  declare updatedAt: Date
  declare libraryItem?: LibraryItem
  declare authors?: Author[]
  declare series?: SeriesExpanded[]

  constructor(values?: BookCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  // Keep Sequelize's inherited static contract; application initialization uses one argument.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS, attributes: ModelAttributes<M, Partial<Attributes<M>>>, options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels always supplies the Sequelize instance.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof Book, Book>(
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

    Book.addHook('afterDestroy', () => {
      libraryItemsBookFilters.clearCountCache('afterDestroy')
      return Promise.resolve()
    })

    Book.addHook('afterCreate', () => {
      libraryItemsBookFilters.clearCountCache('afterCreate')
      return Promise.resolve()
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
    // File-dependent operations require loaded audio file JSON, as before migration.
    return this.audioFiles!.filter((af) => !af.exclude)
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
  checkCanDirectPlay(supportedMimeTypes: unknown) {
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
  getTracklist(libraryItemId: string) {
    let startOffset = 0
    return this.includedAudioFiles.map((af) => {
      const track = structuredClone(af) as AudioTrack
      track.title = af.metadata.filename
      track.startOffset = startOffset
      track.contentUrl = `/api/items/${libraryItemId}/file/${track.ino}`
      // Retain native addition for legacy JSON (null, missing fields and string coercion).
      startOffset += track.duration as number
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
    // Keep native addition rather than normalizing historical JSON values.
    this.audioFiles!.forEach((af) => (total += af.metadata.size as number))
    if (this.ebookFile) {
      total += this.ebookFile.metadata.size as number
    }
    return total
  }

  getAbsMetadataJson() {
    return {
      tags: this.tags || [],
      chapters: this.chapters?.map((c) => ({ ...c })) || [],
      title: this.title,
      subtitle: this.subtitle,
      authors: this.authors!.map((a) => a.name),
      narrators: this.narrators,
      series: this.series!.map((se) => {
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
  async updateFromRequest(payload: BookRequest | null | undefined) {
    if (!payload) return false

    let hasUpdates = false

    if (payload.metadata) {
      const metadata = payload.metadata
      const metadataStringKeys = ['title', 'subtitle', 'publishedYear', 'publishedDate', 'publisher', 'description', 'isbn', 'asin', 'language'] as const
      metadataStringKeys.forEach((key) => {
        if (typeof metadata[key] == 'number') {
          metadata[key] = String(metadata[key])
        }

        if ((typeof metadata[key] === 'string' || metadata[key] === null) && this[key] !== metadata[key]) {
          // Sanitize description HTML
          if (key === 'description' && metadata[key]) {
            const sanitizedDescription = htmlSanitizer.sanitize(metadata[key])
            if (sanitizedDescription !== metadata[key]) {
              Logger.debug(`[Book] "${this.title}" Sanitized description from "${metadata[key]}" to "${sanitizedDescription}"`)
              metadata[key] = sanitizedDescription
            }
          }

          this[key] = (metadata[key] as string | null) || null

          if (key === 'title') {
            this.titleIgnorePrefix = getTitleIgnorePrefix(this.title)
          }

          hasUpdates = true
        }
      })
      if (metadata.explicit !== undefined && this.explicit !== !!metadata.explicit) {
        this.explicit = !!metadata.explicit
        hasUpdates = true
      }
      if (metadata.abridged !== undefined && this.abridged !== !!metadata.abridged) {
        this.abridged = !!metadata.abridged
        hasUpdates = true
      }
      const arrayOfStringsKeys = ['narrators', 'genres'] as const
      arrayOfStringsKeys.forEach((key) => {
        if (Array.isArray(metadata[key]) && !metadata[key].some((item) => typeof item !== 'string') && JSON.stringify(this[key]) !== JSON.stringify(metadata[key])) {
          // Every array element was checked above.
          this[key] = metadata[key] as string[]
          this.changed(key, true)
          hasUpdates = true
        }
      })
    }

    if (Array.isArray(payload.tags) && !payload.tags.some((tag) => typeof tag !== 'string') && JSON.stringify(this.tags) !== JSON.stringify(payload.tags)) {
      // Every array element was checked above.
      this.tags = payload.tags as string[]
      this.changed('tags', true)
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
  async updateAuthorsFromRequest(authors: string[] | null | undefined, libraryId: string) {
    if (!Array.isArray(authors)) return null

    if (!this.authors) {
      throw new Error(`[Book] Cannot update authors because authors are not loaded for book ${this.id}`)
    }

    /** @type {typeof import('./Author')} */
    const authorModel = this.sequelize.models.author as typeof Author

    /** @type {typeof import('./BookAuthor')} */
    const bookAuthorModel = this.sequelize.models.bookAuthor as typeof BookAuthor

    const authorsCleaned = authors.map((a) => a.toLowerCase()).filter((a) => a)
    const authorsRemoved = this.authors.filter((au) => !authorsCleaned.includes(au.name!.toLowerCase()))
    const newAuthorNames = authors.filter((a) => !this.authors!.some((au) => au.name!.toLowerCase() === a.toLowerCase()))

    for (const author of authorsRemoved) {
      await bookAuthorModel.removeByIds(author.id, this.id)
      const numBooks = await bookAuthorModel.getCountForAuthor(author.id)
      if (numBooks > 0) {
        SocketAuthority.emitter('author_updated', author.toOldJSONExpanded(numBooks))
      }
      Logger.debug(`[Book] "${this.title}" Removed author "${author.name}"`)
      this.authors = this.authors.filter((au) => au.id !== author.id)
    }
    const authorsAdded: Author[] = []
    for (const authorName of newAuthorNames) {
      const { author, created } = await authorModel.findOrCreateByNameAndLibrary(authorName, libraryId)
      await bookAuthorModel.create({ bookId: this.id, authorId: author.id })
      if (created) {
        SocketAuthority.emitter('author_added', author.toOldJSON())
      } else {
        const numBooks = await bookAuthorModel.getCountForAuthor(author.id)
        SocketAuthority.emitter('author_updated', author.toOldJSONExpanded(numBooks))
      }
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
  async updateSeriesFromRequest(seriesObjects: { name: string; sequence?: unknown }[] | null | undefined, libraryId: string) {
    if (!Array.isArray(seriesObjects) || seriesObjects.some((se) => !se.name || typeof se.name !== 'string')) return null

    if (!this.series) {
      throw new Error(`[Book] Cannot update series because series are not loaded for book ${this.id}`)
    }

    /** @type {typeof import('./Series')} */
    const seriesModel = this.sequelize.models.series as typeof Series

    /** @type {typeof import('./BookSeries')} */
    const bookSeriesModel = this.sequelize.models.bookSeries as typeof BookSeries

    const seriesNamesCleaned = seriesObjects.map((se) => se.name.toLowerCase())
    const seriesRemoved = this.series.filter((se) => !seriesNamesCleaned.includes(se.name!.toLowerCase()))
    const seriesAdded: SeriesExpanded[] = []
    let hasUpdates = false
    for (const seriesObj of seriesObjects) {
      const seriesObjSequence = typeof seriesObj.sequence === 'string' ? seriesObj.sequence : null

      const existingSeries = this.series.find((se) => se.name!.toLowerCase() === seriesObj.name.toLowerCase())
      if (existingSeries) {
        if (existingSeries.bookSeries!.sequence !== seriesObjSequence) {
          existingSeries.bookSeries!.sequence = seriesObjSequence
          await existingSeries.bookSeries!.save()
          hasUpdates = true
          Logger.debug(`[Book] "${this.title}" Updated series "${existingSeries.name}" sequence ${seriesObjSequence}`)
        }
      } else {
        const series: SeriesExpanded = await seriesModel.findOrCreateByNameAndLibrary(seriesObj.name, libraryId)
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
    const authors = this.authors!.map((au) => ({ id: au.id, name: au.name }))
    const series = this.series!.map((se) => ({ id: se.id, name: se.name, sequence: se.bookSeries!.sequence }))
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
    const oldMetadataJSON: ExpandedMetadata = this.oldMetadataToJSON()
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
  toOldJSON(libraryItemId: string) {
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

  /**
   * Minified book JSON for list/shelf endpoints.
   * `toOldJSONExpanded()` must be a strict superset: every key here must exist in expanded
   * with the same value semantics. Only additive changes to expanded; never remove or rename keys.
   */
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

  /**
   * Expanded book JSON for item detail and socket events.
   * Must be a strict superset of `toOldJSONMinified()` — built by spreading minified, then adding expanded-only fields.
   *
   * @param {string} libraryItemId
   */
  toOldJSONExpanded(libraryItemId: string) {
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
      ...this.toOldJSONMinified(),
      libraryItemId,
      metadata: this.oldMetadataToJSONExpanded(),
      audioFiles: structuredClone(this.audioFiles),
      chapters: structuredClone(this.chapters),
      ebookFile: structuredClone(this.ebookFile),
      tracks: this.getTracklist(libraryItemId)
    }
  }
}

declare namespace Book {
  export type { EBookFileObject, ChapterObject, SeriesExpandedProperties, SeriesExpanded, BookExpandedProperties, BookExpanded, BookExpandedWithLibraryItemProperties, BookExpandedWithLibraryItem, AudioFileObject, AudioTrackProperties, AudioTrack }
}

export = Book
