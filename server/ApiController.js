const express = require('express')
const Path = require('path')
const fs = require('fs-extra')
const date = require('date-and-time')
const axios = require('axios')

const Logger = require('./Logger')
const { isObject } = require('./utils/index')
const { parsePodcastRssFeedXml } = require('./utils/podcastUtils')

const BookController = require('./controllers/BookController')
const LibraryController = require('./controllers/LibraryController')
const UserController = require('./controllers/UserController')
const CollectionController = require('./controllers/CollectionController')
const MeController = require('./controllers/MeController')
const BackupController = require('./controllers/BackupController')

const BookFinder = require('./BookFinder')
const AuthorFinder = require('./AuthorFinder')
const FileSystemController = require('./controllers/FileSystemController')

class ApiController {
  constructor(db, auth, scanner, streamManager, rssFeeds, downloadManager, coverController, backupManager, watcher, cacheManager, emitter, clientEmitter) {
    this.db = db
    this.auth = auth
    this.scanner = scanner
    this.streamManager = streamManager
    this.rssFeeds = rssFeeds
    this.downloadManager = downloadManager
    this.backupManager = backupManager
    this.coverController = coverController
    this.watcher = watcher
    this.cacheManager = cacheManager
    this.emitter = emitter
    this.clientEmitter = clientEmitter

    this.bookFinder = new BookFinder()
    this.authorFinder = new AuthorFinder()

    this.router = express()
    this.init()
  }

