const Path = require('path')
const fs = require('fs-extra')
const Logger = require('../Logger')
const filePerms = require('../utils/filePerms')

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
      return res.status(500).send(`Library not found with id ${libraryId}`)
    }
    var folder = library.folders.find(fold => fold.id === folderId)
    if (!folder) {
      return res.status(500).send(`Folder not found with id ${folderId} in library ${library.name}`)
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

  // GET: api/download/:id
  async download(req, res) {
    if (!req.user.canDownload) {
      Logger.error('User attempting to download without permission', req.user)
      return res.sendStatus(403)
    }
    var downloadId = req.params.id
    Logger.info('Download Request', downloadId)
    var download = this.downloadManager.getDownload(downloadId)
    if (!download) {
      Logger.error('Download request not found', downloadId)
      return res.sendStatus(404)
    }

    var options = {
      headers: {
        'Content-Type': download.mimeType
      }
    }
    res.download(download.fullPath, download.filename, options, (err) => {
      if (err) {
        Logger.error('Download Error', err)
      }
    })
  }

  // PATCH: api/settings (Root)
  async updateServerSettings(req, res) {
    if (!req.user.isRoot) {
      Logger.error('User other than root attempting to update server settings', req.user)
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
      serverSettings: this.db.serverSettings
    })
  }

  // POST: api/purgecache (Root)
  async purgeCache(req, res) {
    if (!req.user.isRoot) {
      return res.sendStatus(403)
    }
    Logger.info(`[ApiRouter] Purging all cache`)
    await this.cacheManager.purgeAll()
    res.sendStatus(200)
  }

  async findBooks(req, res) {
    var provider = req.query.provider || 'google'
    var title = req.query.title || ''
    var author = req.query.author || ''
    var results = await this.bookFinder.search(provider, title, author)
    res.json(results)
  }

  async findCovers(req, res) {
    var query = req.query
    var podcast = query.podcast == 1

    var result = null
    if (podcast) result = await this.podcastFinder.findCovers(query.title)
    else result = await this.bookFinder.findCovers(query.provider, query.title, query.author || null)
    res.json(result)
  }

  async findPodcasts(req, res) {
    var term = req.query.term
    var results = await this.podcastFinder.search(term)
    res.json(results)
  }

  async findAuthor(req, res) {
    var query = req.query.q
    var author = await this.authorFinder.findAuthorByName(query)
    res.json(author)
  }

  authorize(req, res) {
    if (!req.user) {
      Logger.error('Invalid user in authorize')
      return res.sendStatus(401)
    }
    res.json({ user: req.user, userDefaultLibraryId: req.user.getDefaultLibraryId(this.db.libraries) })
  }

  getAllTags(req, res) {
    if (!req.user.isRoot) {
      Logger.error(`[MiscController] Non-root user attempted to getAllTags`)
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
}
module.exports = new MiscController()