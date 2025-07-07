const Path = require('path')
const { DataTypes, Model } = require('sequelize')
const fsExtra = require('../libs/fsExtra')
const Logger = require('../Logger')
const libraryFilters = require('../utils/queries/libraryFilters')
const { filePathToPOSIX, getFileTimestampsWithIno } = require('../utils/fileUtils')
const LibraryFile = require('../objects/files/LibraryFile')
const Book = require('./Book')
const Podcast = require('./Podcast')

/**
 * @typedef LibraryFileObject
 * @property {string} ino
 * @property {boolean} isSupplementary
 * @property {number} addedAt
 * @property {number} updatedAt
 * @property {{filename:string, ext:string, path:string, relPath:string, size:number, mtimeMs:number, ctimeMs:number, birthtimeMs:number}} metadata
 */

/**
 * @typedef LibraryItemExpandedProperties
 * @property {Book.BookExpanded|Podcast.PodcastExpanded} media
 *
 * @typedef {LibraryItem & LibraryItemExpandedProperties} LibraryItemExpanded
 */

class LibraryItem extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.ino
    /** @type {string} */
    this.path
    /** @type {string} */
    this.relPath
    /** @type {string} */
    this.mediaId
    /** @type {string} */
    this.mediaType
    /** @type {boolean} */
    this.isFile
    /** @type {boolean} */
    this.isMissing
    /** @type {boolean} */
    this.isInvalid
    /** @type {Date} */
    this.mtime
    /** @type {Date} */
    this.ctime
    /** @type {Date} */
    this.birthtime
    /** @type {BigInt} */
    this.size
    /** @type {Date} */
    this.lastScan
    /** @type {string} */
    this.lastScanVersion
    /** @type {LibraryFileObject[]} */
    this.libraryFiles
    /** @type {Object} */
    this.extraData
    /** @type {string} */
    this.libraryId
    /** @type {string} */
    this.libraryFolderId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt

    /** @type {Book.BookExpanded|Podcast.PodcastExpanded} - only set when expanded */
    this.media
    /** @type {string} */
    this.title // Only used for sorting
    /** @type {string} */
    this.titleIgnorePrefix // Only used for sorting
    /** @type {string} */
    this.authorNamesFirstLast // Only used for sorting
    /** @type {string} */
    this.authorNamesLastFirst // Only used for sorting
  }

  /**
   * Gets library items partially expanded, not including podcast episodes
   * @todo temporary solution
   *
   * @param {number} offset
   * @param {number} limit
   * @returns {Promise<LibraryItem[]>} LibraryItem
   */
  static getLibraryItemsIncrement(offset, limit, where = null) {
    return this.findAll({
      where,
      include: [
        {
          model: this.sequelize.models.book,
          include: [
            {
              model: this.sequelize.models.author,
              through: {
                attributes: ['createdAt']
              }
            },
            {
              model: this.sequelize.models.series,
              through: {
                attributes: ['id', 'sequence', 'createdAt']
              }
            }
          ]
        },
        {
          model: this.sequelize.models.podcast
        }
      ],
      order: [
        ['createdAt', 'ASC'],
        // Ensure author & series stay in the same order
        [this.sequelize.models.book, this.sequelize.models.author, this.sequelize.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize.models.book, this.sequelize.models.series, 'bookSeries', 'createdAt', 'ASC']
      ],
      offset,
      limit
    })
  }

  /**
   * Remove library item by id
   *
   * @param {string} libraryItemId
   * @returns {Promise<number>} The number of destroyed rows
   */
  static removeById(libraryItemId) {
    return this.destroy({
      where: {
        id: libraryItemId
      },
      individualHooks: true
    })
  }

  /**
   *
   * @param {import('sequelize').WhereOptions} where
   * @returns {Promise<LibraryItemExpanded[]>}
   */
  static async findAllExpandedWhere(where = null) {
    return this.findAll({
      where,
      include: [
        {
          model: this.sequelize.models.book,
          include: [
            {
              model: this.sequelize.models.author,
              through: {
                attributes: []
              }
            },
            {
              model: this.sequelize.models.series,
              through: {
                attributes: ['id', 'sequence']
              }
            }
          ]
        },
        {
          model: this.sequelize.models.podcast,
          include: {
            model: this.sequelize.models.podcastEpisode
          }
        }
      ],
      order: [
        // Ensure author & series stay in the same order
        [this.sequelize.models.book, this.sequelize.models.author, this.sequelize.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize.models.book, this.sequelize.models.series, 'bookSeries', 'createdAt', 'ASC']
      ]
    })
  }

  /**
   *
   * @param {string} libraryItemId
   * @returns {Promise<LibraryItemExpanded>}
   */
  static async getExpandedById(libraryItemId) {
    if (!libraryItemId) return null

    const libraryItem = await this.findByPk(libraryItemId)
    if (!libraryItem) {
      Logger.error(`[LibraryItem] Library item not found with id "${libraryItemId}"`)
      return null
    }

    if (libraryItem.mediaType === 'podcast') {
      libraryItem.media = await libraryItem.getMedia({
        include: [
          {
            model: this.sequelize.models.podcastEpisode
          }
        ]
      })
    } else {
      libraryItem.media = await libraryItem.getMedia({
        include: [
          {
            model: this.sequelize.models.author,
            through: {
              attributes: []
            }
          },
          {
            model: this.sequelize.models.series,
            through: {
              attributes: ['id', 'sequence']
            }
          }
        ],
        order: [
          [this.sequelize.models.author, this.sequelize.models.bookAuthor, 'createdAt', 'ASC'],
          [this.sequelize.models.series, 'bookSeries', 'createdAt', 'ASC']
        ]
      })
    }

    if (!libraryItem.media) return null
    return libraryItem
  }

  /**
   *
   * @param {import('sequelize').WhereOptions} where
   * @param {import('sequelize').BindOrReplacements} [replacements]
   * @param {import('sequelize').IncludeOptions} [include]
   * @returns {Promise<LibraryItemExpanded>}
   */
  static async findOneExpanded(where, replacements = null, include = null) {
    const libraryItem = await this.findOne({
      where,
      replacements,
      include
    })
    if (!libraryItem) {
      return null
    }

    if (libraryItem.mediaType === 'podcast') {
      libraryItem.media = await libraryItem.getMedia({
        include: [
          {
            model: this.sequelize.models.podcastEpisode
          }
        ]
      })
    } else {
      libraryItem.media = await libraryItem.getMedia({
        include: [
          {
            model: this.sequelize.models.author,
            through: {
              attributes: []
            }
          },
          {
            model: this.sequelize.models.series,
            through: {
              attributes: ['id', 'sequence']
            }
          }
        ],
        order: [
          [this.sequelize.models.author, this.sequelize.models.bookAuthor, 'createdAt', 'ASC'],
          [this.sequelize.models.series, 'bookSeries', 'createdAt', 'ASC']
        ]
      })
    }

    if (!libraryItem.media) return null
    return libraryItem
  }

  /**
   * Get library items using filter and sort
   * @param {import('./Library')} library
   * @param {import('./User')} user
   * @param {object} options
   * @returns {{ libraryItems:Object[], count:number }}
   */
  static async getByFilterAndSort(library, user, options) {
    let start = Date.now()
    const { libraryItems, count } = await libraryFilters.getFilteredLibraryItems(library.id, user, options)
    Logger.debug(`Loaded ${libraryItems.length} of ${count} items for libary page in ${((Date.now() - start) / 1000).toFixed(2)}s`)

    return {
      libraryItems: libraryItems.map((li) => {
        const oldLibraryItem = li.toOldJSONMinified()
        if (li.collapsedSeries) {
          oldLibraryItem.collapsedSeries = li.collapsedSeries
        }
        if (li.series) {
          oldLibraryItem.media.metadata.series = li.series
        }
        if (li.rssFeed) {
          oldLibraryItem.rssFeed = li.rssFeed.toOldJSONMinified()
        }
        if (li.media.numEpisodes) {
          oldLibraryItem.media.numEpisodes = li.media.numEpisodes
        }
        if (li.size && !oldLibraryItem.media.size) {
          oldLibraryItem.media.size = li.size
        }
        if (li.numEpisodesIncomplete) {
          oldLibraryItem.numEpisodesIncomplete = li.numEpisodesIncomplete
        }
        if (li.mediaItemShare) {
          oldLibraryItem.mediaItemShare = li.mediaItemShare
        }

        return oldLibraryItem
      }),
      count
    }
  }

  /**
   * Get home page data personalized shelves
   * @param {import('./Library')} library
   * @param {import('./User')} user
   * @param {string[]} include
   * @param {number} limit
   * @returns {object[]} array of shelf objects
   */
  static async getPersonalizedShelves(library, user, include, limit) {
    const fullStart = Date.now() // Used for testing load times

    const shelves = []

    // "Continue Listening" shelf
    const itemsInProgressPayload = await libraryFilters.getMediaItemsInProgress(library, user, include, limit, false)
    if (itemsInProgressPayload.items.length) {
      const ebookOnlyItemsInProgress = itemsInProgressPayload.items.filter((li) => li.media.ebookFormat && !li.media.numTracks)
      const audioItemsInProgress = itemsInProgressPayload.items.filter((li) => li.media.numTracks || li.mediaType === 'podcast')

      if (audioItemsInProgress.length) {
        shelves.push({
          id: 'continue-listening',
          label: 'Continue Listening',
          labelStringKey: 'LabelContinueListening',
          type: library.isPodcast ? 'episode' : 'book',
          entities: audioItemsInProgress,
          total: itemsInProgressPayload.count
        })
      }

      if (ebookOnlyItemsInProgress.length) {
        // "Continue Reading" shelf
        shelves.push({
          id: 'continue-reading',
          label: 'Continue Reading',
          labelStringKey: 'LabelContinueReading',
          type: 'book',
          entities: ebookOnlyItemsInProgress,
          total: itemsInProgressPayload.count
        })
      }
    }
    Logger.debug(`Loaded ${itemsInProgressPayload.items.length} of ${itemsInProgressPayload.count} items for "Continue Listening/Reading" in ${((Date.now() - fullStart) / 1000).toFixed(2)}s`)

    let start = Date.now()
    if (library.isBook) {
      start = Date.now()
      // "Continue Series" shelf
      const continueSeriesPayload = await libraryFilters.getLibraryItemsContinueSeries(library, user, include, limit)
      if (continueSeriesPayload.libraryItems.length) {
        shelves.push({
          id: 'continue-series',
          label: 'Continue Series',
          labelStringKey: 'LabelContinueSeries',
          type: 'book',
          entities: continueSeriesPayload.libraryItems,
          total: continueSeriesPayload.count
        })
      }
      Logger.debug(`Loaded ${continueSeriesPayload.libraryItems.length} of ${continueSeriesPayload.count} items for "Continue Series" in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    } else if (library.isPodcast) {
      // "Newest Episodes" shelf
      const newestEpisodesPayload = await libraryFilters.getNewestPodcastEpisodes(library, user, limit)
      if (newestEpisodesPayload.libraryItems.length) {
        shelves.push({
          id: 'newest-episodes',
          label: 'Newest Episodes',
          labelStringKey: 'LabelNewestEpisodes',
          type: 'episode',
          entities: newestEpisodesPayload.libraryItems,
          total: newestEpisodesPayload.count
        })
      }
      Logger.debug(`Loaded ${newestEpisodesPayload.libraryItems.length} of ${newestEpisodesPayload.count} episodes for "Newest Episodes" in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    }

    start = Date.now()
    // "Recently Added" shelf
    const mostRecentPayload = await libraryFilters.getLibraryItemsMostRecentlyAdded(library, user, include, limit)
    if (mostRecentPayload.libraryItems.length) {
      shelves.push({
        id: 'recently-added',
        label: 'Recently Added',
        labelStringKey: 'LabelRecentlyAdded',
        type: library.mediaType,
        entities: mostRecentPayload.libraryItems,
        total: mostRecentPayload.count
      })
    }
    Logger.debug(`Loaded ${mostRecentPayload.libraryItems.length} of ${mostRecentPayload.count} items for "Recently Added" in ${((Date.now() - start) / 1000).toFixed(2)}s`)

    if (library.isBook) {
      start = Date.now()
      // "Recent Series" shelf
      const seriesMostRecentPayload = await libraryFilters.getSeriesMostRecentlyAdded(library, user, include, 5)
      if (seriesMostRecentPayload.series.length) {
        shelves.push({
          id: 'recent-series',
          label: 'Recent Series',
          labelStringKey: 'LabelRecentSeries',
          type: 'series',
          entities: seriesMostRecentPayload.series,
          total: seriesMostRecentPayload.count
        })
      }
      Logger.debug(`Loaded ${seriesMostRecentPayload.series.length} of ${seriesMostRecentPayload.count} series for "Recent Series" in ${((Date.now() - start) / 1000).toFixed(2)}s`)

      start = Date.now()
      // "Discover" shelf
      const discoverLibraryItemsPayload = await libraryFilters.getLibraryItemsToDiscover(library, user, include, limit)
      if (discoverLibraryItemsPayload.libraryItems.length) {
        shelves.push({
          id: 'discover',
          label: 'Discover',
          labelStringKey: 'LabelDiscover',
          type: library.mediaType,
          entities: discoverLibraryItemsPayload.libraryItems,
          total: discoverLibraryItemsPayload.count
        })
      }
      Logger.debug(`Loaded ${discoverLibraryItemsPayload.libraryItems.length} of ${discoverLibraryItemsPayload.count} items for "Discover" in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    }

    start = Date.now()
    // "Listen Again" shelf
    const mediaFinishedPayload = await libraryFilters.getMediaFinished(library, user, include, limit)
    if (mediaFinishedPayload.items.length) {
      const ebookOnlyItemsInProgress = mediaFinishedPayload.items.filter((li) => li.media.ebookFormat && !li.media.numTracks)
      const audioItemsInProgress = mediaFinishedPayload.items.filter((li) => li.media.numTracks || li.mediaType === 'podcast')

      if (audioItemsInProgress.length) {
        shelves.push({
          id: 'listen-again',
          label: 'Listen Again',
          labelStringKey: 'LabelListenAgain',
          type: library.isPodcast ? 'episode' : 'book',
          entities: audioItemsInProgress,
          total: mediaFinishedPayload.count
        })
      }

      // "Read Again" shelf
      if (ebookOnlyItemsInProgress.length) {
        shelves.push({
          id: 'read-again',
          label: 'Read Again',
          labelStringKey: 'LabelReadAgain',
          type: 'book',
          entities: ebookOnlyItemsInProgress,
          total: mediaFinishedPayload.count
        })
      }
    }
    Logger.debug(`Loaded ${mediaFinishedPayload.items.length} of ${mediaFinishedPayload.count} items for "Listen/Read Again" in ${((Date.now() - start) / 1000).toFixed(2)}s`)

    if (library.isBook) {
      start = Date.now()
      // "Newest Authors" shelf
      const newestAuthorsPayload = await libraryFilters.getNewestAuthors(library, user, limit)
      if (newestAuthorsPayload.authors.length) {
        shelves.push({
          id: 'newest-authors',
          label: 'Newest Authors',
          labelStringKey: 'LabelNewestAuthors',
          type: 'authors',
          entities: newestAuthorsPayload.authors,
          total: newestAuthorsPayload.count
        })
      }
      Logger.debug(`Loaded ${newestAuthorsPayload.authors.length} of ${newestAuthorsPayload.count} authors for "Newest Authors" in ${((Date.now() - start) / 1000).toFixed(2)}s`)
    }

    Logger.debug(`Loaded ${shelves.length} personalized shelves in ${((Date.now() - fullStart) / 1000).toFixed(2)}s`)

    return shelves
  }

  /**
   * Get book library items for author, optional use user permissions
   * @param {import('./Author')} author
   * @param {import('./User')} user
   * @returns {Promise<LibraryItemExpanded[]>}
   */
  static async getForAuthor(author, user = null) {
    const { libraryItems } = await libraryFilters.getLibraryItemsForAuthor(author, user, undefined, undefined)
    return libraryItems
  }

  /**
   * Check if library item exists
   * @param {string} libraryItemId
   * @returns {Promise<boolean>}
   */
  static async checkExistsById(libraryItemId) {
    return (await this.count({ where: { id: libraryItemId } })) > 0
  }

  /**
   *
   * @param {string} libraryItemId
   * @returns {Promise<string>}
   */
  static async getCoverPath(libraryItemId) {
    const libraryItem = await this.findByPk(libraryItemId, {
      attributes: ['id', 'mediaType', 'mediaId', 'libraryId'],
      include: [
        {
          model: this.sequelize.models.book,
          attributes: ['id', 'coverPath']
        },
        {
          model: this.sequelize.models.podcast,
          attributes: ['id', 'coverPath']
        }
      ]
    })
    if (!libraryItem) {
      Logger.warn(`[LibraryItem] getCoverPath: Library item "${libraryItemId}" does not exist`)
      return null
    }

    return libraryItem.media.coverPath
  }

  /**
   *
   * @returns {Promise}
   */
  async saveMetadataFile() {
    let metadataPath = Path.join(global.MetadataPath, 'items', this.id)
    let storeMetadataWithItem = global.ServerSettings.storeMetadataWithItem
    if (storeMetadataWithItem && !this.isFile) {
      metadataPath = this.path
    } else {
      // Make sure metadata book dir exists
      storeMetadataWithItem = false
      await fsExtra.ensureDir(metadataPath)
    }

    const metadataFilePath = Path.join(metadataPath, `metadata.${global.ServerSettings.metadataFileFormat}`)

    // Expanded with series, authors, podcastEpisodes
    const mediaExpanded = this.media || (await this.getMediaExpanded())

    let jsonObject = {}
    if (this.mediaType === 'book') {
      jsonObject = {
        tags: mediaExpanded.tags || [],
        chapters: mediaExpanded.chapters?.map((c) => ({ ...c })) || [],
        title: mediaExpanded.title,
        subtitle: mediaExpanded.subtitle,
        authors: mediaExpanded.authors.map((a) => a.name),
        narrators: mediaExpanded.narrators,
        series: mediaExpanded.series.map((se) => {
          const sequence = se.bookSeries?.sequence || ''
          if (!sequence) return se.name
          return `${se.name} #${sequence}`
        }),
        genres: mediaExpanded.genres || [],
        publishedYear: mediaExpanded.publishedYear,
        publishedDate: mediaExpanded.publishedDate,
        publisher: mediaExpanded.publisher,
        description: mediaExpanded.description,
        isbn: mediaExpanded.isbn,
        asin: mediaExpanded.asin,
        language: mediaExpanded.language,
        explicit: !!mediaExpanded.explicit,
        abridged: !!mediaExpanded.abridged
      }
    } else {
      jsonObject = {
        tags: mediaExpanded.tags || [],
        title: mediaExpanded.title,
        author: mediaExpanded.author,
        description: mediaExpanded.description,
        releaseDate: mediaExpanded.releaseDate,
        genres: mediaExpanded.genres || [],
        feedURL: mediaExpanded.feedURL,
        imageURL: mediaExpanded.imageURL,
        itunesPageURL: mediaExpanded.itunesPageURL,
        itunesId: mediaExpanded.itunesId,
        itunesArtistId: mediaExpanded.itunesArtistId,
        asin: mediaExpanded.asin,
        language: mediaExpanded.language,
        explicit: !!mediaExpanded.explicit,
        podcastType: mediaExpanded.podcastType
      }
    }

    return fsExtra
      .writeFile(metadataFilePath, JSON.stringify(jsonObject, null, 2))
      .then(async () => {
        // Add metadata.json to libraryFiles array if it is new
        let metadataLibraryFile = this.libraryFiles.find((lf) => lf.metadata.path === filePathToPOSIX(metadataFilePath))
        if (storeMetadataWithItem) {
          if (!metadataLibraryFile) {
            const newLibraryFile = new LibraryFile()
            await newLibraryFile.setDataFromPath(metadataFilePath, `metadata.json`)
            metadataLibraryFile = newLibraryFile.toJSON()
            this.libraryFiles.push(metadataLibraryFile)
          } else {
            const fileTimestamps = await getFileTimestampsWithIno(metadataFilePath)
            if (fileTimestamps) {
              metadataLibraryFile.metadata.mtimeMs = fileTimestamps.mtimeMs
              metadataLibraryFile.metadata.ctimeMs = fileTimestamps.ctimeMs
              metadataLibraryFile.metadata.size = fileTimestamps.size
              metadataLibraryFile.ino = fileTimestamps.ino
            }
          }
          const libraryItemDirTimestamps = await getFileTimestampsWithIno(this.path)
          if (libraryItemDirTimestamps) {
            this.mtime = libraryItemDirTimestamps.mtimeMs
            this.ctime = libraryItemDirTimestamps.ctimeMs
            let size = 0
            this.libraryFiles.forEach((lf) => (size += !isNaN(lf.metadata.size) ? Number(lf.metadata.size) : 0))
            this.size = size
            await this.save()
          }
        }

        Logger.debug(`[LibraryItem] Saved metadata for "${this.media.title}" file to "${metadataFilePath}"`)

        return metadataLibraryFile
      })
      .catch((error) => {
        Logger.error(`Failed to save json file at "${metadataFilePath}"`, error)
        return null
      })
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
        ino: DataTypes.STRING,
        path: DataTypes.STRING,
        relPath: DataTypes.STRING,
        mediaId: DataTypes.UUID,
        mediaType: DataTypes.STRING,
        isFile: DataTypes.BOOLEAN,
        isMissing: DataTypes.BOOLEAN,
        isInvalid: DataTypes.BOOLEAN,
        mtime: DataTypes.DATE(6),
        ctime: DataTypes.DATE(6),
        birthtime: DataTypes.DATE(6),
        size: DataTypes.BIGINT,
        lastScan: DataTypes.DATE,
        lastScanVersion: DataTypes.STRING,
        libraryFiles: DataTypes.JSON,
        extraData: DataTypes.JSON,
        title: DataTypes.STRING,
        titleIgnorePrefix: DataTypes.STRING,
        authorNamesFirstLast: DataTypes.STRING,
        authorNamesLastFirst: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'libraryItem',
        indexes: [
          {
            fields: ['createdAt']
          },
          {
            fields: ['mediaId']
          },
          {
            fields: ['libraryId', 'mediaType']
          },
          {
            fields: ['libraryId', 'mediaType', 'size']
          },
          {
            fields: ['libraryId', 'mediaType', 'createdAt']
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'title', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'titleIgnorePrefix', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'authorNamesFirstLast', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaType', { name: 'authorNamesLastFirst', collate: 'NOCASE' }]
          },
          {
            fields: ['libraryId', 'mediaId', 'mediaType']
          },
          {
            fields: ['birthtime']
          },
          {
            fields: ['mtime']
          }
        ]
      }
    )

    const { library, libraryFolder, book, podcast } = sequelize.models
    library.hasMany(LibraryItem)
    LibraryItem.belongsTo(library)

    libraryFolder.hasMany(LibraryItem)
    LibraryItem.belongsTo(libraryFolder)

    book.hasOne(LibraryItem, {
      foreignKey: 'mediaId',
      constraints: false,
      scope: {
        mediaType: 'book'
      }
    })
    LibraryItem.belongsTo(book, { foreignKey: 'mediaId', constraints: false })

    podcast.hasOne(LibraryItem, {
      foreignKey: 'mediaId',
      constraints: false,
      scope: {
        mediaType: 'podcast'
      }
    })
    LibraryItem.belongsTo(podcast, { foreignKey: 'mediaId', constraints: false })

    LibraryItem.addHook('afterFind', (findResult) => {
      if (!findResult) return

      if (!Array.isArray(findResult)) findResult = [findResult]
      for (const instance of findResult) {
        if (instance.mediaType === 'book' && instance.book !== undefined) {
          instance.media = instance.book
          instance.dataValues.media = instance.dataValues.book
        } else if (instance.mediaType === 'podcast' && instance.podcast !== undefined) {
          instance.media = instance.podcast
          instance.dataValues.media = instance.dataValues.podcast
        }
        // To prevent mistakes:
        delete instance.book
        delete instance.dataValues.book
        delete instance.podcast
        delete instance.dataValues.podcast
      }
    })

    LibraryItem.addHook('afterDestroy', async (instance) => {
      if (!instance) return
      const media = await instance.getMedia()
      if (media) {
        media.destroy()
      }
    })
  }

  get isBook() {
    return this.mediaType === 'book'
  }
  get isPodcast() {
    return this.mediaType === 'podcast'
  }
  get hasAudioTracks() {
    return this.media.hasAudioTracks()
  }

  /**
   *
   * @param {import('sequelize').FindOptions} options
   * @returns {Promise<Book|Podcast>}
   */
  getMedia(options) {
    if (!this.mediaType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.mediaType)}`
    return this[mixinMethodName](options)
  }

  /**
   *
   * @returns {Promise<Book|Podcast>}
   */
  getMediaExpanded() {
    if (this.mediaType === 'podcast') {
      return this.getMedia({
        include: [
          {
            model: this.sequelize.models.podcastEpisode
          }
        ]
      })
    } else {
      return this.getMedia({
        include: [
          {
            model: this.sequelize.models.author,
            through: {
              attributes: []
            }
          },
          {
            model: this.sequelize.models.series,
            through: {
              attributes: ['sequence']
            }
          }
        ],
        order: [
          [this.sequelize.models.author, this.sequelize.models.bookAuthor, 'createdAt', 'ASC'],
          [this.sequelize.models.series, 'bookSeries', 'createdAt', 'ASC']
        ]
      })
    }
  }

  /**
   * Check if book or podcast library item has audio tracks
   * Requires expanded library item
   *
   * @returns {boolean}
   */
  hasAudioTracks() {
    if (!this.media) {
      Logger.error(`[LibraryItem] hasAudioTracks: Library item "${this.id}" does not have media`)
      return false
    }
    if (this.isBook) {
      return this.media.audioFiles?.length > 0
    } else {
      return this.media.podcastEpisodes?.length > 0
    }
  }

  /**
   *
   * @param {string} ino
   * @returns {import('./Book').AudioFileObject}
   */
  getAudioFileWithIno(ino) {
    if (!this.media) {
      Logger.error(`[LibraryItem] getAudioFileWithIno: Library item "${this.id}" does not have media`)
      return null
    }
    if (this.isBook) {
      return this.media.audioFiles.find((af) => af.ino === ino)
    } else {
      return this.media.podcastEpisodes.find((pe) => pe.audioFile?.ino === ino)?.audioFile
    }
  }

  /**
   * Get the track list to be used in client audio players
   * AudioTrack is the AudioFile with startOffset and contentUrl
   * Podcasts must have an episodeId to get the track list
   *
   * @param {string} [episodeId]
   * @returns {import('./Book').AudioTrack[]}
   */
  getTrackList(episodeId) {
    if (!this.media) {
      Logger.error(`[LibraryItem] getTrackList: Library item "${this.id}" does not have media`)
      return []
    }
    return this.media.getTracklist(this.id, episodeId)
  }

  /**
   *
   * @param {string} ino
   * @returns {LibraryFile}
   */
  getLibraryFileWithIno(ino) {
    const libraryFile = this.libraryFiles.find((lf) => lf.ino === ino)
    if (!libraryFile) return null
    return new LibraryFile(libraryFile)
  }

  getLibraryFiles() {
    return this.libraryFiles.map((lf) => new LibraryFile(lf))
  }

  getLibraryFilesJson() {
    return this.libraryFiles.map((lf) => new LibraryFile(lf).toJSON())
  }

  toOldJSON() {
    if (!this.media) {
      throw new Error(`[LibraryItem] Cannot convert to old JSON without media for library item "${this.id}"`)
    }

    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.extraData?.oldLibraryItemId || null,
      libraryId: this.libraryId,
      folderId: this.libraryFolderId,
      path: this.path,
      relPath: this.relPath,
      isFile: this.isFile,
      mtimeMs: this.mtime?.valueOf(),
      ctimeMs: this.ctime?.valueOf(),
      birthtimeMs: this.birthtime?.valueOf(),
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      lastScan: this.lastScan?.valueOf(),
      scanVersion: this.lastScanVersion,
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toOldJSON(this.id),
      // LibraryFile JSON includes a fileType property that may not be saved in libraryFiles column in the database
      libraryFiles: this.getLibraryFilesJson()
    }
  }

  toOldJSONMinified() {
    if (!this.media) {
      throw new Error(`[LibraryItem] Cannot convert to old JSON without media for library item "${this.id}"`)
    }

    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.extraData?.oldLibraryItemId || null,
      libraryId: this.libraryId,
      folderId: this.libraryFolderId,
      path: this.path,
      relPath: this.relPath,
      isFile: this.isFile,
      mtimeMs: this.mtime?.valueOf(),
      ctimeMs: this.ctime?.valueOf(),
      birthtimeMs: this.birthtime?.valueOf(),
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toOldJSONMinified(),
      numFiles: this.libraryFiles.length,
      size: this.size
    }
  }

  toOldJSONExpanded() {
    return {
      id: this.id,
      ino: this.ino,
      oldLibraryItemId: this.extraData?.oldLibraryItemId || null,
      libraryId: this.libraryId,
      folderId: this.libraryFolderId,
      path: this.path,
      relPath: this.relPath,
      isFile: this.isFile,
      mtimeMs: this.mtime?.valueOf(),
      ctimeMs: this.ctime?.valueOf(),
      birthtimeMs: this.birthtime?.valueOf(),
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf(),
      lastScan: this.lastScan?.valueOf(),
      scanVersion: this.lastScanVersion,
      isMissing: !!this.isMissing,
      isInvalid: !!this.isInvalid,
      mediaType: this.mediaType,
      media: this.media.toOldJSONExpanded(this.id),
      // LibraryFile JSON includes a fileType property that may not be saved in libraryFiles column in the database
      libraryFiles: this.getLibraryFilesJson(),
      size: this.size
    }
  }
}

module.exports = LibraryItem
