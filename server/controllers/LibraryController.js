const Sequelize = require('sequelize')
const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Library = require('../objects/Library')
const libraryHelpers = require('../utils/libraryHelpers')
const libraryItemsBookFilters = require('../utils/queries/libraryItemsBookFilters')
const libraryItemFilters = require('../utils/queries/libraryItemFilters')
const seriesFilters = require('../utils/queries/seriesFilters')
const fileUtils = require('../utils/fileUtils')
const { asciiOnlyToLowerCase } = require('../utils/index')
const { createNewSortInstance } = require('../libs/fastSort')
const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare
})

const LibraryScanner = require('../scanner/LibraryScanner')
const Scanner = require('../scanner/Scanner')
const Database = require('../Database')
const libraryFilters = require('../utils/queries/libraryFilters')
const libraryItemsPodcastFilters = require('../utils/queries/libraryItemsPodcastFilters')
const authorFilters = require('../utils/queries/authorFilters')

class LibraryController {
  constructor() {}

  async create(req, res) {
    const newLibraryPayload = {
      ...req.body
    }
    if (!newLibraryPayload.name || !newLibraryPayload.folders || !newLibraryPayload.folders.length) {
      return res.status(500).send('Invalid request')
    }

    // Validate that the custom provider exists if given any
    if (newLibraryPayload.provider?.startsWith('custom-')) {
      if (!(await Database.customMetadataProviderModel.checkExistsBySlug(newLibraryPayload.provider))) {
        Logger.error(`[LibraryController] Custom metadata provider "${newLibraryPayload.provider}" does not exist`)
        return res.status(400).send('Custom metadata provider does not exist')
      }
    }

    // Validate folder paths exist or can be created & resolve rel paths
    //   returns 400 if a folder fails to access
    newLibraryPayload.folders = newLibraryPayload.folders.map((f) => {
      f.fullPath = fileUtils.filePathToPOSIX(Path.resolve(f.fullPath))
      return f
    })
    for (const folder of newLibraryPayload.folders) {
      try {
        const direxists = await fs.pathExists(folder.fullPath)
        if (!direxists) {
          // If folder does not exist try to make it and set file permissions/owner
          await fs.mkdir(folder.fullPath)
        }
      } catch (error) {
        Logger.error(`[LibraryController] Failed to ensure folder dir "${folder.fullPath}"`, error)
        return res.status(400).send(`Invalid folder directory "${folder.fullPath}"`)
      }
    }

    const library = new Library()

    let currentLargestDisplayOrder = await Database.libraryModel.getMaxDisplayOrder()
    if (isNaN(currentLargestDisplayOrder)) currentLargestDisplayOrder = 0
    newLibraryPayload.displayOrder = currentLargestDisplayOrder + 1
    library.setData(newLibraryPayload)
    await Database.createLibrary(library)

    // Only emit to users with access to library
    const userFilter = (user) => {
      return user.checkCanAccessLibrary?.(library.id)
    }
    SocketAuthority.emitter('library_added', library.toJSON(), userFilter)

    // Add library watcher
    this.watcher.addLibrary(library)

    res.json(library)
  }

  async findAll(req, res) {
    const libraries = await Database.libraryModel.getAllOldLibraries()

    const librariesAccessible = req.user.librariesAccessible || []
    if (librariesAccessible.length) {
      return res.json({
        libraries: libraries.filter((lib) => librariesAccessible.includes(lib.id)).map((lib) => lib.toJSON())
      })
    }

    res.json({
      libraries: libraries.map((lib) => lib.toJSON())
    })
  }

  /**
   * GET: /api/libraries/:id
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async findOne(req, res) {
    const includeArray = (req.query.include || '').split(',')
    if (includeArray.includes('filterdata')) {
      const filterdata = await libraryFilters.getFilterData(req.library.mediaType, req.library.id)
      const customMetadataProviders = await Database.customMetadataProviderModel.getForClientByMediaType(req.library.mediaType)

      return res.json({
        filterdata,
        issues: filterdata.numIssues,
        numUserPlaylists: await Database.playlistModel.getNumPlaylistsForUserAndLibrary(req.user.id, req.library.id),
        customMetadataProviders,
        library: req.library
      })
    }
    res.json(req.library)
  }

  /**
   * GET: /api/libraries/:id/episode-downloads
   * Get podcast episodes in download queue
   * @param {*} req
   * @param {*} res
   */
  async getEpisodeDownloadQueue(req, res) {
    const libraryDownloadQueueDetails = this.podcastManager.getDownloadQueueDetails(req.library.id)
    res.json(libraryDownloadQueueDetails)
  }

