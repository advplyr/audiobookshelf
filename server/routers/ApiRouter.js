const express = require('express')
const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const fs = require('../libs/fsExtra')
const date = require('../libs/dateAndTime')

const LibraryController = require('../controllers/LibraryController')
const UserController = require('../controllers/UserController')
const CollectionController = require('../controllers/CollectionController')
const PlaylistController = require('../controllers/PlaylistController')
const MeController = require('../controllers/MeController')
const BackupController = require('../controllers/BackupController')
const LibraryItemController = require('../controllers/LibraryItemController')
const SeriesController = require('../controllers/SeriesController')
const FileSystemController = require('../controllers/FileSystemController')
const AuthorController = require('../controllers/AuthorController')
const SessionController = require('../controllers/SessionController')
const PodcastController = require('../controllers/PodcastController')
const NotificationController = require('../controllers/NotificationController')
const SearchController = require('../controllers/SearchController')
const CacheController = require('../controllers/CacheController')
const ToolsController = require('../controllers/ToolsController')
const MiscController = require('../controllers/MiscController')

const BookFinder = require('../finders/BookFinder')
const AuthorFinder = require('../finders/AuthorFinder')
const PodcastFinder = require('../finders/PodcastFinder')

const Author = require('../objects/entities/Author')
const Series = require('../objects/entities/Series')

