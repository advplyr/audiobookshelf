const Path = require('path')
const { DataTypes, Model } = require('sequelize')
const fsExtra = require('../libs/fsExtra')
const Logger = require('../Logger')
const oldLibraryItem = require('../objects/LibraryItem')
const libraryFilters = require('../utils/queries/libraryFilters')
const { areEquivalent } = require('../utils/index')
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
                attributes: ['sequence', 'createdAt']
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
   * Currently unused because this is too slow and uses too much mem
   * @param {import('sequelize').WhereOptions} [where]
   * @returns {Array<objects.LibraryItem>} old library items
   */
  static async getAllOldLibraryItems(where = null) {
    let libraryItems = await this.findAll({
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
                attributes: ['sequence']
              }
            }
          ]
        },
        {
          model: this.sequelize.models.podcast,
          include: [
            {
              model: this.sequelize.models.podcastEpisode
            }
          ]
        }
      ]
    })
    return libraryItems.map(ti => this.getOldLibraryItem(ti))
  }

  /**
   * Convert an expanded LibraryItem into an old library item
   * 
   * @param {Model<LibraryItem>} libraryItemExpanded 
   * @returns {oldLibraryItem}
   */
  static getOldLibraryItem(libraryItemExpanded) {
    let media = null
    if (libraryItemExpanded.mediaType === 'book') {
      media = this.sequelize.models.book.getOldBook(libraryItemExpanded)
    } else if (libraryItemExpanded.mediaType === 'podcast') {
      media = this.sequelize.models.podcast.getOldPodcast(libraryItemExpanded)
    }

    return new oldLibraryItem({
      id: libraryItemExpanded.id,
      ino: libraryItemExpanded.ino,
      oldLibraryItemId: libraryItemExpanded.extraData?.oldLibraryItemId || null,
      libraryId: libraryItemExpanded.libraryId,
      folderId: libraryItemExpanded.libraryFolderId,
      path: libraryItemExpanded.path,
      relPath: libraryItemExpanded.relPath,
      isFile: libraryItemExpanded.isFile,
      mtimeMs: libraryItemExpanded.mtime?.valueOf(),
      ctimeMs: libraryItemExpanded.ctime?.valueOf(),
      birthtimeMs: libraryItemExpanded.birthtime?.valueOf(),
      addedAt: libraryItemExpanded.createdAt.valueOf(),
      updatedAt: libraryItemExpanded.updatedAt.valueOf(),
      lastScan: libraryItemExpanded.lastScan?.valueOf(),
      scanVersion: libraryItemExpanded.lastScanVersion,
      isMissing: !!libraryItemExpanded.isMissing,
      isInvalid: !!libraryItemExpanded.isInvalid,
      mediaType: libraryItemExpanded.mediaType,
      media,
      libraryFiles: libraryItemExpanded.libraryFiles
    })
  }

  static async fullCreateFromOld(oldLibraryItem) {
    const newLibraryItem = await this.create(this.getFromOld(oldLibraryItem))

    if (oldLibraryItem.mediaType === 'book') {
      const bookObj = this.sequelize.models.book.getFromOld(oldLibraryItem.media)
      bookObj.libraryItemId = newLibraryItem.id
      const newBook = await this.sequelize.models.book.create(bookObj)

      const oldBookAuthors = oldLibraryItem.media.metadata.authors || []
      const oldBookSeriesAll = oldLibraryItem.media.metadata.series || []

      for (const oldBookAuthor of oldBookAuthors) {
        await this.sequelize.models.bookAuthor.create({ authorId: oldBookAuthor.id, bookId: newBook.id })
      }
      for (const oldSeries of oldBookSeriesAll) {
        await this.sequelize.models.bookSeries.create({ seriesId: oldSeries.id, bookId: newBook.id, sequence: oldSeries.sequence })
      }
    } else if (oldLibraryItem.mediaType === 'podcast') {
      const podcastObj = this.sequelize.models.podcast.getFromOld(oldLibraryItem.media)
      podcastObj.libraryItemId = newLibraryItem.id
      const newPodcast = await this.sequelize.models.podcast.create(podcastObj)

      const oldEpisodes = oldLibraryItem.media.episodes || []
      for (const oldEpisode of oldEpisodes) {
        const episodeObj = this.sequelize.models.podcastEpisode.getFromOld(oldEpisode)
        episodeObj.libraryItemId = newLibraryItem.id
        episodeObj.podcastId = newPodcast.id
        await this.sequelize.models.podcastEpisode.create(episodeObj)
      }
    }

    return newLibraryItem
  }

  /**
   * Updates libraryItem, book, authors and series from old library item
   * 
   * @param {oldLibraryItem} oldLibraryItem 
   * @returns {Promise<boolean>} true if updates were made
   */
  static async fullUpdateFromOld(oldLibraryItem) {
    const libraryItemExpanded = await this.findByPk(oldLibraryItem.id, {
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
          include: [
            {
              model: this.sequelize.models.podcastEpisode
            }
          ]
        }
      ]
    })
    if (!libraryItemExpanded) return false

    let hasUpdates = false

    // Check update Book/Podcast
    if (libraryItemExpanded.media) {
      let updatedMedia = null
      if (libraryItemExpanded.mediaType === 'podcast') {
        updatedMedia = this.sequelize.models.podcast.getFromOld(oldLibraryItem.media)

        const existingPodcastEpisodes = libraryItemExpanded.media.podcastEpisodes || []
        const updatedPodcastEpisodes = oldLibraryItem.media.episodes || []

        for (const existingPodcastEpisode of existingPodcastEpisodes) {
          // Episode was removed
          if (!updatedPodcastEpisodes.some(ep => ep.id === existingPodcastEpisode.id)) {
            Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" episode "${existingPodcastEpisode.title}" was removed`)
            await existingPodcastEpisode.destroy()
            hasUpdates = true
          }
        }
        for (const updatedPodcastEpisode of updatedPodcastEpisodes) {
          const existingEpisodeMatch = existingPodcastEpisodes.find(ep => ep.id === updatedPodcastEpisode.id)
          if (!existingEpisodeMatch) {
            Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" episode "${updatedPodcastEpisode.title}" was added`)
            await this.sequelize.models.podcastEpisode.createFromOld(updatedPodcastEpisode)
            hasUpdates = true
          } else {
            const updatedEpisodeCleaned = this.sequelize.models.podcastEpisode.getFromOld(updatedPodcastEpisode)
            let episodeHasUpdates = false
            for (const key in updatedEpisodeCleaned) {
              let existingValue = existingEpisodeMatch[key]
              if (existingValue instanceof Date) existingValue = existingValue.valueOf()

              if (!areEquivalent(updatedEpisodeCleaned[key], existingValue, true)) {
                Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" episode "${existingEpisodeMatch.title}" ${key} was updated from "${existingValue}" to "${updatedEpisodeCleaned[key]}"`)
                episodeHasUpdates = true
              }
            }
            if (episodeHasUpdates) {
              await existingEpisodeMatch.update(updatedEpisodeCleaned)
              hasUpdates = true
            }
          }
        }
      } else if (libraryItemExpanded.mediaType === 'book') {
        updatedMedia = this.sequelize.models.book.getFromOld(oldLibraryItem.media)

        const existingAuthors = libraryItemExpanded.media.authors || []
        const existingSeriesAll = libraryItemExpanded.media.series || []
        const updatedAuthors = oldLibraryItem.media.metadata.authors || []
        const uniqueUpdatedAuthors = updatedAuthors.filter((au, idx) => updatedAuthors.findIndex(a => a.id === au.id) === idx)
        const updatedSeriesAll = oldLibraryItem.media.metadata.series || []

        for (const existingAuthor of existingAuthors) {
          // Author was removed from Book
          if (!uniqueUpdatedAuthors.some(au => au.id === existingAuthor.id)) {
            Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" author "${existingAuthor.name}" was removed`)
            await this.sequelize.models.bookAuthor.removeByIds(existingAuthor.id, libraryItemExpanded.media.id)
            hasUpdates = true
          }
        }
        for (const updatedAuthor of uniqueUpdatedAuthors) {
          // Author was added
          if (!existingAuthors.some(au => au.id === updatedAuthor.id)) {
            Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" author "${updatedAuthor.name}" was added`)
            await this.sequelize.models.bookAuthor.create({ authorId: updatedAuthor.id, bookId: libraryItemExpanded.media.id })
            hasUpdates = true
          }
        }
        for (const existingSeries of existingSeriesAll) {
          // Series was removed
          if (!updatedSeriesAll.some(se => se.id === existingSeries.id)) {
            Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" series "${existingSeries.name}" was removed`)
            await this.sequelize.models.bookSeries.removeByIds(existingSeries.id, libraryItemExpanded.media.id)
            hasUpdates = true
          }
        }
        for (const updatedSeries of updatedSeriesAll) {
          // Series was added/updated
          const existingSeriesMatch = existingSeriesAll.find(se => se.id === updatedSeries.id)
          if (!existingSeriesMatch) {
            Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" series "${updatedSeries.name}" was added`)
            await this.sequelize.models.bookSeries.create({ seriesId: updatedSeries.id, bookId: libraryItemExpanded.media.id, sequence: updatedSeries.sequence })
            hasUpdates = true
          } else if (existingSeriesMatch.bookSeries.sequence !== updatedSeries.sequence) {
            Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" series "${updatedSeries.name}" sequence was updated from "${existingSeriesMatch.bookSeries.sequence}" to "${updatedSeries.sequence}"`)
            await existingSeriesMatch.bookSeries.update({ id: updatedSeries.id, sequence: updatedSeries.sequence })
            hasUpdates = true
          }
        }
      }

      let hasMediaUpdates = false
      for (const key in updatedMedia) {
        let existingValue = libraryItemExpanded.media[key]
        if (existingValue instanceof Date) existingValue = existingValue.valueOf()

        if (!areEquivalent(updatedMedia[key], existingValue, true)) {
          Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" ${libraryItemExpanded.mediaType}.${key} updated from ${existingValue} to ${updatedMedia[key]}`)
          hasMediaUpdates = true
        }
      }
      if (hasMediaUpdates && updatedMedia) {
        await libraryItemExpanded.media.update(updatedMedia)
        hasUpdates = true
      }
    }

    const updatedLibraryItem = this.getFromOld(oldLibraryItem)
    let hasLibraryItemUpdates = false
    for (const key in updatedLibraryItem) {
      let existingValue = libraryItemExpanded[key]
      if (existingValue instanceof Date) existingValue = existingValue.valueOf()

      if (!areEquivalent(updatedLibraryItem[key], existingValue, true)) {
        Logger.debug(`[LibraryItem] "${libraryItemExpanded.media.title}" ${key} updated from ${existingValue} to ${updatedLibraryItem[key]}`)
        hasLibraryItemUpdates = true
        if (key === 'updatedAt') {
          libraryItemExpanded.changed('updatedAt', true)
        }
      }
    }
    if (hasLibraryItemUpdates) {
      await libraryItemExpanded.update(updatedLibraryItem)
      Logger.info(`[LibraryItem] Library item "${libraryItemExpanded.id}" updated`)
      hasUpdates = true
    }
    return hasUpdates
  }

  static getFromOld(oldLibraryItem) {
    const extraData = {}
    if (oldLibraryItem.oldLibraryItemId) {
      extraData.oldLibraryItemId = oldLibraryItem.oldLibraryItemId
    }
    return {
      id: oldLibraryItem.id,
      ino: oldLibraryItem.ino,
      path: oldLibraryItem.path,
      relPath: oldLibraryItem.relPath,
      mediaId: oldLibraryItem.media.id,
      mediaType: oldLibraryItem.mediaType,
      isFile: !!oldLibraryItem.isFile,
      isMissing: !!oldLibraryItem.isMissing,
      isInvalid: !!oldLibraryItem.isInvalid,
      mtime: oldLibraryItem.mtimeMs,
      ctime: oldLibraryItem.ctimeMs,
      updatedAt: oldLibraryItem.updatedAt,
      birthtime: oldLibraryItem.birthtimeMs,
      size: oldLibraryItem.size,
      lastScan: oldLibraryItem.lastScan,
      lastScanVersion: oldLibraryItem.scanVersion,
      libraryId: oldLibraryItem.libraryId,
      libraryFolderId: oldLibraryItem.folderId,
      libraryFiles: oldLibraryItem.libraryFiles?.map(lf => lf.toJSON()) || [],
      extraData
    }
  }

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

    if (!libraryItem.media) return null
    return libraryItem
  }

  /**
   * Get old library item by id
   * @param {string} libraryItemId 
   * @returns {oldLibraryItem}
   */
  static async getOldById(libraryItemId) {
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

    if (!libraryItem.media) return null
    return this.getOldLibraryItem(libraryItem)
  }

  /**
   * Get library items using filter and sort
   * @param {oldLibrary} library 
   * @param {oldUser} user 
   * @param {object} options 
   * @returns {object} { libraryItems:oldLibraryItem[], count:number }
   */
  static async getByFilterAndSort(library, user, options) {
    let start = Date.now()
    const { libraryItems, count } = await libraryFilters.getFilteredLibraryItems(library, user, options)
    Logger.debug(`Loaded ${libraryItems.length} of ${count} items for libary page in ${((Date.now() - start) / 1000).toFixed(2)}s`)

    return {
      libraryItems: libraryItems.map(li => {
        const oldLibraryItem = this.getOldLibraryItem(li).toJSONMinified()
        if (li.collapsedSeries) {
          oldLibraryItem.collapsedSeries = li.collapsedSeries
        }
        if (li.series) {
          oldLibraryItem.media.metadata.series = li.series
        }
        if (li.rssFeed) {
          oldLibraryItem.rssFeed = this.sequelize.models.feed.getOldFeed(li.rssFeed).toJSONMinified()
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

        return oldLibraryItem
      }),
      count
    }
  }

  /**
   * Get home page data personalized shelves
   * @param {oldLibrary} library 
   * @param {oldUser} user 
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
      const ebookOnlyItemsInProgress = itemsInProgressPayload.items.filter(li => li.media.isEBookOnly)
      const audioOnlyItemsInProgress = itemsInProgressPayload.items.filter(li => !li.media.isEBookOnly)

      shelves.push({
        id: 'continue-listening',
        label: 'Continue Listening',
        labelStringKey: 'LabelContinueListening',
        type: library.isPodcast ? 'episode' : 'book',
        entities: audioOnlyItemsInProgress,
        total: itemsInProgressPayload.count
      })

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
      const ebookOnlyItemsInProgress = mediaFinishedPayload.items.filter(li => li.media.isEBookOnly)
      const audioOnlyItemsInProgress = mediaFinishedPayload.items.filter(li => !li.media.isEBookOnly)

      shelves.push({
        id: 'listen-again',
        label: 'Listen Again',
        labelStringKey: 'LabelListenAgain',
        type: library.isPodcast ? 'episode' : 'book',
        entities: audioOnlyItemsInProgress,
        total: mediaFinishedPayload.count
      })

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
   * @param {oldAuthor} author
   * @param {[oldUser]} user 
   * @returns {Promise<oldLibraryItem[]>}
   */
  static async getForAuthor(author, user = null) {
    const { libraryItems } = await libraryFilters.getLibraryItemsForAuthor(author, user, undefined, undefined)
    return libraryItems.map(li => this.getOldLibraryItem(li))
  }

  /**
   * Get book library items in a collection
   * @param {oldCollection} collection 
   * @returns {Promise<oldLibraryItem[]>}
   */
  static async getForCollection(collection) {
    const libraryItems = await libraryFilters.getLibraryItemsForCollection(collection)
    return libraryItems.map(li => this.getOldLibraryItem(li))
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
   * @param {import('sequelize').WhereOptions} where 
   * @param {import('sequelize').BindOrReplacements} replacements
   * @returns {Object} oldLibraryItem
   */
  static async findOneOld(where, replacements = {}) {
    const libraryItem = await this.findOne({
      where,
      replacements,
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
                attributes: ['sequence']
              }
            }
          ]
        },
        {
          model: this.sequelize.models.podcast,
          include: [
            {
              model: this.sequelize.models.podcastEpisode
            }
          ]
        }
      ],
      order: [
        [this.sequelize.models.book, this.sequelize.models.author, this.sequelize.models.bookAuthor, 'createdAt', 'ASC'],
        [this.sequelize.models.book, this.sequelize.models.series, 'bookSeries', 'createdAt', 'ASC']
      ]
    })
    if (!libraryItem) return null
    return this.getOldLibraryItem(libraryItem)
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
    const mediaExpanded = this.media || await this.getMediaExpanded()

    let jsonObject = {}
    if (this.mediaType === 'book') {
      jsonObject = {
        tags: mediaExpanded.tags || [],
        chapters: mediaExpanded.chapters?.map(c => ({ ...c })) || [],
        title: mediaExpanded.title,
        subtitle: mediaExpanded.subtitle,
        authors: mediaExpanded.authors.map(a => a.name),
        narrators: mediaExpanded.narrators,
        series: mediaExpanded.series.map(se => {
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


    return fsExtra.writeFile(metadataFilePath, JSON.stringify(jsonObject, null, 2)).then(async () => {
      // Add metadata.json to libraryFiles array if it is new
      let metadataLibraryFile = this.libraryFiles.find(lf => lf.metadata.path === filePathToPOSIX(metadataFilePath))
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
          this.libraryFiles.forEach((lf) => size += (!isNaN(lf.metadata.size) ? Number(lf.metadata.size) : 0))
          this.size = size
          await this.save()
        }
      }

      Logger.debug(`Success saving abmetadata to "${metadataFilePath}"`)

      return metadataLibraryFile
    }).catch((error) => {
      Logger.error(`Failed to save json file at "${metadataFilePath}"`, error)
      return null
    })
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize 
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      ino: DataTypes.STRING,
      path: DataTypes.STRING,
      relPath: DataTypes.STRING,
      mediaId: DataTypes.UUIDV4,
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
      extraData: DataTypes.JSON
    }, {
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
          fields: ['libraryId', 'mediaId', 'mediaType']
        },
        {
          fields: ['birthtime']
        },
        {
          fields: ['mtime']
        }
      ]
    })

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

    LibraryItem.addHook('afterFind', findResult => {
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

    LibraryItem.addHook('afterDestroy', async instance => {
      if (!instance) return
      const media = await instance.getMedia()
      if (media) {
        media.destroy()
      }
    })
  }
}

module.exports = LibraryItem
