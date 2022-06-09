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

  // GET: api/audiobook-merge/:id
  async mergeAudiobook(req, res) {
    if (!req.user.canDownload) {
      Logger.error('User attempting to download without permission', req.user)
      return res.sendStatus(403)
    }

    var libraryItem = this.db.getLibraryItem(req.params.id)
    if (!libraryItem || libraryItem.isMissing || libraryItem.isInvalid) {
      Logger.error(`[MiscController] mergeAudiboook: library item not found or invalid ${req.params.id}`)
      return res.status(404).send('Audiobook not found')
    }

    if (libraryItem.mediaType !== 'book') {
      Logger.error(`[MiscController] mergeAudiboook: Invalid library item ${req.params.id}: not a book`)
      return res.status(500).send('Invalid library item: not a book')
    }

    if (libraryItem.media.tracks.length <= 0) {
      Logger.error(`[MiscController] mergeAudiboook: Invalid audiobook ${req.params.id}: no audio tracks`)
      return res.status(500).send('Invalid audiobook: no audio tracks')
    }

    this.abMergeManager.startAudiobookMerge(req.user, libraryItem)

    res.sendStatus(200)
  }

  // GET: api/download/:id
  async getDownload(req, res) {
    if (!req.user.canDownload) {
      Logger.error('User attempting to download without permission', req.user)
      return res.sendStatus(403)
    }
    var downloadId = req.params.id
    Logger.info('Download Request', downloadId)
    var download = this.abMergeManager.getDownload(downloadId)
    if (!download) {
      Logger.error('Download request not found', downloadId)
      return res.sendStatus(404)
    }

    var options = {
      headers: {
        'Content-Type': download.mimeType
      }
    }
    res.download(download.path, download.filename, options, (err) => {
      if (err) {
        Logger.error('Download Error', err)
      }
    })
  }

  // DELETE: api/download/:id
  async removeDownload(req, res) {
    if (!req.user.canDownload || !req.user.canDelete) {
      Logger.error('User attempting to remove download without permission', req.user.username)
      return res.sendStatus(403)
    }
    this.abMergeManager.removeDownloadById(req.params.id)
    res.sendStatus(200)
  }

  // GET: api/downloads
  async getDownloads(req, res) {
    if (!req.user.canDownload) {
      Logger.error('User attempting to get downloads without permission', req.user.username)
      return res.sendStatus(403)
    }
    var downloads = {
      downloads: this.abMergeManager.downloads,
      pendingDownloads: this.abMergeManager.pendingDownloads
    }
    res.json(downloads)
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
      serverSettings: this.db.serverSettings
    })
  }

  // POST: api/purgecache (admin)
  async purgeCache(req, res) {
    if (!req.user.isAdminOrUp) {
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

  async findChapters(req, res) {
    var asin = req.query.asin
    var chapterData = await this.bookFinder.findChapters(asin)
    if (!chapterData) {
      return res.json({ error: 'Chapters not found' })
    }
    res.json(chapterData)
  }

  authorize(req, res) {
    if (!req.user) {
      Logger.error('Invalid user in authorize')
      return res.sendStatus(401)
    }
    const userResponse = {
      user: req.user,
      userDefaultLibraryId: req.user.getDefaultLibraryId(this.db.libraries),
      serverSettings: this.db.serverSettings.toJSON(),
      Source: global.Source
    }
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
}
module.exports = new MiscController()