  init() {
    //
    // Library Routes
    //
    this.router.post('/libraries', LibraryController.create.bind(this))
    this.router.get('/libraries', LibraryController.findAll.bind(this))
    this.router.get('/libraries/:id', LibraryController.middleware.bind(this), LibraryController.findOne.bind(this))
    this.router.patch('/libraries/:id', LibraryController.middleware.bind(this), LibraryController.update.bind(this))
    this.router.delete('/libraries/:id', LibraryController.middleware.bind(this), LibraryController.delete.bind(this))

    this.router.get('/libraries/:id/books/all', LibraryController.middleware.bind(this), LibraryController.getBooksForLibrary2.bind(this))
    this.router.get('/libraries/:id/books', LibraryController.middleware.bind(this), LibraryController.getBooksForLibrary.bind(this))
    this.router.get('/libraries/:id/series', LibraryController.middleware.bind(this), LibraryController.getAllSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/series/:series', LibraryController.middleware.bind(this), LibraryController.getSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/collections', LibraryController.middleware.bind(this), LibraryController.getCollectionsForLibrary.bind(this))
    this.router.get('/libraries/:id/categories', LibraryController.middleware.bind(this), LibraryController.getLibraryCategories.bind(this))
    this.router.get('/libraries/:id/filters', LibraryController.middleware.bind(this), LibraryController.getLibraryFilters.bind(this))
    this.router.get('/libraries/:id/search', LibraryController.middleware.bind(this), LibraryController.search.bind(this))
    this.router.get('/libraries/:id/stats', LibraryController.middleware.bind(this), LibraryController.stats.bind(this))
    this.router.get('/libraries/:id/authors', LibraryController.middleware.bind(this), LibraryController.getAuthors.bind(this))
    this.router.post('/libraries/:id/matchbooks', LibraryController.middleware.bind(this), LibraryController.matchBooks.bind(this))
    this.router.post('/libraries/order', LibraryController.reorder.bind(this))

    //
    // Book Routes
    //
    this.router.get('/books', BookController.findAll.bind(this))
    this.router.get('/books/:id', BookController.findOne.bind(this))
    this.router.patch('/books/:id', BookController.update.bind(this))
    this.router.delete('/books/:id', BookController.delete.bind(this))

    this.router.delete('/books/all', BookController.deleteAll.bind(this))
    this.router.post('/books/batch/delete', BookController.batchDelete.bind(this))
    this.router.post('/books/batch/update', BookController.batchUpdate.bind(this))
    this.router.post('/books/batch/get', BookController.batchGet.bind(this))
    this.router.patch('/books/:id/tracks', BookController.updateTracks.bind(this))
    this.router.get('/books/:id/stream', BookController.openStream.bind(this))
    this.router.post('/books/:id/cover', BookController.uploadCover.bind(this))
    this.router.get('/books/:id/cover', BookController.getCover.bind(this))
    this.router.patch('/books/:id/coverfile', BookController.updateCoverFromFile.bind(this))
    this.router.post('/books/:id/match', BookController.match.bind(this))

    //
    // User Routes
    //
    this.router.post('/users', UserController.create.bind(this))
    this.router.get('/users', UserController.findAll.bind(this))
    this.router.get('/users/:id', UserController.findOne.bind(this))
    this.router.patch('/users/:id', UserController.update.bind(this))
    this.router.delete('/users/:id', UserController.delete.bind(this))

    this.router.get('/users/:id/listening-sessions', UserController.getListeningStats.bind(this))
    this.router.get('/users/:id/listening-stats', UserController.getListeningStats.bind(this))

    //
    // Collection Routes
    //
    this.router.post('/collections', CollectionController.create.bind(this))
    this.router.get('/collections', CollectionController.findAll.bind(this))
    this.router.get('/collections/:id', CollectionController.findOne.bind(this))
    this.router.patch('/collections/:id', CollectionController.update.bind(this))
    this.router.delete('/collections/:id', CollectionController.delete.bind(this))

    this.router.post('/collections/:id/book', CollectionController.addBook.bind(this))
    this.router.delete('/collections/:id/book/:bookId', CollectionController.removeBook.bind(this))
    this.router.post('/collections/:id/batch/add', CollectionController.addBatch.bind(this))
    this.router.post('/collections/:id/batch/remove', CollectionController.removeBatch.bind(this))

    //
    // Current User Routes (Me)
    //
    this.router.get('/me/listening-sessions', MeController.getListeningSessions.bind(this))
    this.router.get('/me/listening-stats', MeController.getListeningStats.bind(this))
    this.router.patch('/me/audiobook/:id/reset-progress', MeController.resetAudiobookProgress.bind(this))
    this.router.patch('/me/audiobook/:id', MeController.updateAudiobookData.bind(this))
    this.router.patch('/me/audiobook/batch/update', MeController.batchUpdateAudiobookData.bind(this))
    this.router.patch('/me/password', MeController.updatePassword.bind(this))
    this.router.patch('/me/settings', MeController.updateSettings.bind(this))

    //
    // Backup Routes
    //
    this.router.delete('/backup/:id', BackupController.delete.bind(this))
    this.router.post('/backup/upload', BackupController.upload.bind(this))

    //
    // Search Routes
    //
    this.router.get('/search/covers', this.findCovers.bind(this))
    this.router.get('/search/books', this.findBooks.bind(this))

    //
    // File System Routes
    //
    this.router.get('/filesystem', FileSystemController.getPaths.bind(this))

    //
    // Others
    //
    this.router.get('/authors', this.getAuthors.bind(this))
    this.router.get('/authors/search', this.searchAuthor.bind(this))
    this.router.get('/authors/:id', this.getAuthor.bind(this))
    this.router.post('/authors', this.createAuthor.bind(this))
    this.router.patch('/authors/:id', this.updateAuthor.bind(this))
    this.router.delete('/authors/:id', this.deleteAuthor.bind(this))

    this.router.patch('/serverSettings', this.updateServerSettings.bind(this))

    this.router.post('/authorize', this.authorize.bind(this))

    this.router.post('/feed', this.openRssFeed.bind(this))

    this.router.get('/download/:id', this.download.bind(this))

    this.router.post('/syncUserAudiobookData', this.syncUserAudiobookData.bind(this))

    this.router.post('/purgecache', this.purgeCache.bind(this))

    this.router.post('/syncStream', this.syncStream.bind(this))
    this.router.post('/syncLocal', this.syncLocal.bind(this))

    this.router.post('/streams/:id/close', this.closeStream.bind(this))

    this.router.post('/getPodcastFeed', this.getPodcastFeed.bind(this))
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
    var result = await this.bookFinder.findCovers(query.provider, query.title, query.author || null)
    res.json(result)
  }

  authorize(req, res) {
    if (!req.user) {
      Logger.error('Invalid user in authorize')
      return res.sendStatus(401)
    }
    res.json({ user: req.user })
  }

  async openRssFeed(req, res) {
    var audiobookId = req.body.audiobookId
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    if (!audiobook) return res.sendStatus(404)
    var feed = await this.rssFeeds.openFeed(audiobook)
    console.log('Feed open', feed)
    res.json(feed)
  }

  async getAuthors(req, res) {
    var authors = this.db.authors.filter(p => p.isAuthor)
    res.json(authors)
  }

  async getAuthor(req, res) {
    var author = this.db.authors.find(p => p.id === req.params.id)
    if (!author) {
      return res.status(404).send('Author not found')
    }
    res.json(author.toJSON())
  }