class ApiRouter {
  constructor(Server) {
    this.db = Server.db
    this.auth = Server.auth
    this.scanner = Server.scanner
    this.playbackSessionManager = Server.playbackSessionManager
    this.abMergeManager = Server.abMergeManager
    this.backupManager = Server.backupManager
    this.coverManager = Server.coverManager
    this.watcher = Server.watcher
    this.cacheManager = Server.cacheManager
    this.podcastManager = Server.podcastManager
    this.audioMetadataManager = Server.audioMetadataManager
    this.rssFeedManager = Server.rssFeedManager
    this.cronManager = Server.cronManager
    this.notificationManager = Server.notificationManager
    this.taskManager = Server.taskManager

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
    this.router.get('/libraries/:id/playlists', LibraryController.middleware.bind(this), LibraryController.getUserPlaylistsForLibrary.bind(this))
    this.router.get('/libraries/:id/personalized', LibraryController.middleware.bind(this), LibraryController.getLibraryUserPersonalizedOptimal.bind(this))
    this.router.get('/libraries/:id/filterdata', LibraryController.middleware.bind(this), LibraryController.getLibraryFilterData.bind(this))
    this.router.get('/libraries/:id/search', LibraryController.middleware.bind(this), LibraryController.search.bind(this))
    this.router.get('/libraries/:id/stats', LibraryController.middleware.bind(this), LibraryController.stats.bind(this))
    this.router.get('/libraries/:id/authors', LibraryController.middleware.bind(this), LibraryController.getAuthors.bind(this))
    this.router.get('/libraries/:id/matchall', LibraryController.middleware.bind(this), LibraryController.matchAll.bind(this))
    this.router.get('/libraries/:id/scan', LibraryController.middleware.bind(this), LibraryController.scan.bind(this))
    this.router.get('/libraries/:id/recent-episodes', LibraryController.middleware.bind(this), LibraryController.getRecentEpisodes.bind(this))

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
    this.router.get('/items/:id/tone-object', LibraryItemController.middleware.bind(this), LibraryItemController.getToneMetadataObject.bind(this))
    this.router.post('/items/:id/chapters', LibraryItemController.middleware.bind(this), LibraryItemController.updateMediaChapters.bind(this))
    this.router.post('/items/:id/open-feed', LibraryItemController.middleware.bind(this), LibraryItemController.openRSSFeed.bind(this))
    this.router.post('/items/:id/close-feed', LibraryItemController.middleware.bind(this), LibraryItemController.closeRSSFeed.bind(this))
    this.router.post('/items/:id/tone-scan/:index?', LibraryItemController.middleware.bind(this), LibraryItemController.toneScan.bind(this))

    this.router.post('/items/batch/delete', LibraryItemController.batchDelete.bind(this))
    this.router.post('/items/batch/update', LibraryItemController.batchUpdate.bind(this))
    this.router.post('/items/batch/get', LibraryItemController.batchGet.bind(this))
    this.router.post('/items/batch/quickmatch', LibraryItemController.batchQuickMatch.bind(this))

    //
    // User Routes
    //
    this.router.post('/users', UserController.middleware.bind(this), UserController.create.bind(this))
    this.router.get('/users', UserController.middleware.bind(this), UserController.findAll.bind(this))
    this.router.get('/users/online', UserController.getOnlineUsers.bind(this))
    this.router.get('/users/:id', UserController.middleware.bind(this), UserController.findOne.bind(this))
    this.router.patch('/users/:id', UserController.middleware.bind(this), UserController.update.bind(this))
    this.router.delete('/users/:id', UserController.middleware.bind(this), UserController.delete.bind(this))

    this.router.get('/users/:id/listening-sessions', UserController.middleware.bind(this), UserController.getListeningSessions.bind(this))
    this.router.get('/users/:id/listening-stats', UserController.middleware.bind(this), UserController.getListeningStats.bind(this))
    this.router.post('/users/:id/purge-media-progress', UserController.middleware.bind(this), UserController.purgeMediaProgress.bind(this))

    //
    // Collection Routes
    //
    this.router.post('/collections', CollectionController.middleware.bind(this), CollectionController.create.bind(this))
    this.router.get('/collections', CollectionController.findAll.bind(this))
    this.router.get('/collections/:id', CollectionController.middleware.bind(this), CollectionController.findOne.bind(this))
    this.router.patch('/collections/:id', CollectionController.middleware.bind(this), CollectionController.update.bind(this))
    this.router.delete('/collections/:id', CollectionController.middleware.bind(this), CollectionController.delete.bind(this))
    this.router.post('/collections/:id/book', CollectionController.middleware.bind(this), CollectionController.addBook.bind(this))
    this.router.delete('/collections/:id/book/:bookId', CollectionController.middleware.bind(this), CollectionController.removeBook.bind(this))
    this.router.post('/collections/:id/batch/add', CollectionController.middleware.bind(this), CollectionController.addBatch.bind(this))
    this.router.post('/collections/:id/batch/remove', CollectionController.middleware.bind(this), CollectionController.removeBatch.bind(this))

    //
    // Playlist Routes
    //
    this.router.post('/playlists', PlaylistController.middleware.bind(this), PlaylistController.create.bind(this))
    this.router.get('/playlists', PlaylistController.findAllForUser.bind(this))
    this.router.get('/playlists/:id', PlaylistController.middleware.bind(this), PlaylistController.findOne.bind(this))
    this.router.patch('/playlists/:id', PlaylistController.middleware.bind(this), PlaylistController.update.bind(this))
    this.router.delete('/playlists/:id', PlaylistController.middleware.bind(this), PlaylistController.delete.bind(this))
    this.router.post('/playlists/:id/item', PlaylistController.middleware.bind(this), PlaylistController.addItem.bind(this))
    this.router.delete('/playlists/:id/item/:libraryItemId/:episodeId?', PlaylistController.middleware.bind(this), PlaylistController.removeItem.bind(this))
    this.router.post('/playlists/:id/batch/add', PlaylistController.middleware.bind(this), PlaylistController.addBatch.bind(this))
    this.router.post('/playlists/:id/batch/remove', PlaylistController.middleware.bind(this), PlaylistController.removeBatch.bind(this))

    //
    // Current User Routes (Me)
    //
    this.router.get('/me/listening-sessions', MeController.getListeningSessions.bind(this))
    this.router.get('/me/listening-stats', MeController.getListeningStats.bind(this))
    this.router.get('/me/progress/:id/remove-from-continue-listening', MeController.removeItemFromContinueListening.bind(this))
    this.router.get('/me/progress/:id/:episodeId?', MeController.getMediaProgress.bind(this))
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
    this.router.get('/me/items-in-progress', MeController.getAllLibraryItemsInProgress.bind(this))
    this.router.get('/me/series/:id/remove-from-continue-listening', MeController.removeSeriesFromContinueListening.bind(this))
    this.router.get('/me/series/:id/readd-to-continue-listening', MeController.readdSeriesFromContinueListening.bind(this))

    //
    // Backup Routes
    //
    this.router.get('/backups', BackupController.middleware.bind(this), BackupController.getAll.bind(this))
    this.router.post('/backups', BackupController.middleware.bind(this), BackupController.create.bind(this))
    this.router.delete('/backups/:id', BackupController.middleware.bind(this), BackupController.delete.bind(this))
    this.router.get('/backups/:id/apply', BackupController.middleware.bind(this), BackupController.apply.bind(this))
    this.router.post('/backups/upload', BackupController.middleware.bind(this), BackupController.upload.bind(this))

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
    this.router.patch('/series/:id', SeriesController.middleware.bind(this), SeriesController.update.bind(this))

    //
    // Playback Session Routes
    //
    this.router.get('/sessions', SessionController.getAllWithUserData.bind(this))
    this.router.delete('/sessions/:id', SessionController.middleware.bind(this), SessionController.delete.bind(this))
    // TODO: Update these endpoints because they are only for open playback sessions
    this.router.get('/session/:id', SessionController.openSessionMiddleware.bind(this), SessionController.getOpenSession.bind(this))
    this.router.post('/session/:id/sync', SessionController.openSessionMiddleware.bind(this), SessionController.sync.bind(this))
    this.router.post('/session/:id/close', SessionController.openSessionMiddleware.bind(this), SessionController.close.bind(this))
    this.router.post('/session/local', SessionController.syncLocal.bind(this))

    //
    // Podcast Routes
    //
    this.router.post('/podcasts', PodcastController.create.bind(this))
    this.router.post('/podcasts/feed', PodcastController.getPodcastFeed.bind(this))
    this.router.post('/podcasts/opml', PodcastController.getOPMLFeeds.bind(this))
    this.router.get('/podcasts/:id/checknew', PodcastController.middleware.bind(this), PodcastController.checkNewEpisodes.bind(this))
    this.router.get('/podcasts/:id/downloads', PodcastController.middleware.bind(this), PodcastController.getEpisodeDownloads.bind(this))
    this.router.get('/podcasts/:id/clear-queue', PodcastController.middleware.bind(this), PodcastController.clearEpisodeDownloadQueue.bind(this))
    this.router.get('/podcasts/:id/search-episode', PodcastController.middleware.bind(this), PodcastController.findEpisode.bind(this))
    this.router.post('/podcasts/:id/download-episodes', PodcastController.middleware.bind(this), PodcastController.downloadEpisodes.bind(this))
    this.router.patch('/podcasts/:id/episode/:episodeId', PodcastController.middleware.bind(this), PodcastController.updateEpisode.bind(this))
    this.router.delete('/podcasts/:id/episode/:episodeId', PodcastController.middleware.bind(this), PodcastController.removeEpisode.bind(this))

    //
    // Notification Routes
    //
    this.router.get('/notifications', NotificationController.middleware.bind(this), NotificationController.get.bind(this))
    this.router.patch('/notifications', NotificationController.middleware.bind(this), NotificationController.update.bind(this))
    this.router.get('/notificationdata', NotificationController.middleware.bind(this), NotificationController.getData.bind(this))
    this.router.get('/notifications/test', NotificationController.middleware.bind(this), NotificationController.fireTestEvent.bind(this))
    this.router.post('/notifications', NotificationController.middleware.bind(this), NotificationController.createNotification.bind(this))
    this.router.delete('/notifications/:id', NotificationController.middleware.bind(this), NotificationController.deleteNotification.bind(this))
    this.router.patch('/notifications/:id', NotificationController.middleware.bind(this), NotificationController.updateNotification.bind(this))
    this.router.get('/notifications/:id/test', NotificationController.middleware.bind(this), NotificationController.sendNotificationTest.bind(this))

    //
    // Search Routes
    //
    this.router.get('/search/covers', SearchController.findCovers.bind(this))
    this.router.get('/search/books', SearchController.findBooks.bind(this))
    this.router.get('/search/podcast', SearchController.findPodcasts.bind(this))
    this.router.get('/search/authors', SearchController.findAuthor.bind(this))
    this.router.get('/search/chapters', SearchController.findChapters.bind(this))

    //
    // Cache Routes
    //
    this.router.post('/cache/purge', CacheController.purgeCache.bind(this))
    this.router.post('/cache/items/purge', CacheController.purgeItemsCache.bind(this))

    //
    // Tools Routes
    //
    this.router.post('/tools/item/:id/encode-m4b', ToolsController.itemMiddleware.bind(this), ToolsController.encodeM4b.bind(this))
    this.router.delete('/tools/item/:id/encode-m4b', ToolsController.itemMiddleware.bind(this), ToolsController.cancelM4bEncode.bind(this))
    this.router.post('/tools/item/:id/embed-metadata', ToolsController.itemMiddleware.bind(this), ToolsController.embedAudioFileMetadata.bind(this))

    //
    // Misc Routes
    //
    this.router.post('/upload', MiscController.handleUpload.bind(this))
    this.router.get('/tasks', MiscController.getTasks.bind(this))
    this.router.patch('/settings', MiscController.updateServerSettings.bind(this))
    this.router.post('/authorize', MiscController.authorize.bind(this))
    this.router.get('/tags', MiscController.getAllTags.bind(this))
    this.router.post('/validate-cron', MiscController.validateCronExpression.bind(this))
  }

