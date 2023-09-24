const Sequelize = require('sequelize')
const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

const libraryItemFilters = require('../utils/queries/libraryItemFilters')
const patternValidation = require('../libs/nodeCron/pattern-validation')
const { isObject, getTitleIgnorePrefix } = require('../utils/index')

//
// This is a controller for routes that don't have a home yet :(
//
class MiscController {
  constructor() { }

  /**
   * POST: /api/upload
   * Update library item
   * @param {*} req 
   * @param {*} res 
   */
  async handleUpload(req, res) {
    if (!req.user.canUpload) {
      Logger.warn('User attempted to upload without permission', req.user)
      return res.sendStatus(403)
    }
    if (!req.files) {
      Logger.error('Invalid request, no files')
      return res.sendStatus(400)
    }
    const files = Object.values(req.files)
    const title = req.body.title
    const author = req.body.author
    const series = req.body.series
    const libraryId = req.body.library
    const folderId = req.body.folder

    const library = await Database.libraryModel.getOldById(libraryId)
    if (!library) {
      return res.status(404).send(`Library not found with id ${libraryId}`)
    }
    const folder = library.folders.find(fold => fold.id === folderId)
    if (!folder) {
      return res.status(404).send(`Folder not found with id ${folderId} in library ${library.name}`)
    }

    if (!files.length || !title) {
      return res.status(500).send(`Invalid post data`)
    }

    // For setting permissions recursively
    let outputDirectory = ''
    let firstDirPath = ''

    if (library.isPodcast) { // Podcasts only in 1 folder
      outputDirectory = Path.join(folder.fullPath, title)
      firstDirPath = outputDirectory
    } else {
      firstDirPath = Path.join(folder.fullPath, author)
      if (series && author) {
        outputDirectory = Path.join(folder.fullPath, author, series, title)
      } else if (author) {
        outputDirectory = Path.join(folder.fullPath, author, title)
      } else {
        outputDirectory = Path.join(folder.fullPath, title)
      }
    }

    if (await fs.pathExists(outputDirectory)) {
      Logger.error(`[Server] Upload directory "${outputDirectory}" already exists`)
      return res.status(500).send(`Directory "${outputDirectory}" already exists`)
    }

    await fs.ensureDir(outputDirectory)

    Logger.info(`Uploading ${files.length} files to`, outputDirectory)

    for (let i = 0; i < files.length; i++) {
      var file = files[i]

      var path = Path.join(outputDirectory, file.name)
      await file.mv(path).then(() => {
        return true
      }).catch((error) => {
        Logger.error('Failed to move file', path, error)
        return false
      })
    }

    res.sendStatus(200)
  }