  /**
   * PATCH: /api/libraries/:id
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async update(req, res) {
    /** @type {import('../objects/Library')} */
    const library = req.library

    // Validate that the custom provider exists if given any
    if (req.body.provider?.startsWith('custom-')) {
      if (!(await Database.customMetadataProviderModel.checkExistsBySlug(req.body.provider))) {
        Logger.error(`[LibraryController] Custom metadata provider "${req.body.provider}" does not exist`)
        return res.status(400).send('Custom metadata provider does not exist')
      }
    }

    // Validate new folder paths exist or can be created & resolve rel paths
    //   returns 400 if a new folder fails to access
    if (req.body.folders) {
      const newFolderPaths = []
      req.body.folders = req.body.folders.map((f) => {
        if (!f.id) {
          f.fullPath = fileUtils.filePathToPOSIX(Path.resolve(f.fullPath))
          newFolderPaths.push(f.fullPath)
        }
        return f
      })
      for (const path of newFolderPaths) {
        const pathExists = await fs.pathExists(path)
        if (!pathExists) {
          // Ensure dir will recursively create directories which might be preferred over mkdir
          const success = await fs
            .ensureDir(path)
            .then(() => true)
            .catch((error) => {
              Logger.error(`[LibraryController] Failed to ensure folder dir "${path}"`, error)
              return false
            })
          if (!success) {
            return res.status(400).send(`Invalid folder directory "${path}"`)
          }
        }
      }

      // Handle removing folders
      for (const folder of library.folders) {
        if (!req.body.folders.some((f) => f.id === folder.id)) {
          // Remove library items in folder
          const libraryItemsInFolder = await Database.libraryItemModel.findAll({
            where: {
              libraryFolderId: folder.id
            },
            attributes: ['id', 'mediaId', 'mediaType'],
            include: [
              {
                model: Database.podcastModel,
                attributes: ['id'],
                include: {
                  model: Database.podcastEpisodeModel,
                  attributes: ['id']
                }
              }
            ]
          })
          Logger.info(`[LibraryController] Removed folder "${folder.fullPath}" from library "${library.name}" with ${libraryItemsInFolder.length} library items`)
          for (const libraryItem of libraryItemsInFolder) {
            let mediaItemIds = []
            if (library.isPodcast) {
              mediaItemIds = libraryItem.media.podcastEpisodes.map((pe) => pe.id)
            } else {
              mediaItemIds.push(libraryItem.mediaId)
            }
            Logger.info(`[LibraryController] Removing library item "${libraryItem.id}" from folder "${folder.fullPath}"`)
            await this.handleDeleteLibraryItem(libraryItem.mediaType, libraryItem.id, mediaItemIds)
          }
        }
      }
    }

