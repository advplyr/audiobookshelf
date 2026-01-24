const Sequelize = require('sequelize')
const Path = require('path')
const { Request, Response } = require('express')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const Watcher = require('../Watcher')

const libraryItemFilters = require('../utils/queries/libraryItemFilters')
const patternValidation = require('../libs/nodeCron/pattern-validation')
const { isObject, getTitleIgnorePrefix } = require('../utils/index')
const { sanitizeFilename } = require('../utils/fileUtils')

const TaskManager = require('../managers/TaskManager')
const adminStats = require('../utils/queries/adminStats')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class MiscController {
  constructor() {}

  /**
   * POST: /api/upload
   * Update library item
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async handleUpload(req, res) {
    if (!req.user.canUpload) {
      Logger.warn(`User "${req.user.username}" attempted to upload without permission`)
      return res.sendStatus(403)
    }
    if (!req.files || !Object.values(req.files).length) {
      Logger.error('Invalid request, no files')
      return res.sendStatus(400)
    }

    const files = Object.values(req.files)
    let { title, author, series, folder: folderId, library: libraryId } = req.body
    // Validate request body
    if (!libraryId || !folderId || typeof libraryId !== 'string' || typeof folderId !== 'string' || !title || typeof title !== 'string') {
      return res.status(400).send('Invalid request body')
    }
    if (!series || typeof series !== 'string') {
      series = null
    }
    if (!author || typeof author !== 'string') {
      author = null
    }

    const library = await Database.libraryModel.findByIdWithFolders(libraryId)
    if (!library) {
      return res.status(404).send('Library not found')
    }

    if (!req.user.checkCanAccessLibrary(library.id)) {
      Logger.error(`[MiscController] User "${req.user.username}" attempting to upload to library "${library.id}" without access`)
      return res.sendStatus(403)
    }

    const folder = library.libraryFolders.find((fold) => fold.id === folderId)
    if (!folder) {
      return res.status(404).send('Folder not found')
    }

    // Podcasts should only be one folder deep
    const outputDirectoryParts = library.isPodcast ? [title] : [author, series, title]
    // `.filter(Boolean)` to strip out all the potentially missing details (eg: `author`)
    // before sanitizing all the directory parts to remove illegal chars and finally prepending
    // the base folder path
    const cleanedOutputDirectoryParts = outputDirectoryParts.filter(Boolean).map((part) => sanitizeFilename(part))
    const outputDirectory = Path.join(...[folder.path, ...cleanedOutputDirectoryParts])

    await fs.ensureDir(outputDirectory)

    Logger.info(`Uploading ${files.length} files to`, outputDirectory)

    for (const file of files) {
      const path = Path.join(outputDirectory, sanitizeFilename(file.name))

      await file
        .mv(path)
        .then(() => {
          return true
        })
        .catch((error) => {
          Logger.error('Failed to move file', path, error)
          return false
        })
    }

    res.sendStatus(200)
  }

  /**
   * GET: /api/tasks
   * Get tasks for task manager
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getTasks(req, res) {
    const includeArray = (req.query.include || '').split(',')

    const data = {
      tasks: TaskManager.tasks.map((t) => t.toJSON())
    }

    if (includeArray.includes('queue')) {
      data.queuedTaskData = {
        embedMetadata: this.audioMetadataManager.getQueuedTaskData()
      }
    }

    res.json(data)
  }

  /**
   * PATCH: /api/settings
   * Update server settings
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateServerSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`User "${req.user.username}" other than admin attempting to update server settings`)
      return res.sendStatus(403)
    }
    const settingsUpdate = req.body
    if (!isObject(settingsUpdate)) {
      return res.status(400).send('Invalid settings update object')
    }
    if (settingsUpdate.allowIframe == false && process.env.ALLOW_IFRAME === '1') {
      Logger.warn('Cannot disable iframe when ALLOW_IFRAME is enabled in environment')
      return res.status(400).send('Cannot disable iframe when ALLOW_IFRAME is enabled in environment')
    }
    if (settingsUpdate.allowedOrigins && !Array.isArray(settingsUpdate.allowedOrigins)) {
      return res.status(400).send('allowedOrigins must be an array')
    }

    const madeUpdates = Database.serverSettings.update(settingsUpdate)
    if (madeUpdates) {
      await Database.updateServerSettings()

      // If backup schedule is updated - update backup manager
      if (settingsUpdate.backupSchedule !== undefined) {
        this.backupManager.updateCronSchedule()
      }
    }
    return res.json({
      serverSettings: Database.serverSettings.toJSONForBrowser()
    })
  }

  /**
   * PATCH: /api/sorting-prefixes
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateSortingPrefixes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`User "${req.user.username}" other than admin attempting to update server sorting prefixes`)
      return res.sendStatus(403)
    }
    let sortingPrefixes = req.body.sortingPrefixes
    if (!sortingPrefixes?.length || !Array.isArray(sortingPrefixes)) {
      return res.status(400).send('Invalid request body')
    }
    sortingPrefixes = [...new Set(sortingPrefixes.map((p) => p?.trim?.().toLowerCase()).filter((p) => p))]
    if (!sortingPrefixes.length) {
      return res.status(400).send('Invalid sortingPrefixes in request body')
    }

    Logger.debug(`[MiscController] Updating sorting prefixes ${sortingPrefixes.join(', ')}`)
    Database.serverSettings.sortingPrefixes = sortingPrefixes
    await Database.updateServerSettings()

    let rowsUpdated = 0
    // Update titleIgnorePrefix column on books
    const books = await Database.bookModel.findAll({
      attributes: ['id', 'title', 'titleIgnorePrefix']
    })
    const bulkUpdateBooks = []
    books.forEach((book) => {
      const titleIgnorePrefix = getTitleIgnorePrefix(book.title)
      if (titleIgnorePrefix !== book.titleIgnorePrefix) {
        bulkUpdateBooks.push({
          id: book.id,
          titleIgnorePrefix
        })
      }
    })
    if (bulkUpdateBooks.length) {
      Logger.info(`[MiscController] Updating titleIgnorePrefix on ${bulkUpdateBooks.length} books`)
      rowsUpdated += bulkUpdateBooks.length
      await Database.bookModel.bulkCreate(bulkUpdateBooks, {
        updateOnDuplicate: ['titleIgnorePrefix']
      })
    }

    // Update titleIgnorePrefix column on podcasts
    const podcasts = await Database.podcastModel.findAll({
      attributes: ['id', 'title', 'titleIgnorePrefix']
    })
    const bulkUpdatePodcasts = []
    podcasts.forEach((podcast) => {
      const titleIgnorePrefix = getTitleIgnorePrefix(podcast.title)
      if (titleIgnorePrefix !== podcast.titleIgnorePrefix) {
        bulkUpdatePodcasts.push({
          id: podcast.id,
          titleIgnorePrefix
        })
      }
    })
    if (bulkUpdatePodcasts.length) {
      Logger.info(`[MiscController] Updating titleIgnorePrefix on ${bulkUpdatePodcasts.length} podcasts`)
      rowsUpdated += bulkUpdatePodcasts.length
      await Database.podcastModel.bulkCreate(bulkUpdatePodcasts, {
        updateOnDuplicate: ['titleIgnorePrefix']
      })
    }

    // Update nameIgnorePrefix column on series
    const allSeries = await Database.seriesModel.findAll({
      attributes: ['id', 'name', 'nameIgnorePrefix', 'libraryId']
    })
    const bulkUpdateSeries = []
    allSeries.forEach((series) => {
      const nameIgnorePrefix = getTitleIgnorePrefix(series.name)
      if (nameIgnorePrefix !== series.nameIgnorePrefix) {
        bulkUpdateSeries.push({
          id: series.id,
          name: series.name,
          libraryId: series.libraryId,
          nameIgnorePrefix
        })
      }
    })
    if (bulkUpdateSeries.length) {
      Logger.info(`[MiscController] Updating nameIgnorePrefix on ${bulkUpdateSeries.length} series`)
      rowsUpdated += bulkUpdateSeries.length
      await Database.seriesModel.bulkCreate(bulkUpdateSeries, {
        updateOnDuplicate: ['nameIgnorePrefix']
      })
    }

    res.json({
      rowsUpdated,
      serverSettings: Database.serverSettings.toJSONForBrowser()
    })
  }

  /**
   * POST: /api/authorize
   * Used to authorize an API token
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async authorize(req, res) {
    const userResponse = await this.auth.getUserLoginResponsePayload(req.user)
    res.json(userResponse)
  }

  /**
   * GET: /api/tags
   * Get all tags
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAllTags(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to getAllTags`)
      return res.sendStatus(403)
    }

    const tags = []
    const books = await Database.bookModel.findAll({
      attributes: ['tags'],
      where: Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('tags')), {
        [Sequelize.Op.gt]: 0
      })
    })
    for (const book of books) {
      for (const tag of book.tags) {
        if (!tags.includes(tag)) tags.push(tag)
      }
    }

    const podcasts = await Database.podcastModel.findAll({
      attributes: ['tags'],
      where: Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('tags')), {
        [Sequelize.Op.gt]: 0
      })
    })
    for (const podcast of podcasts) {
      for (const tag of podcast.tags) {
        if (!tags.includes(tag)) tags.push(tag)
      }
    }

    res.json({
      tags: tags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    })
  }

  /**
   * POST: /api/tags/rename
   * Rename tag
   * Req.body { tag, newTag }
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async renameTag(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to renameTag`)
      return res.sendStatus(403)
    }

    const tag = req.body.tag
    const newTag = req.body.newTag
    if (!tag || !newTag) {
      Logger.error(`[MiscController] Invalid request body for renameTag`)
      return res.sendStatus(400)
    }

    let tagMerged = false
    let numItemsUpdated = 0

    // Update filter data
    Database.replaceTagInFilterData(tag, newTag)

    const libraryItemsWithTag = await libraryItemFilters.getAllLibraryItemsWithTags([tag, newTag])
    for (const libraryItem of libraryItemsWithTag) {
      if (libraryItem.media.tags.includes(newTag)) {
        tagMerged = true // new tag is an existing tag so this is a merge
      }

      if (libraryItem.media.tags.includes(tag)) {
        libraryItem.media.tags = libraryItem.media.tags.filter((t) => t !== tag) // Remove old tag
        if (!libraryItem.media.tags.includes(newTag)) {
          libraryItem.media.tags.push(newTag)
        }
        Logger.debug(`[MiscController] Rename tag "${tag}" to "${newTag}" for item "${libraryItem.media.title}"`)
        await libraryItem.media.update({
          tags: libraryItem.media.tags
        })
        await libraryItem.saveMetadataFile()

        SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
        numItemsUpdated++
      }
    }

    res.json({
      tagMerged,
      numItemsUpdated
    })
  }

  /**
   * DELETE: /api/tags/:tag
   * Remove a tag
   * :tag param is base64 encoded
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async deleteTag(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to deleteTag`)
      return res.sendStatus(403)
    }

    const tag = Buffer.from(decodeURIComponent(req.params.tag), 'base64').toString()

    // Get all items with tag
    const libraryItemsWithTag = await libraryItemFilters.getAllLibraryItemsWithTags([tag])

    // Update filterdata
    Database.removeTagFromFilterData(tag)

    let numItemsUpdated = 0
    // Remove tag from items
    for (const libraryItem of libraryItemsWithTag) {
      Logger.debug(`[MiscController] Remove tag "${tag}" from item "${libraryItem.media.title}"`)
      libraryItem.media.tags = libraryItem.media.tags.filter((t) => t !== tag)
      await libraryItem.media.update({
        tags: libraryItem.media.tags
      })
      await libraryItem.saveMetadataFile()

      SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
      numItemsUpdated++
    }

    res.json({
      numItemsUpdated
    })
  }

  /**
   * GET: /api/genres
   * Get all genres
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAllGenres(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to getAllGenres`)
      return res.sendStatus(403)
    }
    const genres = []
    const books = await Database.bookModel.findAll({
      attributes: ['genres'],
      where: Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('genres')), {
        [Sequelize.Op.gt]: 0
      })
    })
    for (const book of books) {
      for (const tag of book.genres) {
        if (!genres.includes(tag)) genres.push(tag)
      }
    }

    const podcasts = await Database.podcastModel.findAll({
      attributes: ['genres'],
      where: Sequelize.where(Sequelize.fn('json_array_length', Sequelize.col('genres')), {
        [Sequelize.Op.gt]: 0
      })
    })
    for (const podcast of podcasts) {
      for (const tag of podcast.genres) {
        if (!genres.includes(tag)) genres.push(tag)
      }
    }

    res.json({
      genres
    })
  }

  /**
   * POST: /api/genres/rename
   * Rename genres
   * Req.body { genre, newGenre }
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async renameGenre(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to renameGenre`)
      return res.sendStatus(403)
    }

    const genre = req.body.genre
    const newGenre = req.body.newGenre
    if (!genre || !newGenre) {
      Logger.error(`[MiscController] Invalid request body for renameGenre`)
      return res.sendStatus(400)
    }

    let genreMerged = false
    let numItemsUpdated = 0

    // Update filter data
    Database.replaceGenreInFilterData(genre, newGenre)

    const libraryItemsWithGenre = await libraryItemFilters.getAllLibraryItemsWithGenres([genre, newGenre])
    for (const libraryItem of libraryItemsWithGenre) {
      if (libraryItem.media.genres.includes(newGenre)) {
        genreMerged = true // new genre is an existing genre so this is a merge
      }

      if (libraryItem.media.genres.includes(genre)) {
        libraryItem.media.genres = libraryItem.media.genres.filter((t) => t !== genre) // Remove old genre
        if (!libraryItem.media.genres.includes(newGenre)) {
          libraryItem.media.genres.push(newGenre)
        }
        Logger.debug(`[MiscController] Rename genre "${genre}" to "${newGenre}" for item "${libraryItem.media.title}"`)
        await libraryItem.media.update({
          genres: libraryItem.media.genres
        })
        await libraryItem.saveMetadataFile()

        SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
        numItemsUpdated++
      }
    }

    res.json({
      genreMerged,
      numItemsUpdated
    })
  }

  /**
   * DELETE: /api/genres/:genre
   * Remove a genre
   * :genre param is base64 encoded
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async deleteGenre(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to deleteGenre`)
      return res.sendStatus(403)
    }

    const genre = Buffer.from(decodeURIComponent(req.params.genre), 'base64').toString()

    // Update filter data
    Database.removeGenreFromFilterData(genre)

    // Get all items with genre
    const libraryItemsWithGenre = await libraryItemFilters.getAllLibraryItemsWithGenres([genre])

    let numItemsUpdated = 0
    // Remove genre from items
    for (const libraryItem of libraryItemsWithGenre) {
      Logger.debug(`[MiscController] Remove genre "${genre}" from item "${libraryItem.media.title}"`)
      libraryItem.media.genres = libraryItem.media.genres.filter((g) => g !== genre)
      await libraryItem.media.update({
        genres: libraryItem.media.genres
      })
      await libraryItem.saveMetadataFile()

      SocketAuthority.libraryItemEmitter('item_updated', libraryItem)
      numItemsUpdated++
    }

    res.json({
      numItemsUpdated
    })
  }

  /**
   * POST: /api/watcher/update
   * Update a watch path
   * Req.body { libraryId, path, type, [oldPath] }
   * type = add, unlink, rename
   * oldPath = required only for rename
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  updateWatchedPath(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to updateWatchedPath`)
      return res.sendStatus(403)
    }

    const libraryId = req.body.libraryId
    const path = req.body.path
    const type = req.body.type
    if (!libraryId || !path || !type) {
      Logger.error(`[MiscController] Invalid request body for updateWatchedPath. libraryId: "${libraryId}", path: "${path}", type: "${type}"`)
      return res.sendStatus(400)
    }

    switch (type) {
      case 'add':
        Watcher.onFileAdded(libraryId, path)
        break
      case 'unlink':
        Watcher.onFileRemoved(libraryId, path)
        break
      case 'rename':
        const oldPath = req.body.oldPath
        if (!oldPath) {
          Logger.error(`[MiscController] Invalid request body for updateWatchedPath. oldPath is required for rename.`)
          return res.sendStatus(400)
        }
        Watcher.onFileRename(libraryId, oldPath, path)
        break
      default:
        Logger.error(`[MiscController] Invalid type for updateWatchedPath. type: "${type}"`)
        return res.sendStatus(400)
    }

    res.sendStatus(200)
  }

  validateCronExpression(req, res) {
    const expression = req.body.expression
    if (!expression) {
      return res.sendStatus(400)
    }

    try {
      patternValidation(expression)
      res.sendStatus(200)
    } catch (error) {
      Logger.warn(`[MiscController] Invalid cron expression ${expression}`, error.message)
      res.status(400).send(error.message)
    }
  }

  /**
   * GET: api/auth-settings (admin only)
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getAuthSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to get auth settings`)
      return res.sendStatus(403)
    }
    return res.json(Database.serverSettings.authenticationSettings)
  }

  /**
   * PATCH: api/auth-settings
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateAuthSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to update auth settings`)
      return res.sendStatus(403)
    }

    const settingsUpdate = req.body
    if (!isObject(settingsUpdate)) {
      return res.status(400).send('Invalid auth settings update object')
    }

    let hasUpdates = false

    const currentAuthenticationSettings = Database.serverSettings.authenticationSettings
    const originalAuthMethods = [...currentAuthenticationSettings.authActiveAuthMethods]

    // TODO: Better validation of auth settings once auth settings are separated from server settings
    for (const key in currentAuthenticationSettings) {
      if (settingsUpdate[key] === undefined) continue

      if (key === 'authActiveAuthMethods') {
        let updatedAuthMethods = settingsUpdate[key]?.filter?.((authMeth) => Database.serverSettings.supportedAuthMethods.includes(authMeth))
        if (Array.isArray(updatedAuthMethods) && updatedAuthMethods.length) {
          updatedAuthMethods.sort()
          currentAuthenticationSettings[key].sort()
          if (updatedAuthMethods.join() !== currentAuthenticationSettings[key].join()) {
            Logger.debug(`[MiscController] Updating auth settings key "authActiveAuthMethods" from "${currentAuthenticationSettings[key].join()}" to "${updatedAuthMethods.join()}"`)
            Database.serverSettings[key] = updatedAuthMethods
            hasUpdates = true
          }
        } else {
          Logger.warn(`[MiscController] Invalid value for authActiveAuthMethods`)
        }
      } else if (key === 'authOpenIDMobileRedirectURIs') {
        function isValidRedirectURI(uri) {
          if (typeof uri !== 'string') return false
          const pattern = new RegExp('^\\w+://[\\w\\.-]+(/[\\w\\./-]*)*$', 'i')
          return pattern.test(uri)
        }

        const uris = settingsUpdate[key]
        if (!Array.isArray(uris) || (uris.includes('*') && uris.length > 1) || uris.some((uri) => uri !== '*' && !isValidRedirectURI(uri))) {
          Logger.warn(`[MiscController] Invalid value for authOpenIDMobileRedirectURIs`)
          continue
        }

        // Update the URIs
        if (Database.serverSettings[key].some((uri) => !uris.includes(uri)) || uris.some((uri) => !Database.serverSettings[key].includes(uri))) {
          Logger.debug(`[MiscController] Updating auth settings key "${key}" from "${Database.serverSettings[key]}" to "${uris}"`)
          Database.serverSettings[key] = uris
          hasUpdates = true
        }
      } else {
        const updatedValueType = typeof settingsUpdate[key]
        if (['authOpenIDAutoLaunch', 'authOpenIDAutoRegister'].includes(key)) {
          if (updatedValueType !== 'boolean') {
            Logger.warn(`[MiscController] Invalid value for ${key}. Expected boolean`)
            continue
          }
        } else if (settingsUpdate[key] !== null && updatedValueType !== 'string') {
          Logger.warn(`[MiscController] Invalid value for ${key}. Expected string or null`)
          continue
        }
        let updatedValue = settingsUpdate[key]
        if (updatedValue === '' && key != 'authOpenIDSubfolderForRedirectURLs') updatedValue = null
        let currentValue = currentAuthenticationSettings[key]
        if (currentValue === '' && key != 'authOpenIDSubfolderForRedirectURLs') currentValue = null

        if (updatedValue !== currentValue) {
          Logger.debug(`[MiscController] Updating auth settings key "${key}" from "${currentValue}" to "${updatedValue}"`)
          Database.serverSettings[key] = updatedValue
          hasUpdates = true
        }
      }
    }

    if (hasUpdates) {
      await Database.updateServerSettings()

      // Use/unuse auth methods
      Database.serverSettings.supportedAuthMethods.forEach((authMethod) => {
        if (originalAuthMethods.includes(authMethod) && !Database.serverSettings.authActiveAuthMethods.includes(authMethod)) {
          // Auth method has been removed
          Logger.info(`[MiscController] Disabling active auth method "${authMethod}"`)
          this.auth.unuseAuthStrategy(authMethod)
        } else if (!originalAuthMethods.includes(authMethod) && Database.serverSettings.authActiveAuthMethods.includes(authMethod)) {
          // Auth method has been added
          Logger.info(`[MiscController] Enabling active auth method "${authMethod}"`)
          this.auth.useAuthStrategy(authMethod)
        }
      })
    }

    res.json({
      updated: hasUpdates,
      serverSettings: Database.serverSettings.toJSONForBrowser()
    })
  }

  /**
   * GET: /api/stats/year/:year
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAdminStatsForYear(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to get admin stats for year`)
      return res.sendStatus(403)
    }
    const year = Number(req.params.year)
    if (isNaN(year) || year < 2000 || year > 9999) {
      Logger.error(`[MiscController] Invalid year "${year}"`)
      return res.status(400).send('Invalid year')
    }
    const stats = await adminStats.getStatsForYear(year)
    res.json(stats)
  }

  /**
   * GET: /api/logger-data
   * admin or up
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getLoggerData(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to get logger data`)
      return res.sendStatus(403)
    }

    res.json({
      currentDailyLogs: Logger.logManager.getMostRecentCurrentDailyLogs()
    })
  }
}
module.exports = new MiscController()