  /**
   * GET: /api/tasks
   * Get tasks for task manager
   * @param {*} req 
   * @param {*} res 
   */
  getTasks(req, res) {
    const includeArray = (req.query.include || '').split(',')

    const data = {
      tasks: this.taskManager.tasks.map(t => t.toJSON())
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
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async updateServerSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('User other than admin attempting to update server settings', req.user)
      return res.sendStatus(403)
    }
    const settingsUpdate = req.body
    if (!settingsUpdate || !isObject(settingsUpdate)) {
      return res.status(400).send('Invalid settings update object')
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
      success: true,
      serverSettings: Database.serverSettings.toJSONForBrowser()
    })
  }

  /**
   * PATCH: /api/sorting-prefixes
   * 
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async updateSortingPrefixes(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('User other than admin attempting to update server sorting prefixes', req.user)
      return res.sendStatus(403)
    }
    let sortingPrefixes = req.body.sortingPrefixes
    if (!sortingPrefixes?.length || !Array.isArray(sortingPrefixes)) {
      return res.status(400).send('Invalid request body')
    }
    sortingPrefixes = [...new Set(sortingPrefixes.map(p => p?.trim?.().toLowerCase()).filter(p => p))]
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
      attributes: ['id', 'name', 'nameIgnorePrefix']
    })
    const bulkUpdateSeries = []
    allSeries.forEach((series) => {
      const nameIgnorePrefix = getTitleIgnorePrefix(series.name)
      if (nameIgnorePrefix !== series.nameIgnorePrefix) {
        bulkUpdateSeries.push({
          id: series.id,
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
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  async authorize(req, res) {
    if (!req.user) {
      Logger.error('Invalid user in authorize')
      return res.sendStatus(401)
    }
    const userResponse = await this.auth.getUserLoginResponsePayload(req.user)
    res.json(userResponse)
  }

  /**
   * GET: /api/tags
   * Get all tags
   * @param {*} req 
   * @param {*} res 
   */
  async getAllTags(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to getAllTags`)
      return res.sendStatus(404)
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
      tags: tags
    })
  }

  /**
   * POST: /api/tags/rename
   * Rename tag
   * Req.body { tag, newTag }
   * @param {*} req 
   * @param {*} res 
   */
  async renameTag(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to renameTag`)
      return res.sendStatus(404)
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
        libraryItem.media.tags = libraryItem.media.tags.filter(t => t !== tag) // Remove old tag
        if (!libraryItem.media.tags.includes(newTag)) {
          libraryItem.media.tags.push(newTag)
        }
        Logger.debug(`[MiscController] Rename tag "${tag}" to "${newTag}" for item "${libraryItem.media.title}"`)
        await libraryItem.media.update({
          tags: libraryItem.media.tags
        })
        const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(libraryItem)
        SocketAuthority.emitter('item_updated', oldLibraryItem.toJSONExpanded())
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
   * @param {*} req 
   * @param {*} res 
   */
  async deleteTag(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to deleteTag`)
      return res.sendStatus(404)
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
      libraryItem.media.tags = libraryItem.media.tags.filter(t => t !== tag)
      await libraryItem.media.update({
        tags: libraryItem.media.tags
      })
      const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', oldLibraryItem.toJSONExpanded())
      numItemsUpdated++
    }

    res.json({
      numItemsUpdated
    })
  }

  /**
   * GET: /api/genres
   * Get all genres
   * @param {*} req 
   * @param {*} res 
   */
  async getAllGenres(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to getAllGenres`)
      return res.sendStatus(404)
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
   * @param {*} req 
   * @param {*} res 
   */
  async renameGenre(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to renameGenre`)
      return res.sendStatus(404)
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
        libraryItem.media.genres = libraryItem.media.genres.filter(t => t !== genre) // Remove old genre
        if (!libraryItem.media.genres.includes(newGenre)) {
          libraryItem.media.genres.push(newGenre)
        }
        Logger.debug(`[MiscController] Rename genre "${genre}" to "${newGenre}" for item "${libraryItem.media.title}"`)
        await libraryItem.media.update({
          genres: libraryItem.media.genres
        })
        const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(libraryItem)
        SocketAuthority.emitter('item_updated', oldLibraryItem.toJSONExpanded())
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
   * @param {*} req 
   * @param {*} res 
   */
  async deleteGenre(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to deleteGenre`)
      return res.sendStatus(404)
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
      libraryItem.media.genres = libraryItem.media.genres.filter(g => g !== genre)
      await libraryItem.media.update({
        genres: libraryItem.media.genres
      })
      const oldLibraryItem = Database.libraryItemModel.getOldLibraryItem(libraryItem)
      SocketAuthority.emitter('item_updated', oldLibraryItem.toJSONExpanded())
      numItemsUpdated++
    }

    res.json({
      numItemsUpdated
    })
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
   * @param {import('express').Request} req 
   * @param {import('express').Response} res 
   */
  getAuthSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user "${req.user.username}" attempted to get auth settings`)
      return res.sendStatus(403)
    }
    return res.json(Database.serverSettings.authenticationSettings)
  }
}
module.exports = new MiscController()