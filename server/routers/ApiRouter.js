const express = require('express')
const Path = require('path')
const fs = require('fs-extra')
const date = require('date-and-time')
const Logger = require('../Logger')

const LibraryController = require('../controllers/LibraryController')
const UserController = require('../controllers/UserController')
const CollectionController = require('../controllers/CollectionController')
const MeController = require('../controllers/MeController')
const BackupController = require('../controllers/BackupController')
const LibraryItemController = require('../controllers/LibraryItemController')
const SeriesController = require('../controllers/SeriesController')
const AuthorController = require('../controllers/AuthorController')
const MediaEntityController = require('../controllers/MediaEntityController')
const SessionController = require('../controllers/SessionController')
const MiscController = require('../controllers/MiscController')

const BookFinder = require('../finders/BookFinder')
const AuthorFinder = require('../finders/AuthorFinder')
const PodcastFinder = require('../finders/PodcastFinder')

const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')
const FileSystemController = require('../controllers/FileSystemController')

class ApiRouter {
  constructor(db, auth, scanner, playbackSessionManager, downloadManager, coverController, backupManager, watcher, cacheManager, emitter, clientEmitter) {
    this.db = db
    this.auth = auth
    this.scanner = scanner
    this.playbackSessionManager = playbackSessionManager
    this.downloadManager = downloadManager
    this.backupManager = backupManager
    this.coverController = coverController
    this.watcher = watcher
    this.cacheManager = cacheManager
    this.emitter = emitter
    this.clientEmitter = clientEmitter

    this.bookFinder = new BookFinder()
    this.authorFinder = new AuthorFinder()
    this.podcastFinder = new PodcastFinder()

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

    this.router.get('/libraries/:id/items', LibraryController.middleware.bind(this), LibraryController.getLibraryItems.bind(this))
    this.router.get('/libraries/:id/series', LibraryController.middleware.bind(this), LibraryController.getAllSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/series/:series', LibraryController.middleware.bind(this), LibraryController.getSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/collections', LibraryController.middleware.bind(this), LibraryController.getCollectionsForLibrary.bind(this))
    this.router.get('/libraries/:id/personalized', LibraryController.middleware.bind(this), LibraryController.getLibraryUserPersonalized.bind(this))
    this.router.get('/libraries/:id/filterdata', LibraryController.middleware.bind(this), LibraryController.getLibraryFilterData.bind(this))
    this.router.get('/libraries/:id/search', LibraryController.middleware.bind(this), LibraryController.search.bind(this))
    this.router.get('/libraries/:id/stats', LibraryController.middleware.bind(this), LibraryController.stats.bind(this))
    this.router.get('/libraries/:id/authors', LibraryController.middleware.bind(this), LibraryController.getAuthors.bind(this))
    this.router.post('/libraries/:id/matchbooks', LibraryController.middleware.bind(this), LibraryController.matchBooks.bind(this))
    this.router.get('/libraries/:id/scan', LibraryController.middleware.bind(this), LibraryController.scan.bind(this)) // Root only

    this.router.post('/libraries/order', LibraryController.reorder.bind(this))

    //
    // Media Entity Routes
    //
    this.router.get('/entities/:id', MediaEntityController.middleware.bind(this), MediaEntityController.findOne.bind(this))
    this.router.get('/entities/:id/item', MediaEntityController.middleware.bind(this), MediaEntityController.findWithItem.bind(this))
    this.router.patch('/entities/:id/tracks', MediaEntityController.middleware.bind(this), MediaEntityController.updateTracks.bind(this))
    this.router.post('/entities/:id/play', MediaEntityController.middleware.bind(this), MediaEntityController.startPlaybackSession.bind(this))

    //
    // Item Routes
    //
    this.router.delete('/items/all', LibraryItemController.deleteAll.bind(this))

    this.router.get('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.findOne.bind(this))
    this.router.patch('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.update.bind(this))
    this.router.delete('/items/:id', LibraryItemController.middleware.bind(this), LibraryItemController.delete.bind(this))
    this.router.patch('/items/:id/media', LibraryItemController.middleware.bind(this), LibraryItemController.updateMedia.bind(this))
    this.router.get('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.getCover.bind(this))
    this.router.post('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.uploadCover.bind(this))
    this.router.patch('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.updateCover.bind(this))
    this.router.delete('/items/:id/cover', LibraryItemController.middleware.bind(this), LibraryItemController.removeCover.bind(this))
    this.router.post('/items/:id/match', LibraryItemController.middleware.bind(this), LibraryItemController.match.bind(this))
    this.router.post('/items/:id/play', LibraryItemController.middleware.bind(this), LibraryItemController.startPlaybackSession.bind(this))
    this.router.get('/items/:id/scan', LibraryItemController.middleware.bind(this), LibraryItemController.scan.bind(this)) // Root only

    this.router.post('/items/batch/delete', LibraryItemController.batchDelete.bind(this))
    this.router.post('/items/batch/update', LibraryItemController.batchUpdate.bind(this))
    this.router.post('/items/batch/get', LibraryItemController.batchGet.bind(this))

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
    this.router.patch('/me/progress/:id', MeController.createUpdateLibraryItemProgress.bind(this))
    this.router.delete('/me/progress/:id', MeController.removeLibraryItemProgress.bind(this))
    this.router.patch('/me/progress/batch/update', MeController.batchUpdateLibraryItemProgress.bind(this))
    this.router.post('/me/item/:id/bookmark', MeController.createBookmark.bind(this))
    this.router.patch('/me/item/:id/bookmark', MeController.updateBookmark.bind(this))
    this.router.delete('/me/item/:id/bookmark/:time', MeController.removeBookmark.bind(this))
    this.router.patch('/me/password', MeController.updatePassword.bind(this))
    this.router.patch('/me/settings', MeController.updateSettings.bind(this))

    //
    // Backup Routes
    //
    this.router.post('/backups', BackupController.create.bind(this))
    this.router.delete('/backups/:id', BackupController.delete.bind(this))
    this.router.get('/backups/:id/apply', BackupController.apply.bind(this))
    this.router.post('/backups/upload', BackupController.upload.bind(this))

    //
    // File System Routes
    //
    this.router.get('/filesystem', FileSystemController.getPaths.bind(this))

    //
    // Author Routes
    //
    this.router.get('/authors/search', AuthorController.search.bind(this))
    this.router.get('/authors/:id', AuthorController.middleware.bind(this), AuthorController.findOne.bind(this))
    this.router.patch('/authors/:id', AuthorController.middleware.bind(this), AuthorController.update.bind(this))
    this.router.post('/authors/:id/match', AuthorController.middleware.bind(this), AuthorController.match.bind(this))
    this.router.get('/authors/:id/image', AuthorController.middleware.bind(this), AuthorController.getImage.bind(this))

    //
    // Series Routes
    //
    this.router.get('/series/search', SeriesController.search.bind(this))
    this.router.get('/series/:id', SeriesController.middleware.bind(this), SeriesController.findOne.bind(this))

    //
    // Playback Session Routes
    //
    this.router.post('/session/:id/sync', SessionController.middleware.bind(this), SessionController.sync.bind(this))
    this.router.post('/session/:id/close', SessionController.middleware.bind(this), SessionController.close.bind(this))

    //
    // Misc Routes
    //
    this.router.post('/upload', MiscController.handleUpload.bind(this))
    this.router.get('/download/:id', MiscController.download.bind(this))
    this.router.patch('/settings', MiscController.updateServerSettings.bind(this)) // Root only
    this.router.post('/purgecache', MiscController.purgeCache.bind(this)) // Root only
    this.router.post('/getPodcastFeed', MiscController.getPodcastFeed.bind(this))
    this.router.post('/authorize', MiscController.authorize.bind(this))
    this.router.get('/search/covers', MiscController.findCovers.bind(this))
    this.router.get('/search/books', MiscController.findBooks.bind(this))
    this.router.get('/search/podcast', MiscController.findPodcasts.bind(this))
    this.router.get('/search/authors', MiscController.findAuthor.bind(this))

    // OLD
    // this.router.post('/syncUserAudiobookData', this.syncUserAudiobookData.bind(this))
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
    // if (!req.body.data) {
    //   return res.status(403).send('Invalid local user audiobook data')
    // }

    // var hasUpdates = false

    // // Local user audiobook data use the latest update
    // req.body.data.forEach((uab) => {
    //   if (!uab || !uab.audiobookId) {
    //     Logger.error('[ApiController] Invalid user audiobook data', uab)
    //     return
    //   }
    //   var audiobook = this.db.audiobooks.find(ab => ab.id === uab.audiobookId)
    //   if (!audiobook) {
    //     Logger.info('[ApiController] syncUserAudiobookData local audiobook data audiobook no longer exists', uab.audiobookId)
    //     return
    //   }
    //   if (req.user.syncLocalUserAudiobookData(uab, audiobook)) {
    //     this.clientEmitter(req.user.id, 'current_user_audiobook_update', { id: uab.audiobookId, data: uab })
    //     hasUpdates = true
    //   }
    // })

    // if (hasUpdates) {
    //   await this.db.updateEntity('user', req.user)
    // }

    // var allUserAudiobookData = Object.values(req.user.audiobooksToJSON())
    // res.json(allUserAudiobookData)
  }

  //
  // Helper Methods
  //
  userJsonWithItemProgressDetails(user) {
    var json = user.toJSONForBrowser()

    json.libraryItemProgress = json.libraryItemProgress.map(lip => {
      var libraryItem = this.db.libraryItems.find(li => li.id === lip.id)
      if (!libraryItem) {
        Logger.warn('[ApiRouter] Library item not found for users progress ' + lip.id)
        return null
      }
      lip.media = libraryItem.media.toJSONExpanded()
      return lip
    }).filter(lip => !!lip)

    return json
  }

  async handleDeleteLibraryItem(libraryItem) {
    // Remove libraryItem from users
    for (let i = 0; i < this.db.users.length; i++) {
      var user = this.db.users[i]
      var madeUpdates = user.removeLibraryItemProgress(libraryItem.id)
      if (madeUpdates) {
        await this.db.updateEntity('user', user)
      }
    }

    // remove any streams open for this audiobook
    // TODO: Change to PlaybackSessionManager to remove open sessions for user
    // var streams = this.streamManager.streams.filter(stream => stream.audiobookId === libraryItem.id)
    // for (let i = 0; i < streams.length; i++) {
    //   var stream = streams[i]
    //   var client = stream.client
    //   await stream.close()
    //   if (client && client.user) {
    //     client.user.stream = null
    //     client.stream = null
    //     this.db.updateUserStream(client.user.id, null)
    //   }
    // }

    // remove book from collections
    var collectionsWithBook = this.db.collections.filter(c => c.books.includes(libraryItem.id))
    for (let i = 0; i < collectionsWithBook.length; i++) {
      var collection = collectionsWithBook[i]
      collection.removeBook(libraryItem.id)
      await this.db.updateEntity('collection', collection)
      this.clientEmitter(collection.userId, 'collection_updated', collection.toJSONExpanded(this.db.libraryItems))
    }

    // purge cover cache
    if (libraryItem.media.coverPath) {
      await this.cacheManager.purgeCoverCache(libraryItem.id)
    }

    var json = libraryItem.toJSONExpanded()
    await this.db.removeLibraryItem(libraryItem.id)
    this.emitter('item_removed', json)
  }

  async getUserListeningSessionsHelper(userId) {
    var userSessions = await this.db.selectUserSessions(userId)
    return userSessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getUserListeningStatsHelpers(userId) {
    const today = date.format(new Date(), 'YYYY-MM-DD')

    var listeningSessions = await this.getUserListeningSessionsHelper(userId)
    var listeningStats = {
      totalTime: 0,
      items: {},
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
      if (!listeningStats.items[s.libraryItemId]) {
        listeningStats.items[s.libraryItemId] = {
          id: s.libraryItemId,
          timeListening: s.timeListening,
          mediaMetadata: s.mediaMetadata,
          lastUpdate: s.lastUpdate
        }
      } else {
        listeningStats.items[s.libraryItemId].timeListening += s.timeListening
      }

      listeningStats.totalTime += s.timeListening
    })
    return listeningStats
  }

  async createAuthorsAndSeriesForItemUpdate(mediaPayload) {
    if (mediaPayload.metadata) {
      var mediaMetadata = mediaPayload.metadata

      // Create new authors if in payload
      if (mediaMetadata.authors && mediaMetadata.authors.length) {
        // TODO: validate authors
        var newAuthors = []
        for (let i = 0; i < mediaMetadata.authors.length; i++) {
          if (mediaMetadata.authors[i].id.startsWith('new')) {
            var author = this.db.authors.find(au => au.checkNameEquals(mediaMetadata.authors[i].name))
            if (!author) {
              author = new Author()
              author.setData(mediaMetadata.authors[i])
              Logger.debug(`[ApiRouter] Created new author "${author.name}"`)
              newAuthors.push(author)
            }

            // Update ID in original payload
            mediaMetadata.authors[i].id = author.id
          }
        }
        if (newAuthors.length) {
          await this.db.insertEntities('author', newAuthors)
          this.emitter('authors_added', newAuthors)
        }
      }

      // Create new series if in payload
      if (mediaMetadata.series && mediaMetadata.series.length) {
        // TODO: validate series
        var newSeries = []
        for (let i = 0; i < mediaMetadata.series.length; i++) {
          if (mediaMetadata.series[i].id.startsWith('new')) {
            var seriesItem = this.db.series.find(se => se.checkNameEquals(mediaMetadata.series[i].name))
            if (!seriesItem) {
              seriesItem = new Series()
              seriesItem.setData(mediaMetadata.series[i])
              Logger.debug(`[ApiRouter] Created new series "${seriesItem.name}"`)
              newSeries.push(seriesItem)
            }

            // Update ID in original payload
            mediaMetadata.series[i].id = seriesItem.id
          }
        }
        if (newSeries.length) {
          await this.db.insertEntities('series', newSeries)
          this.emitter('authors_added', newSeries)
        }
      }
    }
  }
}
module.exports = ApiRouter