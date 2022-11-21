const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
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
    const userResponse = this.auth.getUserLoginResponsePayload(req.user, this.rssFeedManager.feedsArray)
    res.json(userResponse)
  }

  getAllTags(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[MiscController] Non-admin user attempted to getAllTags`)
      return res.sendStatus(404)
    }
    var tags = []
    this.db.libraryItems.forEach((li) => {
      if (li.media.tags && li.media.tags.length) {
        li.media.tags.forEach((tag) => {
          if (!tags.includes(tag)) tags.push(tag)
        })
      }
    })
    res.json(tags)
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