  async searchAuthor(req, res) {
    var query = req.query.q
    var author = await this.authorFinder.findAuthorByName(query)
    res.json(author)
  }

  async createAuthor(req, res) {
    var author = await this.authorFinder.createAuthor(req.body)
    if (!author) {
      return res.status(500).send('Failed to create author')
    }

    await this.db.insertEntity('author', author)
    this.emitter('author_added', author.toJSON())
    res.json(author)
  }

  async updateAuthor(req, res) {
    var author = this.db.authors.find(p => p.id === req.params.id)
    if (!author) {
      return res.status(404).send('Author not found')
    }

    var wasUpdated = author.update(req.body)
    if (wasUpdated) {
      await this.db.updateEntity('author', author)
      this.emitter('author_updated', author.toJSON())
    }
    res.json(author)
  }

  async deleteAuthor(req, res) {
    var author = this.db.authors.find(p => p.id === req.params.id)
    if (!author) {
      return res.status(404).send('Author not found')
    }

    var authorJson = author.toJSON()

    await this.db.removeEntity('author', author.id)
    this.emitter('author_removed', authorJson)
    res.sendStatus(200)
  }

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

  async getDirectories(dir, relpath, excludedDirs, level = 0) {
    try {
      var paths = await fs.readdir(dir)

      var dirs = await Promise.all(paths.map(async dirname => {
        var fullPath = Path.join(dir, dirname)
        var path = Path.join(relpath, dirname)

        var isDir = (await fs.lstat(fullPath)).isDirectory()
        if (isDir && !excludedDirs.includes(path) && dirname !== 'node_modules') {
          return {
            path,
            dirname,
            fullPath,
            level,
            dirs: level < 4 ? (await this.getDirectories(fullPath, path, excludedDirs, level + 1)) : []
          }
        } else {
          return false
        }
      }))
      dirs = dirs.filter(d => d)
      return dirs
    } catch (error) {
      Logger.error('Failed to readdir', dir, error)
      return []
    }
  }

  async syncUserAudiobookData(req, res) {
    if (!req.body.data) {
      return res.status(403).send('Invalid local user audiobook data')
    }

    var hasUpdates = false

    // Local user audiobook data use the latest update
    req.body.data.forEach((uab) => {
      if (!uab || !uab.audiobookId) {
        Logger.error('[ApiController] Invalid user audiobook data', uab)
        return
      }
      var audiobook = this.db.audiobooks.find(ab => ab.id === uab.audiobookId)
      if (!audiobook) {
        Logger.info('[ApiController] syncUserAudiobookData local audiobook data audiobook no longer exists', uab.audiobookId)
        return
      }
      if (req.user.syncLocalUserAudiobookData(uab, audiobook)) {
        this.clientEmitter(req.user.id, 'current_user_audiobook_update', { id: uab.audiobookId, data: uab })
        hasUpdates = true
      }
    })

    if (hasUpdates) {
      await this.db.updateEntity('user', req.user)
    }

    var allUserAudiobookData = Object.values(req.user.audiobooksToJSON())
    res.json(allUserAudiobookData)
  }

  // Sync audiobook stream progress
  async syncStream(req, res) {
    Logger.debug(`[ApiController] syncStream for ${req.user.username} - ${req.body.streamId}`)
    this.streamManager.streamSyncFromApi(req, res)
  }

  // Sync local downloaded audiobook progress
  async syncLocal(req, res) {
    Logger.debug(`[ApiController] syncLocal for ${req.user.username}`)
    var progressPayload = req.body
    var audiobookProgress = req.user.updateAudiobookData(progressPayload.audiobookId, progressPayload)
    if (audiobookProgress) {
      await this.db.updateEntity('user', req.user)
      this.clientEmitter(req.user.id, 'current_user_audiobook_update', {
        id: progressPayload.audiobookId,
        data: audiobookProgress || null
      })
    }
    res.sendStatus(200)
  }

  //
  // Helper Methods
  //
  userJsonWithBookProgressDetails(user) {
    var json = user.toJSONForBrowser()

    // User audiobook progress attach book details
    if (json.audiobooks && Object.keys(json.audiobooks).length) {
      for (const audiobookId in json.audiobooks) {
        var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
        if (!audiobook) {
          Logger.error('[ApiController] Audiobook not found for users progress ' + audiobookId)
        } else {
          json.audiobooks[audiobookId].book = audiobook.book.toJSON()
        }
      }
    }

    return json
  }