  async getDirectories(dir, relpath, excludedDirs, level = 0) {
    try {
      const paths = await fs.readdir(dir)

      let dirs = await Promise.all(paths.map(async dirname => {
        const fullPath = Path.join(dir, dirname)
        const path = Path.join(relpath, dirname)

        const isDir = (await fs.lstat(fullPath)).isDirectory()
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
    const json = user.toJSONForBrowser()
    if (json.type === 'root' && hideRootToken) {
      json.token = ''
    }

    json.mediaProgress = json.mediaProgress.map(lip => {
      const libraryItem = this.db.libraryItems.find(li => li.id === lip.libraryItemId)
      if (!libraryItem) {
        Logger.warn('[ApiRouter] Library item not found for users progress ' + lip.libraryItemId)
        lip.media = null
      } else {
        if (lip.episodeId) {
          const episode = libraryItem.mediaType === 'podcast' ? libraryItem.media.getEpisode(lip.episodeId) : null
          if (!episode) {
            Logger.warn(`[ApiRouter] Episode ${lip.episodeId} not found for user media progress, podcast: ${libraryItem.media.metadata.title}`)
            lip.media = null
          } else {
            lip.media = libraryItem.media.toJSONExpanded()
            lip.episode = episode.toJSON()
          }
        } else {
          lip.media = libraryItem.media.toJSONExpanded()
        }
      }
      return lip
    }).filter(lip => !!lip)

    return json
  }

  async handleDeleteLibraryItem(libraryItem) {
    // Remove libraryItem from users
    for (let i = 0; i < this.db.users.length; i++) {
      const user = this.db.users[i]
      if (user.removeMediaProgressForLibraryItem(libraryItem.id)) {
        await this.db.updateEntity('user', user)
      }
    }

    // TODO: Remove open sessions for library item

    // remove book from collections
    const collectionsWithBook = this.db.collections.filter(c => c.books.includes(libraryItem.id))
    for (let i = 0; i < collectionsWithBook.length; i++) {
      const collection = collectionsWithBook[i]
      collection.removeBook(libraryItem.id)
      await this.db.updateEntity('collection', collection)
      SocketAuthority.emitter('collection_updated', collection.toJSONExpanded(this.db.libraryItems))
    }

    // remove item from playlists
    const playlistsWithItem = this.db.playlists.filter(p => p.hasItemsForLibraryItem(libraryItem.id))
    for (let i = 0; i < playlistsWithItem.length; i++) {
      const playlist = playlistsWithItem[i]
      playlist.removeItemsForLibraryItem(libraryItem.id)

      // If playlist is now empty then remove it
      if (!playlist.items.length) {
        Logger.info(`[ApiRouter] Playlist "${playlist.name}" has no more items - removing it`)
        await this.db.removeEntity('playlist', playlist.id)
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_removed', playlist.toJSONExpanded(this.db.libraryItems))
      } else {
        await this.db.updateEntity('playlist', playlist)
        SocketAuthority.clientEmitter(playlist.userId, 'playlist_updated', playlist.toJSONExpanded(this.db.libraryItems))
      }
    }

    // purge cover cache
    if (libraryItem.media.coverPath) {
      await this.cacheManager.purgeCoverCache(libraryItem.id)
    }

    await this.db.removeLibraryItem(libraryItem.id)
    SocketAuthority.emitter('item_removed', libraryItem.toJSONExpanded())
  }

  async getUserListeningSessionsHelper(userId) {
    const userSessions = await this.db.selectUserSessions(userId)
    return userSessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getAllSessionsWithUserData() {
    const sessions = await this.db.getAllSessions()
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    return sessions.map(se => {
      const user = this.db.users.find(u => u.id === se.userId)
      return {
        ...se,
        user: user ? { id: user.id, username: user.username } : null
      }
    })
  }

  async getUserListeningStatsHelpers(userId) {
    const today = date.format(new Date(), 'YYYY-MM-DD')

    const listeningSessions = await this.getUserListeningSessionsHelper(userId)
    const listeningStats = {
      totalTime: 0,
      items: {},
      days: {},
      dayOfWeek: {},
      today: 0,
      recentSessions: listeningSessions.slice(0, 10)
    }
    listeningSessions.forEach((s) => {
      let sessionTimeListening = s.timeListening
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
      const mediaMetadata = mediaPayload.metadata

      // Create new authors if in payload
      if (mediaMetadata.authors && mediaMetadata.authors.length) {
        // TODO: validate authors
        const newAuthors = []
        for (let i = 0; i < mediaMetadata.authors.length; i++) {
          if (mediaMetadata.authors[i].id.startsWith('new')) {
            let author = this.db.authors.find(au => au.checkNameEquals(mediaMetadata.authors[i].name))
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
          SocketAuthority.emitter('authors_added', newAuthors)
        }
      }

      // Create new series if in payload
      if (mediaMetadata.series && mediaMetadata.series.length) {
        // TODO: validate series
        const newSeries = []
        for (let i = 0; i < mediaMetadata.series.length; i++) {
          if (mediaMetadata.series[i].id.startsWith('new')) {
            let seriesItem = this.db.series.find(se => se.checkNameEquals(mediaMetadata.series[i].name))
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
          SocketAuthority.emitter('authors_added', newSeries)
        }
      }
    }
  }
}
module.exports = ApiRouter