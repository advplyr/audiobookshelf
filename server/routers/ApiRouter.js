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
const SessionController = require('../controllers/SessionController')
const PodcastController = require('../controllers/PodcastController')
const MiscController = require('../controllers/MiscController')

const BookFinder = require('../finders/BookFinder')
const AuthorFinder = require('../finders/AuthorFinder')
const PodcastFinder = require('../finders/PodcastFinder')

const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')
const FileSystemController = require('../controllers/FileSystemController')

class ApiRouter {
  constructor(db, auth, scanner, playbackSessionManager, abMergeManager, coverManager, backupManager, watcher, cacheManager, podcastManager, audioMetadataManager, rssFeedManager, emitter, clientEmitter) {
    this.db = db
    this.auth = auth
    this.scanner = scanner
    this.playbackSessionManager = playbackSessionManager
    this.abMergeManager = abMergeManager
    this.backupManager = backupManager
    this.coverManager = coverManager
    this.watcher = watcher
    this.cacheManager = cacheManager
    this.podcastManager = podcastManager
    this.audioMetadataManager = audioMetadataManager
    this.rssFeedManager = rssFeedManager
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
    this.router.delete('/libraries/:id/issues', LibraryController.middleware.bind(this), LibraryController.removeLibraryItemsWithIssues.bind(this))
    this.router.get('/libraries/:id/series', LibraryController.middleware.bind(this), LibraryController.getAllSeriesForLibrary.bind(this))
    this.router.get('/libraries/:id/collections', LibraryController.middleware.bind(this), LibraryController.getCollectionsForLibrary.bind(this))
    this.router.get('/libraries/:id/personalized', LibraryController.middleware.bind(this), LibraryController.getLibraryUserPersonalizedOptimal.bind(this))
    this.router.get('/libraries/:id/filterdata', LibraryController.middleware.bind(this), LibraryController.getLibraryFilterData.bind(this))
    this.router.get('/libraries/:id/search', LibraryController.middleware.bind(this), LibraryController.search.bind(this))
    this.router.get('/libraries/:id/stats', LibraryController.middleware.bind(this), LibraryController.stats.bind(this))
    this.router.get('/libraries/:id/authors', LibraryController.middleware.bind(this), LibraryController.getAuthors.bind(this))
    this.router.post('/libraries/:id/matchall', LibraryController.middleware.bind(this), LibraryController.matchAll.bind(this))
    this.router.get('/libraries/:id/scan', LibraryController.middleware.bind(this), LibraryController.scan.bind(this)) // Root only

    this.router.post('/libraries/order', LibraryController.reorder.bind(this))

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
    this.router.post('/items/:id/play/:episodeId', LibraryItemController.middleware.bind(this), LibraryItemController.startEpisodePlaybackSession.bind(this))
    this.router.patch('/items/:id/tracks', LibraryItemController.middleware.bind(this), LibraryItemController.updateTracks.bind(this))
    this.router.get('/items/:id/scan', LibraryItemController.middleware.bind(this), LibraryItemController.scan.bind(this))
    this.router.get('/items/:id/audio-metadata', LibraryItemController.middleware.bind(this), LibraryItemController.updateAudioFileMetadata.bind(this))
    this.router.post('/items/:id/chapters', LibraryItemController.middleware.bind(this), LibraryItemController.updateMediaChapters.bind(this))
    this.router.post('/items/:id/open-feed', LibraryItemController.middleware.bind(this), LibraryItemController.openRSSFeed.bind(this))
    this.router.post('/items/:id/close-feed', LibraryItemController.middleware.bind(this), LibraryItemController.closeRSSFeed.bind(this))

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

    this.router.get('/users/:id/listening-sessions', UserController.getListeningSessions.bind(this))
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
    this.router.patch('/me/progress/batch/update', MeController.batchUpdateMediaProgress.bind(this))
    this.router.patch('/me/progress/:id', MeController.createUpdateMediaProgress.bind(this))
    this.router.delete('/me/progress/:id', MeController.removeMediaProgress.bind(this))
    this.router.patch('/me/progress/:id/:episodeId', MeController.createUpdateEpisodeMediaProgress.bind(this))
    this.router.post('/me/item/:id/bookmark', MeController.createBookmark.bind(this))
    this.router.patch('/me/item/:id/bookmark', MeController.updateBookmark.bind(this))
    this.router.delete('/me/item/:id/bookmark/:time', MeController.removeBookmark.bind(this))
    this.router.patch('/me/password', MeController.updatePassword.bind(this))
    this.router.patch('/me/settings', MeController.updateSettings.bind(this))
    this.router.post('/me/sync-local-progress', MeController.syncLocalMediaProgress.bind(this))

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
    this.router.post('/session/local', SessionController.syncLocal.bind(this))

    //
    // Podcast Routes
    //
    this.router.post('/podcasts', PodcastController.create.bind(this))
    this.router.post('/podcasts/feed', PodcastController.getPodcastFeed.bind(this))
    this.router.get('/podcasts/:id/checknew', PodcastController.middleware.bind(this), PodcastController.checkNewEpisodes.bind(this))
    this.router.get('/podcasts/:id/downloads', PodcastController.middleware.bind(this), PodcastController.getEpisodeDownloads.bind(this))
    this.router.get('/podcasts/:id/clear-queue', PodcastController.middleware.bind(this), PodcastController.clearEpisodeDownloadQueue.bind(this))
    this.router.post('/podcasts/:id/download-episodes', PodcastController.middleware.bind(this), PodcastController.downloadEpisodes.bind(this))
    this.router.patch('/podcasts/:id/episode/:episodeId', PodcastController.middleware.bind(this), PodcastController.updateEpisode.bind(this))
    this.router.delete('/podcasts/:id/episode/:episodeId', PodcastController.middleware.bind(this), PodcastController.removeEpisode.bind(this))

    //
    // Misc Routes
    //
    this.router.post('/upload', MiscController.handleUpload.bind(this))
    this.router.get('/audiobook-merge/:id', MiscController.mergeAudiobook.bind(this))
    this.router.get('/download/:id', MiscController.getDownload.bind(this))
    this.router.delete('/download/:id', MiscController.removeDownload.bind(this))
    this.router.get('/downloads', MiscController.getDownloads.bind(this))
    this.router.patch('/settings', MiscController.updateServerSettings.bind(this)) // Root only
    this.router.post('/purgecache', MiscController.purgeCache.bind(this)) // Root only
    this.router.post('/authorize', MiscController.authorize.bind(this))
    this.router.get('/search/covers', MiscController.findCovers.bind(this))
    this.router.get('/search/books', MiscController.findBooks.bind(this))
    this.router.get('/search/podcast', MiscController.findPodcasts.bind(this))
    this.router.get('/search/authors', MiscController.findAuthor.bind(this))
    this.router.get('/search/chapters', MiscController.findChapters.bind(this))
    this.router.get('/tags', MiscController.getAllTags.bind(this))
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

  //
  // Helper Methods
  //
  userJsonWithItemProgressDetails(user, hideRootToken = false) {
    var json = user.toJSONForBrowser()
    if (json.type === 'root' && hideRootToken) {
      json.token = ''
    }

    json.mediaProgress = json.mediaProgress.map(lip => {
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
      var madeUpdates = user.removeMediaProgress(libraryItem.id)
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
      var sessionTimeListening = s.timeListening
      if (typeof sessionTimeListening == 'string') {
        sessionTimeListening = Number(sessionTimeListening)
      }

      if (s.dayOfWeek) {
        if (!listeningStats.dayOfWeek[s.dayOfWeek]) listeningStats.dayOfWeek[s.dayOfWeek] = 0
        listeningStats.dayOfWeek[s.dayOfWeek] += sessionTimeListening
      }
      if (s.date && sessionTimeListening > 0) {
        if (!listeningStats.days[s.date]) listeningStats.days[s.date] = 0
        listeningStats.days[s.date] += sessionTimeListening

        if (s.date === today) {
          listeningStats.today += sessionTimeListening
        }
      }
      if (!listeningStats.items[s.libraryItemId]) {
        listeningStats.items[s.libraryItemId] = {
          id: s.libraryItemId,
          timeListening: sessionTimeListening,
          mediaMetadata: s.mediaMetadata,
          lastUpdate: s.lastUpdate
        }
      } else {
        listeningStats.items[s.libraryItemId].timeListening += sessionTimeListening
      }

      listeningStats.totalTime += sessionTimeListening
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