  async handleDeleteAudiobook(audiobook) {
    // Remove audiobook from users
    for (let i = 0; i < this.db.users.length; i++) {
      var user = this.db.users[i]
      var madeUpdates = user.deleteAudiobookData(audiobook.id)
      if (madeUpdates) {
        await this.db.updateEntity('user', user)
      }
    }

    // remove any streams open for this audiobook
    var streams = this.streamManager.streams.filter(stream => stream.audiobookId === audiobook.id)
    for (let i = 0; i < streams.length; i++) {
      var stream = streams[i]
      var client = stream.client
      await stream.close()
      if (client && client.user) {
        client.user.stream = null
        client.stream = null
        this.db.updateUserStream(client.user.id, null)
      }
    }

    // remove book from collections
    var collectionsWithBook = this.db.collections.filter(c => c.books.includes(audiobook.id))
    for (let i = 0; i < collectionsWithBook.length; i++) {
      var collection = collectionsWithBook[i]
      collection.removeBook(audiobook.id)
      await this.db.updateEntity('collection', collection)
      this.clientEmitter(collection.userId, 'collection_updated', collection.toJSONExpanded(this.db.audiobooks))
    }

    // purge cover cache
    if (audiobook.cover) {
      await this.cacheManager.purgeCoverCache(audiobook.id)
    }

    var audiobookJSON = audiobook.toJSONMinified()
    await this.db.removeEntity('audiobook', audiobook.id)
    this.emitter('audiobook_removed', audiobookJSON)
  }

  async getUserListeningSessionsHelper(userId) {
    var userSessions = await this.db.selectUserSessions(userId)
    var listeningSessions = userSessions.filter(us => us.sessionType === 'listeningSession')
    return listeningSessions.sort((a, b) => b.lastUpdate - a.lastUpdate)
  }

  async getUserListeningStatsHelpers(userId) {
    const today = date.format(new Date(), 'YYYY-MM-DD')

    var listeningSessions = await this.getUserListeningSessionsHelper(userId)
    var listeningStats = {
      totalTime: 0,
      books: {},
      days: {},
      dayOfWeek: {},
      today: 0,
      recentSessions: listeningSessions.slice(0, 10)
    }
    listeningSessions.forEach((s) => {
      if (s.dayOfWeek) {
        if (!listeningStats.dayOfWeek[s.dayOfWeek]) listeningStats.dayOfWeek[s.dayOfWeek] = 0
        listeningStats.dayOfWeek[s.dayOfWeek] += s.timeListening
      }
      if (s.date && s.timeListening > 0) {
        if (!listeningStats.days[s.date]) listeningStats.days[s.date] = 0
        listeningStats.days[s.date] += s.timeListening

        if (s.date === today) {
          listeningStats.today += s.timeListening
        }
      }
      if (!listeningStats.books[s.audiobookId]) {
        listeningStats.books[s.audiobookId] = {
          id: s.audiobookId,
          timeListening: s.timeListening,
          title: s.audiobookTitle,
          author: s.audiobookAuthor,
          lastUpdate: s.lastUpdate
        }
      } else {
        listeningStats.books[s.audiobookId].timeListening += s.timeListening
      }

      listeningStats.totalTime += s.timeListening
    })
    return listeningStats
  }

  async purgeCache(req, res) {
    if (!req.user.isRoot) {
      return res.sendStatus(403)
    }
    Logger.info(`[ApiController] Purging all cache`)
    await this.cacheManager.purgeAll()
    res.sendStatus(200)
  }

  async closeStream(req, res) {
    const streamId = req.params.id
    const userId = req.user.id
    this.streamManager.closeStreamApiRequest(userId, streamId)
    res.sendStatus(200)
  }

  getPodcastFeed(req, res) {
    var url = req.body.rssFeed
    if (!url) {
      return res.status(400).send('Bad request')
    }

    axios.get(url).then(async (data) => {
      if (!data || !data.data) {
        Logger.error('Invalid podcast feed request response')
        return res.status(500).send('Bad response from feed request')
      }
      var podcast = await parsePodcastRssFeedXml(data.data)
      if (!podcast) {
        return res.status(500).send('Invalid podcast RSS feed')
      }
      res.json(podcast)
    }).catch((error) => {
      console.error('Failed', error)
      res.status(500).send(error)
    })
  }
}
module.exports = ApiController