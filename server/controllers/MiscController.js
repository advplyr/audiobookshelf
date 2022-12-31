const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const filePerms = require('../utils/filePerms')
const patternValidation = require('../libs/nodeCron/pattern-validation')
const { isObject } = require('../utils/index')

//
// This is a controller for routes that don't have a home yet :(
//
class MiscController {
  constructor() { }

  // POST: api/upload
  async handleUpload(req, res) {
    if (!req.user.canUpload) {
      Logger.warn('User attempted to upload without permission', req.user)
      return res.sendStatus(403)
    }
    var files = Object.values(req.files)
    var title = req.body.title
    var author = req.body.author
    var series = req.body.series
    var libraryId = req.body.library
    var folderId = req.body.folder

    var library = this.db.libraries.find(lib => lib.id === libraryId)
    if (!library) {
      return res.status(404).send(`Library not found with id ${libraryId}`)
    }
    var folder = library.folders.find(fold => fold.id === folderId)
    if (!folder) {
      return res.status(404).send(`Folder not found with id ${folderId} in library ${library.name}`)
    }

    if (!files.length || !title) {
      return res.status(500).send(`Invalid post data`)
    }

    // For setting permissions recursively
    var outputDirectory = ''
    var firstDirPath = ''

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

    var exists = await fs.pathExists(outputDirectory)
    if (exists) {
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

    await filePerms.setDefault(firstDirPath)

    res.sendStatus(200)
  }

  // GET: api/tasks
  getTasks(req, res) {
    res.json({
      tasks: this.taskManager.tasks.map(t => t.toJSON())
    })
  }

  // PATCH: api/settings (admin)
  async updateServerSettings(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error('User other than admin attempting to update server settings', req.user)
      return res.sendStatus(403)
    }
    var settingsUpdate = req.body
    if (!settingsUpdate || !isObject(settingsUpdate)) {
      return res.status(500).send('Invalid settings update object')
    }

    var madeUpdates = this.db.serverSettings.update(settingsUpdate)
    if (madeUpdates) {
      // If backup schedule is updated - update backup manager
      if (settingsUpdate.backupSchedule !== undefined) {
        this.backupManager.updateCronSchedule()
      }

      await this.db.updateServerSettings()
    }
    return res.json({
      success: true,
      serverSettings: this.db.serverSettings.toJSONForBrowser()
    })
  }

  authorize(req, res) {
    if (!req.user) {
      Logger.error('Invalid user in authorize')
      return res.sendStatus(401)
    }
    const userResponse = this.auth.getUserLoginResponsePayload(req.user)
    res.json(userResponse)
  }

  // GET: api/tags
  getAllTags(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to getAllTags`)
      return res.sendStatus(404)
    }
    const tags = []
    this.db.libraryItems.forEach((li) => {
      if (li.media.tags && li.media.tags.length) {
        li.media.tags.forEach((tag) => {
          if (!tags.includes(tag)) tags.push(tag)
        })
      }
    })
    res.json({
      tags: tags
    })
  }

  // POST: api/tags/rename
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

    for (const li of this.db.libraryItems) {
      if (!li.media.tags || !li.media.tags.length) continue

      if (li.media.tags.includes(newTag)) tagMerged = true // new tag is an existing tag so this is a merge

      if (li.media.tags.includes(tag)) {
        li.media.tags = li.media.tags.filter(t => t !== tag) // Remove old tag
        if (!li.media.tags.includes(newTag)) {
          li.media.tags.push(newTag) // Add new tag
        }
        Logger.debug(`[MiscController] Rename tag "${tag}" to "${newTag}" for item "${li.media.metadata.title}"`)
        await this.db.updateLibraryItem(li)
        SocketAuthority.emitter('item_updated', li.toJSONExpanded())
        numItemsUpdated++
      }
    }

    res.json({
      tagMerged,
      numItemsUpdated
    })
  }

  // DELETE: api/tags/:tag
  async deleteTag(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to deleteTag`)
      return res.sendStatus(404)
    }

    const tag = Buffer.from(decodeURIComponent(req.params.tag), 'base64').toString()

    let numItemsUpdated = 0
    for (const li of this.db.libraryItems) {
      if (!li.media.tags || !li.media.tags.length) continue

      if (li.media.tags.includes(tag)) {
        li.media.tags = li.media.tags.filter(t => t !== tag)
        Logger.debug(`[MiscController] Remove tag "${tag}" from item "${li.media.metadata.title}"`)
        await this.db.updateLibraryItem(li)
        SocketAuthority.emitter('item_updated', li.toJSONExpanded())
        numItemsUpdated++
      }
    }

    res.json({
      numItemsUpdated
    })
  }

  // GET: api/genres
  getAllGenres(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to getAllGenres`)
      return res.sendStatus(404)
    }
    const genres = []
    this.db.libraryItems.forEach((li) => {
      if (li.media.metadata.genres && li.media.metadata.genres.length) {
        li.media.metadata.genres.forEach((genre) => {
          if (!genres.includes(genre)) genres.push(genre)
        })
      }
    })
    res.json({
      genres
    })
  }

  // POST: api/genres/rename
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

    for (const li of this.db.libraryItems) {
      if (!li.media.metadata.genres || !li.media.metadata.genres.length) continue

      if (li.media.metadata.genres.includes(newGenre)) genreMerged = true // new genre is an existing genre so this is a merge

      if (li.media.metadata.genres.includes(genre)) {
        li.media.metadata.genres = li.media.metadata.genres.filter(g => g !== genre) // Remove old genre
        if (!li.media.metadata.genres.includes(newGenre)) {
          li.media.metadata.genres.push(newGenre) // Add new genre
        }
        Logger.debug(`[MiscController] Rename genre "${genre}" to "${newGenre}" for item "${li.media.metadata.title}"`)
        await this.db.updateLibraryItem(li)
        SocketAuthority.emitter('item_updated', li.toJSONExpanded())
        numItemsUpdated++
      }
    }

    res.json({
      genreMerged,
      numItemsUpdated
    })
  }

  // DELETE: api/genres/:genre
  async deleteGenre(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to deleteGenre`)
      return res.sendStatus(404)
    }

    const genre = Buffer.from(decodeURIComponent(req.params.genre), 'base64').toString()

    let numItemsUpdated = 0
    for (const li of this.db.libraryItems) {
      if (!li.media.metadata.genres || !li.media.metadata.genres.length) continue

      if (li.media.metadata.genres.includes(genre)) {
        li.media.metadata.genres = li.media.metadata.genres.filter(t => t !== genre)
        Logger.debug(`[MiscController] Remove genre "${genre}" from item "${li.media.metadata.title}"`)
        await this.db.updateLibraryItem(li)
        SocketAuthority.emitter('item_updated', li.toJSONExpanded())
        numItemsUpdated++
      }
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
}
module.exports = new MiscController()