    const hasUpdates = library.update(req.body)
    // TODO: Should check if this is an update to folder paths or name only
    if (hasUpdates) {
      // Update watcher
      this.watcher.updateLibrary(library)

      // Update auto scan cron
      this.cronManager.updateLibraryScanCron(library)

      await Database.updateLibrary(library)

      // Only emit to users with access to library
      const userFilter = (user) => {
        return user.checkCanAccessLibrary && user.checkCanAccessLibrary(library.id)
      }
      SocketAuthority.emitter('library_updated', library.toJSON(), userFilter)

      await Database.resetLibraryIssuesFilterData(library.id)
    }
    return res.json(library.toJSON())
  }

  /**
   * DELETE: /api/libraries/:id
   * Delete a library
   * @param {*} req
   * @param {*} res
   */
  async delete(req, res) {
    const library = req.library

    // Remove library watcher
    this.watcher.removeLibrary(library)

    // Remove collections for library
    const numCollectionsRemoved = await Database.collectionModel.removeAllForLibrary(library.id)
    if (numCollectionsRemoved) {
      Logger.info(`[Server] Removed ${numCollectionsRemoved} collections for library "${library.name}"`)
    }

    // Remove items in this library
    const libraryItemsInLibrary = await Database.libraryItemModel.findAll({
      where: {
        libraryId: library.id
      },
      attributes: ['id', 'mediaId', 'mediaType'],
      include: [
        {
          model: Database.podcastModel,
          attributes: ['id'],
          include: {
            model: Database.podcastEpisodeModel,
            attributes: ['id']
          }
        }
      ]
    })
    Logger.info(`[LibraryController] Removing ${libraryItemsInLibrary.length} library items in library "${library.name}"`)
    for (const libraryItem of libraryItemsInLibrary) {
      let mediaItemIds = []
      if (library.isPodcast) {
        mediaItemIds = libraryItem.media.podcastEpisodes.map((pe) => pe.id)
      } else {
        mediaItemIds.push(libraryItem.mediaId)
      }
      Logger.info(`[LibraryController] Removing library item "${libraryItem.id}" from library "${library.name}"`)
      await this.handleDeleteLibraryItem(libraryItem.mediaType, libraryItem.id, mediaItemIds)
    }

    const libraryJson = library.toJSON()
    await Database.removeLibrary(library.id)

    // Re-order libraries
    await Database.libraryModel.resetDisplayOrder()

    SocketAuthority.emitter('library_removed', libraryJson)

    // Remove library filter data
    if (Database.libraryFilterData[library.id]) {
      delete Database.libraryFilterData[library.id]
    }

    return res.json(libraryJson)
  }

  /**
   * GET /api/libraries/:id/items
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getLibraryItems(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter((v) => !!v)

    const payload = {
      results: [],
      total: undefined,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter,
      mediaType: req.library.mediaType,
      minified: req.query.minified === '1',
      collapseseries: req.query.collapseseries === '1',
      include: include.join(',')
    }
    payload.offset = payload.page * payload.limit

    // TODO: Temporary way of handling collapse sub-series. Either remove feature or handle through sql queries
    const filterByGroup = payload.filterBy?.split('.').shift()
    const filterByValue = filterByGroup ? libraryFilters.decode(payload.filterBy.replace(`${filterByGroup}.`, '')) : null
    if (filterByGroup === 'series' && filterByValue !== 'no-series' && payload.collapseseries) {
      const seriesId = libraryFilters.decode(payload.filterBy.split('.')[1])
      payload.results = await libraryHelpers.handleCollapseSubseries(payload, seriesId, req.user, req.library)
    } else {
      const { libraryItems, count } = await Database.libraryItemModel.getByFilterAndSort(req.library, req.user, payload)
      payload.results = libraryItems
      payload.total = count
    }

    res.json(payload)
  }

  /**
   * DELETE: /libraries/:id/issues
   * Remove all library items missing or invalid
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async removeLibraryItemsWithIssues(req, res) {
    const libraryItemsWithIssues = await Database.libraryItemModel.findAll({
      where: {
        libraryId: req.library.id,
        [Sequelize.Op.or]: [
          {
            isMissing: true
          },
          {
            isInvalid: true
          }
        ]
      },
      attributes: ['id', 'mediaId', 'mediaType'],
      include: [
        {
          model: Database.podcastModel,
          attributes: ['id'],
          include: {
            model: Database.podcastEpisodeModel,
            attributes: ['id']
          }
        }
      ]
    })

    if (!libraryItemsWithIssues.length) {
      Logger.warn(`[LibraryController] No library items have issues`)
      return res.sendStatus(200)
    }

    Logger.info(`[LibraryController] Removing ${libraryItemsWithIssues.length} items with issues`)
    for (const libraryItem of libraryItemsWithIssues) {
      let mediaItemIds = []
      if (req.library.isPodcast) {
        mediaItemIds = libraryItem.media.podcastEpisodes.map((pe) => pe.id)
      } else {
        mediaItemIds.push(libraryItem.mediaId)
      }
      Logger.info(`[LibraryController] Removing library item "${libraryItem.id}" with issue`)
      await this.handleDeleteLibraryItem(libraryItem.mediaType, libraryItem.id, mediaItemIds)
    }

    // Set numIssues to 0 for library filter data
    if (Database.libraryFilterData[req.library.id]) {
      Database.libraryFilterData[req.library.id].numIssues = 0
    }

    res.sendStatus(200)
  }

  /**
   * GET: /api/libraries/:id/series
   * Optional query string: `?include=rssfeed` that adds `rssFeed` to series if a feed is open
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getAllSeriesForLibrary(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter((v) => !!v)

    const payload = {
      results: [],
      total: 0,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter,
      minified: req.query.minified === '1',
      include: include.join(',')
    }

    const offset = payload.page * payload.limit
    const { series, count } = await seriesFilters.getFilteredSeries(req.library, req.user, payload.filterBy, payload.sortBy, payload.sortDesc, include, payload.limit, offset)

    payload.total = count
    payload.results = series
    res.json(payload)
  }

  /**
   * GET: /api/libraries/:id/series/:seriesId
   *
   * Optional includes (e.g. `?include=rssfeed,progress`)
   * rssfeed: adds `rssFeed` to series object if a feed is open
   * progress: adds `progress` to series object with { libraryItemIds:Array<llid>, libraryItemIdsFinished:Array<llid>, isFinished:boolean }
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res - Series
   */
  async getSeriesForLibrary(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter((v) => !!v)

    const series = await Database.seriesModel.findByPk(req.params.seriesId)
    if (!series) return res.sendStatus(404)
    const oldSeries = series.getOldSeries()

    const libraryItemsInSeries = await libraryItemsBookFilters.getLibraryItemsForSeries(oldSeries, req.user)

    const seriesJson = oldSeries.toJSON()
    if (include.includes('progress')) {
      const libraryItemsFinished = libraryItemsInSeries.filter((li) => !!req.user.getMediaProgress(li.id)?.isFinished)
      seriesJson.progress = {
        libraryItemIds: libraryItemsInSeries.map((li) => li.id),
        libraryItemIdsFinished: libraryItemsFinished.map((li) => li.id),
        isFinished: libraryItemsFinished.length >= libraryItemsInSeries.length
      }
    }

    if (include.includes('rssfeed')) {
      const feedObj = await this.rssFeedManager.findFeedForEntityId(seriesJson.id)
      seriesJson.rssFeed = feedObj?.toJSONMinified() || null
    }

    res.json(seriesJson)
  }

  /**
   * GET: /api/libraries/:id/collections
   * Get all collections for library
   * @param {*} req
   * @param {*} res
   */
  async getCollectionsForLibrary(req, res) {
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter((v) => !!v)

    const payload = {
      results: [],
      total: 0,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0,
      sortBy: req.query.sort,
      sortDesc: req.query.desc === '1',
      filterBy: req.query.filter,
      minified: req.query.minified === '1',
      include: include.join(',')
    }

    // TODO: Create paginated queries
    let collections = await Database.collectionModel.getOldCollectionsJsonExpanded(req.user, req.library.id, include)

    payload.total = collections.length

    if (payload.limit) {
      const startIndex = payload.page * payload.limit
      collections = collections.slice(startIndex, startIndex + payload.limit)
    }

    payload.results = collections
    res.json(payload)
  }

  /**
   * GET: /api/libraries/:id/playlists
   * Get playlists for user in library
   * @param {*} req
   * @param {*} res
   */
  async getUserPlaylistsForLibrary(req, res) {
    let playlistsForUser = await Database.playlistModel.getPlaylistsForUserAndLibrary(req.user.id, req.library.id)
    playlistsForUser = await Promise.all(playlistsForUser.map(async (p) => p.getOldJsonExpanded()))

    const payload = {
      results: [],
      total: playlistsForUser.length,
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0
    }

    if (payload.limit) {
      const startIndex = payload.page * payload.limit
      playlistsForUser = playlistsForUser.slice(startIndex, startIndex + payload.limit)
    }

    payload.results = playlistsForUser
    res.json(payload)
  }

  /**
   * GET: /api/libraries/:id/filterdata
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getLibraryFilterData(req, res) {
    const filterData = await libraryFilters.getFilterData(req.library.mediaType, req.library.id)
    res.json(filterData)
  }

  /**
   * GET: /api/libraries/:id/personalized
   * Home page shelves
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getUserPersonalizedShelves(req, res) {
    const limitPerShelf = req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) || 10 : 10
    const include = (req.query.include || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter((v) => !!v)
    const shelves = await Database.libraryItemModel.getPersonalizedShelves(req.library, req.user, include, limitPerShelf)
    res.json(shelves)
  }

  /**
   * POST: /api/libraries/order
   * Change the display order of libraries
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async reorder(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('[LibraryController] ReorderLibraries invalid user', req.user)
      return res.sendStatus(403)
    }
    const libraries = await Database.libraryModel.getAllOldLibraries()

    const orderdata = req.body
    let hasUpdates = false
    for (let i = 0; i < orderdata.length; i++) {
      const library = libraries.find((lib) => lib.id === orderdata[i].id)
      if (!library) {
        Logger.error(`[LibraryController] Invalid library not found in reorder ${orderdata[i].id}`)
        return res.sendStatus(500)
      }
      if (library.update({ displayOrder: orderdata[i].newOrder })) {
        hasUpdates = true
        await Database.updateLibrary(library)
      }
    }

    if (hasUpdates) {
      libraries.sort((a, b) => a.displayOrder - b.displayOrder)
      Logger.debug(`[LibraryController] Updated library display orders`)
    } else {
      Logger.debug(`[LibraryController] Library orders were up to date`)
    }

    res.json({
      libraries: libraries.map((lib) => lib.toJSON())
    })
  }

  /**
   * GET: /api/libraries/:id/search
   * Search library items with query
   * ?q=search
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async search(req, res) {
    if (!req.query.q || typeof req.query.q !== 'string') {
      return res.status(400).send('Invalid request. Query param "q" must be a string')
    }
    const limit = req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 12
    const query = asciiOnlyToLowerCase(req.query.q.trim())

    const matches = await libraryItemFilters.search(req.user, req.library, query, limit)
    res.json(matches)
  }

  /**
   * GET: /api/libraries/:id/stats
   * Get stats for library
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async stats(req, res) {
    const stats = {
      largestItems: await libraryItemFilters.getLargestItems(req.library.id, 10)
    }

    if (req.library.isBook) {
      const authors = await authorFilters.getAuthorsWithCount(req.library.id, 10)
      const genres = await libraryItemsBookFilters.getGenresWithCount(req.library.id)
      const bookStats = await libraryItemsBookFilters.getBookLibraryStats(req.library.id)
      const longestBooks = await libraryItemsBookFilters.getLongestBooks(req.library.id, 10)

      stats.totalAuthors = await authorFilters.getAuthorsTotalCount(req.library.id)
      stats.authorsWithCount = authors
      stats.totalGenres = genres.length
      stats.genresWithCount = genres
      stats.totalItems = bookStats.totalItems
      stats.longestItems = longestBooks
      stats.totalSize = bookStats.totalSize
      stats.totalDuration = bookStats.totalDuration
      stats.numAudioTracks = bookStats.numAudioFiles
    } else {
      const genres = await libraryItemsPodcastFilters.getGenresWithCount(req.library.id)
      const podcastStats = await libraryItemsPodcastFilters.getPodcastLibraryStats(req.library.id)
      const longestPodcasts = await libraryItemsPodcastFilters.getLongestPodcasts(req.library.id, 10)

      stats.totalGenres = genres.length
      stats.genresWithCount = genres
      stats.totalItems = podcastStats.totalItems
      stats.longestItems = longestPodcasts
      stats.totalSize = podcastStats.totalSize
      stats.totalDuration = podcastStats.totalDuration
      stats.numAudioTracks = podcastStats.numAudioFiles
    }
    res.json(stats)
  }

  /**
   * GET: /api/libraries/:id/authors
   * Get authors for library
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getAuthors(req, res) {
    const { bookWhere, replacements } = libraryItemsBookFilters.getUserPermissionBookWhereQuery(req.user)
    const authors = await Database.authorModel.findAll({
      where: {
        libraryId: req.library.id
      },
      replacements,
      include: {
        model: Database.bookModel,
        attributes: ['id', 'tags', 'explicit'],
        where: bookWhere,
        required: !req.user.isAdminOrUp, // Only show authors with 0 books for admin users or up
        through: {
          attributes: []
        }
      },
      order: [[Sequelize.literal('name COLLATE NOCASE'), 'ASC']]
    })

    const oldAuthors = []

    for (const author of authors) {
      const oldAuthor = author.getOldAuthor().toJSON()
      oldAuthor.numBooks = author.books.length
      oldAuthor.lastFirst = author.lastFirst
      oldAuthors.push(oldAuthor)
    }

    res.json({
      authors: oldAuthors
    })
  }

  /**
   * GET: /api/libraries/:id/narrators
   * @param {*} req
   * @param {*} res
   */
  async getNarrators(req, res) {
    // Get all books with narrators
    const booksWithNarrators = await Database.bookModel.findAll({
      where: Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('narrators')), {
        [Sequelize.Op.gt]: 0
      }),
      include: {
        model: Database.libraryItemModel,
        attributes: ['id', 'libraryId'],
        where: {
          libraryId: req.library.id
        }
      },
      attributes: ['id', 'narrators']
    })

    const narrators = {}
    for (const book of booksWithNarrators) {
      book.narrators.forEach((n) => {
        if (typeof n !== 'string') {
          Logger.error(`[LibraryController] getNarrators: Invalid narrator "${n}" on book "${book.title}"`)
        } else if (!narrators[n]) {
          narrators[n] = {
            id: encodeURIComponent(Buffer.from(n).toString('base64')),
            name: n,
            numBooks: 1
          }
        } else {
          narrators[n].numBooks++
        }
      })
    }

    res.json({
      narrators: naturalSort(Object.values(narrators)).asc((n) => n.name)
    })
  }

  /**
   * PATCH: /api/libraries/:id/narrators/:narratorId
   * Update narrator name
   * :narratorId is base64 encoded name
   * req.body { name }
   * @param {*} req
   * @param {*} res
   */
  async updateNarrator(req, res) {
    if (!req.user.canUpdate) {
      Logger.error(`[LibraryController] Unauthorized user "${req.user.username}" attempted to update narrator`)
      return res.sendStatus(403)
    }

    const narratorName = libraryFilters.decode(req.params.narratorId)
    const updatedName = req.body.name
    if (!updatedName) {
      return res.status(400).send('Invalid request payload. Name not specified.')
    }

    // Update filter data
    Database.replaceNarratorInFilterData(narratorName, updatedName)

    const itemsUpdated = []

    const itemsWithNarrator = await libraryItemFilters.getAllLibraryItemsWithNarrators([narratorName])

    for (const libraryItem of itemsWithNarrator) {
      libraryItem.media.narrators = libraryItem.media.narrators.filter((n) => n !== narratorName)
      if (!libraryItem.media.narrators.includes(updatedName)) {
        libraryItem.media.narrators.push(updatedName)
      }
      await libraryItem.media.update({
        narrators: libraryItem.media.narrators
      })
      const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(libraryItem)
      itemsUpdated.push(oldLibraryItem)
    }

    if (itemsUpdated.length) {
      SocketAuthority.emitter(
        'items_updated',
        itemsUpdated.map((li) => li.toJSONExpanded())
      )
    }

    res.json({
      updated: itemsUpdated.length
    })
  }

  /**
   * DELETE: /api/libraries/:id/narrators/:narratorId
   * Remove narrator
   * :narratorId is base64 encoded name
   * @param {*} req
   * @param {*} res
   */
  async removeNarrator(req, res) {
    if (!req.user.canUpdate) {
      Logger.error(`[LibraryController] Unauthorized user "${req.user.username}" attempted to remove narrator`)
      return res.sendStatus(403)
    }

    const narratorName = libraryFilters.decode(req.params.narratorId)

    // Update filter data
    Database.removeNarratorFromFilterData(narratorName)

    const itemsUpdated = []

    const itemsWithNarrator = await libraryItemFilters.getAllLibraryItemsWithNarrators([narratorName])

    for (const libraryItem of itemsWithNarrator) {
      libraryItem.media.narrators = libraryItem.media.narrators.filter((n) => n !== narratorName)
      await libraryItem.media.update({
        narrators: libraryItem.media.narrators
      })
      const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(libraryItem)
      itemsUpdated.push(oldLibraryItem)
    }

    if (itemsUpdated.length) {
      SocketAuthority.emitter(
        'items_updated',
        itemsUpdated.map((li) => li.toJSONExpanded())
      )
    }

    res.json({
      updated: itemsUpdated.length
    })
  }

  /**
   * GET: /api/libraries/:id/matchall
   * Quick match all library items. Book libraries only.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async matchAll(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryController] Non-root user attempted to match library items`, req.user)
      return res.sendStatus(403)
    }
    Scanner.matchLibraryItems(req.library)
    res.sendStatus(200)
  }

  /**
   * POST: /api/libraries/:id/scan
   * Optional query:
   * ?force=1
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async scan(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryController] Non-root user attempted to scan library`, req.user)
      return res.sendStatus(403)
    }
    res.sendStatus(200)

    const forceRescan = req.query.force === '1'
    await LibraryScanner.scan(req.library, forceRescan)

    await Database.resetLibraryIssuesFilterData(req.library.id)
    Logger.info('[LibraryController] Scan complete')
  }

  /**
   * GET: /api/libraries/:id/recent-episodes
   * Used for latest page
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getRecentEpisodes(req, res) {
    if (!req.library.isPodcast) {
      return res.sendStatus(404)
    }

    const payload = {
      episodes: [],
      limit: req.query.limit && !isNaN(req.query.limit) ? Number(req.query.limit) : 0,
      page: req.query.page && !isNaN(req.query.page) ? Number(req.query.page) : 0
    }

    const offset = payload.page * payload.limit
    payload.episodes = await libraryItemsPodcastFilters.getRecentEpisodes(req.user, req.library, payload.limit, offset)
    res.json(payload)
  }

  /**
   * GET: /api/libraries/:id/opml
   * Get OPML file for a podcast library
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getOPMLFile(req, res) {
    const userPermissionPodcastWhere = libraryItemsPodcastFilters.getUserPermissionPodcastWhereQuery(req.user)
    const podcasts = await Database.podcastModel.findAll({
      attributes: ['id', 'feedURL', 'title', 'description', 'itunesPageURL', 'language'],
      where: userPermissionPodcastWhere.podcastWhere,
      replacements: userPermissionPodcastWhere.replacements,
      include: {
        model: Database.libraryItemModel,
        attributes: ['id', 'libraryId'],
        where: {
          libraryId: req.library.id
        }
      }
    })

    const opmlText = this.podcastManager.generateOPMLFileText(podcasts)
    res.type('application/xml')
    res.send(opmlText)
  }

  /**
   * Remove all metadata.json or metadata.abs files in library item folders
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async removeAllMetadataFiles(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[LibraryController] Non-admin user attempted to remove all metadata files`, req.user)
      return res.sendStatus(403)
    }

    const fileExt = req.query.ext === 'abs' ? 'abs' : 'json'
    const metadataFilename = `metadata.${fileExt}`
    const libraryItemsWithMetadata = await Database.libraryItemModel.findAll({
      attributes: ['id', 'libraryFiles'],
      where: [
        {
          libraryId: req.library.id
        },
        Sequelize.where(Sequelize.literal(`(SELECT count(*) FROM json_each(libraryFiles) WHERE json_valid(libraryFiles) AND json_extract(json_each.value, "$.metadata.filename") = "${metadataFilename}")`), {
          [Sequelize.Op.gte]: 1
        })
      ]
    })
    if (!libraryItemsWithMetadata.length) {
      Logger.info(`[LibraryController] No ${metadataFilename} files found to remove`)
      return res.json({
        found: 0
      })
    }

    Logger.info(`[LibraryController] Found ${libraryItemsWithMetadata.length} ${metadataFilename} files to remove`)

    let numRemoved = 0
    for (const libraryItem of libraryItemsWithMetadata) {
      const metadataFilepath = libraryItem.libraryFiles.find((lf) => lf.metadata.filename === metadataFilename)?.metadata.path
      if (!metadataFilepath) continue
      Logger.debug(`[LibraryController] Removing file "${metadataFilepath}"`)
      if (await fileUtils.removeFile(metadataFilepath)) {
        numRemoved++
      }
    }

    res.json({
      found: libraryItemsWithMetadata.length,
      removed: numRemoved
    })
  }

  /**
   * Middleware that is not using libraryItems from memory
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async middleware(req, res, next) {
    if (!req.user.checkCanAccessLibrary(req.params.id)) {
      Logger.warn(`[LibraryController] Library ${req.params.id} not accessible to user ${req.user.username}`)
      return res.sendStatus(403)
    }

    const library = await Database.libraryModel.getOldById(req.params.id)
    if (!library) {
      return res.status(404).send('Library not found')
    }
    req.library = library
    next()
  }
}
module.exports = new LibraryController()
