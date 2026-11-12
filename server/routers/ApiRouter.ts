import type { Request, RequestHandler, Response } from 'express'
import express from 'express'
import Path from 'path'
import * as sequelize from 'sequelize'

import Logger from '../Logger'
import Database from '../Database'
import SocketAuthority from '../SocketAuthority'

import fs from '../libs/fsExtra'
import date from '../libs/dateAndTime'

import CacheManager from '../managers/CacheManager'
import RssFeedManager from '../managers/RssFeedManager'

import LibraryController from '../controllers/LibraryController'
import UserController from '../controllers/UserController'
import CollectionController from '../controllers/CollectionController'
import PlaylistController from '../controllers/PlaylistController'
import MeController from '../controllers/MeController'
import BackupController from '../controllers/BackupController'
import LibraryItemController from '../controllers/LibraryItemController'
import SeriesController from '../controllers/SeriesController'
import FileSystemController from '../controllers/FileSystemController'
import AuthorController from '../controllers/AuthorController'
import SessionController from '../controllers/SessionController'
import PodcastController from '../controllers/PodcastController'
import NotificationController from '../controllers/NotificationController'
import EmailController from '../controllers/EmailController'
import SearchController from '../controllers/SearchController'
import CacheController from '../controllers/CacheController'
import ToolsController from '../controllers/ToolsController'
import RSSFeedController from '../controllers/RSSFeedController'
import CustomMetadataProviderController from '../controllers/CustomMetadataProviderController'
import MiscController from '../controllers/MiscController'
import ShareController from '../controllers/ShareController'
import StatsController from '../controllers/StatsController'
import ApiKeyController from '../controllers/ApiKeyController'

import type Auth from '../Auth'
import type PlaybackSessionManager from '../managers/PlaybackSessionManager'
import type AbMergeManager from '../managers/AbMergeManager'
import type BackupManager from '../managers/BackupManager'
import type PodcastManager from '../managers/PodcastManager'
import type AudioMetadataManager from '../managers/AudioMetadataManager'
import type CronManager from '../managers/CronManager'
import type EmailManager from '../managers/EmailManager'
import type ApiCacheManager from '../managers/ApiCacheManager'

type ApiRouterServer = {
  auth: Auth
  playbackSessionManager: PlaybackSessionManager
  abMergeManager: AbMergeManager
  backupManager: BackupManager
  podcastManager: PodcastManager
  audioMetadataManager: AudioMetadataManager
  cronManager: CronManager
  emailManager: EmailManager
  apiCacheManager: ApiCacheManager
}

type ListeningSession = Exclude<Awaited<ReturnType<typeof Database.getPlaybackSessions>>, false>[number] & { lastUpdate?: number }

// The API mount authenticates requests. Route middleware populates the entities used by subsequent handlers.
function apiHandler<Req extends Pick<Request, 'params' | 'method'>>(handler: (req: Req, res: Response, ...rest: never[]) => unknown): RequestHandler {
  return handler as unknown as RequestHandler
}

class ApiRouter {
  declare auth: Auth
  declare playbackSessionManager: PlaybackSessionManager
  declare abMergeManager: AbMergeManager
  declare backupManager: BackupManager
  declare podcastManager: PodcastManager
  declare audioMetadataManager: AudioMetadataManager
  declare cronManager: CronManager
  declare emailManager: EmailManager
  declare apiCacheManager: ApiCacheManager
  declare router: express.Express

  constructor(Server: ApiRouterServer) {
    this.auth = Server.auth
    this.playbackSessionManager = Server.playbackSessionManager
    this.abMergeManager = Server.abMergeManager
    this.backupManager = Server.backupManager
    this.podcastManager = Server.podcastManager
    this.audioMetadataManager = Server.audioMetadataManager
    this.cronManager = Server.cronManager
    this.emailManager = Server.emailManager
    this.apiCacheManager = Server.apiCacheManager

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    //
    // Library Routes
    //
    this.router.get(/^\/libraries/, this.apiCacheManager.middleware)
    this.router.post('/libraries', apiHandler(LibraryController.create.bind(this)))
    this.router.get('/libraries', apiHandler(LibraryController.findAll.bind(this)))
    this.router.get('/libraries/:id', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.findOne.bind(this)))
    this.router.patch('/libraries/:id', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.update.bind(this)))
    this.router.delete('/libraries/:id', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.delete.bind(this)))

    this.router.get('/libraries/:id/items', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getLibraryItems.bind(this)))
    this.router.delete('/libraries/:id/issues', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.removeLibraryItemsWithIssues.bind(this)))
    this.router.get('/libraries/:id/episode-downloads', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getEpisodeDownloadQueue.bind(this)))
    this.router.get('/libraries/:id/series', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getAllSeriesForLibrary.bind(this)))
    this.router.get('/libraries/:id/series/:seriesId', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getSeriesForLibrary.bind(this)))
    this.router.get('/libraries/:id/collections', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getCollectionsForLibrary.bind(this)))
    this.router.get('/libraries/:id/playlists', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getUserPlaylistsForLibrary.bind(this)))
    this.router.get('/libraries/:id/personalized', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getUserPersonalizedShelves.bind(this)))
    this.router.get('/libraries/:id/filterdata', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getLibraryFilterData.bind(this)))
    this.router.get('/libraries/:id/search', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.search.bind(this)))
    this.router.get('/libraries/:id/stats', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.stats.bind(this)))
    this.router.get('/libraries/:id/authors', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getAuthors.bind(this)))
    this.router.get('/libraries/:id/narrators', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getNarrators.bind(this)))
    this.router.patch('/libraries/:id/narrators/:narratorId', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.updateNarrator.bind(this)))
    this.router.delete('/libraries/:id/narrators/:narratorId', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.removeNarrator.bind(this)))
    this.router.get('/libraries/:id/matchall', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.matchAll.bind(this)))
    this.router.post('/libraries/:id/scan', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.scan.bind(this)))
    this.router.get('/libraries/:id/recent-episodes', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getRecentEpisodes.bind(this)))
    this.router.get('/libraries/:id/opml', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getOPMLFile.bind(this)))
    this.router.post('/libraries/order', apiHandler(LibraryController.reorder.bind(this)))
    this.router.post('/libraries/:id/remove-metadata', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.removeAllMetadataFiles.bind(this)))
    this.router.get('/libraries/:id/podcast-titles', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.getPodcastTitles.bind(this)))
    this.router.get('/libraries/:id/download', apiHandler(LibraryController.middleware.bind(this)), apiHandler(LibraryController.downloadMultiple.bind(this)))

    //
    // Item Routes
    //
    this.router.post('/items/batch/delete', apiHandler(LibraryItemController.batchDelete.bind(this)))
    this.router.post('/items/batch/update', apiHandler(LibraryItemController.batchUpdate.bind(this)))
    this.router.post('/items/batch/get', apiHandler(LibraryItemController.batchGet.bind(this)))
    this.router.post('/items/batch/quickmatch', apiHandler(LibraryItemController.batchQuickMatch.bind(this)))
    this.router.post('/items/batch/scan', apiHandler(LibraryItemController.batchScan.bind(this)))

    this.router.get('/items/:id', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.findOne.bind(this)))
    this.router.delete('/items/:id', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.delete.bind(this)))
    this.router.get('/items/:id/download', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.download.bind(this)))
    this.router.patch('/items/:id/media', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.updateMedia.bind(this)))
    this.router.get('/items/:id/cover', apiHandler(LibraryItemController.getCover.bind(this)))
    this.router.post('/items/:id/cover', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.uploadCover.bind(this)))
    this.router.patch('/items/:id/cover', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.updateCover.bind(this)))
    this.router.delete('/items/:id/cover', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.removeCover.bind(this)))
    this.router.post('/items/:id/match', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.match.bind(this)))
    this.router.post('/items/:id/play', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.startPlaybackSession.bind(this)))
    this.router.post('/items/:id/play/:episodeId', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.startEpisodePlaybackSession.bind(this)))
    this.router.patch('/items/:id/tracks', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.updateTracks.bind(this)))
    this.router.post('/items/:id/scan', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.scan.bind(this)))
    this.router.get('/items/:id/metadata-object', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.getMetadataObject.bind(this)))
    this.router.post('/items/:id/chapters', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.updateMediaChapters.bind(this)))
    this.router.get('/items/:id/ffprobe/:fileid', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.getFFprobeData.bind(this)))
    this.router.get('/items/:id/file/:fileid', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.getLibraryFile.bind(this)))
    this.router.delete('/items/:id/file/:fileid', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.deleteLibraryFile.bind(this)))
    this.router.get('/items/:id/file/:fileid/download', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.downloadLibraryFile.bind(this)))
    this.router.get('/items/:id/ebook/:fileid?', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.getEBookFile.bind(this)))
    this.router.patch('/items/:id/ebook/:fileid/status', apiHandler(LibraryItemController.middleware.bind(this)), apiHandler(LibraryItemController.updateEbookFileStatus.bind(this)))

    //
    // User Routes
    //
    this.router.post('/users', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.create.bind(this)))
    this.router.get('/users', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.findAll.bind(this)))
    this.router.get('/users/online', apiHandler(UserController.getOnlineUsers.bind(this)))
    this.router.get('/users/:id', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.findOne.bind(this)))
    this.router.patch('/users/:id', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.update.bind(this)))
    this.router.delete('/users/:id', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.delete.bind(this)))
    this.router.patch('/users/:id/openid-unlink', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.unlinkFromOpenID.bind(this)))
    this.router.get('/users/:id/listening-sessions', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.getListeningSessions.bind(this)))
    this.router.get('/users/:id/listening-stats', apiHandler(UserController.middleware.bind(this)), apiHandler(UserController.getListeningStats.bind(this)))

    //
    // Collection Routes
    //
    this.router.post('/collections', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.create.bind(this)))
    this.router.get('/collections', apiHandler(CollectionController.findAll.bind(this)))
    this.router.get('/collections/:id', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.findOne.bind(this)))
    this.router.patch('/collections/:id', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.update.bind(this)))
    this.router.delete('/collections/:id', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.delete.bind(this)))
    this.router.post('/collections/:id/book', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.addBook.bind(this)))
    this.router.delete('/collections/:id/book/:bookId', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.removeBook.bind(this)))
    this.router.post('/collections/:id/batch/add', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.addBatch.bind(this)))
    this.router.post('/collections/:id/batch/remove', apiHandler(CollectionController.middleware.bind(this)), apiHandler(CollectionController.removeBatch.bind(this)))

    //
    // Playlist Routes
    //
    this.router.post('/playlists', apiHandler(PlaylistController.create.bind(this)))
    this.router.get('/playlists', apiHandler(PlaylistController.findAllForUser.bind(this)))
    this.router.get('/playlists/:id', apiHandler(PlaylistController.middleware.bind(this)), apiHandler(PlaylistController.findOne.bind(this)))
    this.router.patch('/playlists/:id', apiHandler(PlaylistController.middleware.bind(this)), apiHandler(PlaylistController.update.bind(this)))
    this.router.delete('/playlists/:id', apiHandler(PlaylistController.middleware.bind(this)), apiHandler(PlaylistController.delete.bind(this)))
    this.router.post('/playlists/:id/item', apiHandler(PlaylistController.middleware.bind(this)), apiHandler(PlaylistController.addItem.bind(this)))
    this.router.delete('/playlists/:id/item/:libraryItemId/:episodeId?', apiHandler(PlaylistController.middleware.bind(this)), apiHandler(PlaylistController.removeItem.bind(this)))
    this.router.post('/playlists/:id/batch/add', apiHandler(PlaylistController.middleware.bind(this)), apiHandler(PlaylistController.addBatch.bind(this)))
    this.router.post('/playlists/:id/batch/remove', apiHandler(PlaylistController.middleware.bind(this)), apiHandler(PlaylistController.removeBatch.bind(this)))
    this.router.post('/playlists/collection/:collectionId', apiHandler(PlaylistController.createFromCollection.bind(this)))

    //
    // Current User Routes (Me)
    //
    this.router.get('/me', apiHandler(MeController.getCurrentUser.bind(this)))
    this.router.get('/me/sessions', apiHandler(MeController.getSessions.bind(this)))
    this.router.delete('/me/sessions/:id', apiHandler(MeController.deleteSession.bind(this)))
    this.router.get('/me/progress', apiHandler(MeController.getAllMediaProgress.bind(this)))
    this.router.get('/me/bookmarks', apiHandler(MeController.getAllBookmarks.bind(this)))
    this.router.get('/me/bookmarks/:libraryItemId', apiHandler(MeController.getBookmarksForLibraryItem.bind(this)))
    this.router.get('/me/listening-sessions', apiHandler(MeController.getListeningSessions.bind(this)))
    this.router.get('/me/item/listening-sessions/:libraryItemId/:episodeId?', apiHandler(MeController.getItemListeningSessions.bind(this)))
    this.router.get('/me/listening-stats', apiHandler(MeController.getListeningStats.bind(this)))
    this.router.get('/me/progress/:id/remove-from-continue-listening', apiHandler(MeController.removeItemFromContinueListening.bind(this)))
    this.router.get('/me/progress/:id/:episodeId?', apiHandler(MeController.getMediaProgress.bind(this)))
    this.router.patch('/me/progress/batch/update', apiHandler(MeController.batchUpdateMediaProgress.bind(this)))
    this.router.patch('/me/progress/:libraryItemId/:episodeId?', apiHandler(MeController.createUpdateMediaProgress.bind(this)))
    this.router.delete('/me/progress/:id', apiHandler(MeController.removeMediaProgress.bind(this)))
    this.router.post('/me/item/:id/bookmark', apiHandler(MeController.createBookmark.bind(this)))
    this.router.patch('/me/item/:id/bookmark', apiHandler(MeController.updateBookmark.bind(this)))
    this.router.delete('/me/item/:id/bookmark/:time', apiHandler(MeController.removeBookmark.bind(this)))
    this.router.patch('/me/password', this.auth.authRateLimiter, apiHandler(MeController.updatePassword.bind(this)))
    this.router.get('/me/items-in-progress', apiHandler(MeController.getAllLibraryItemsInProgress.bind(this)))
    this.router.get('/me/series/:id/remove-from-continue-listening', apiHandler(MeController.removeSeriesFromContinueListening.bind(this)))
    this.router.get('/me/series/:id/readd-to-continue-listening', apiHandler(MeController.readdSeriesFromContinueListening.bind(this)))
    this.router.get('/me/stats/year/:year', apiHandler(MeController.getStatsForYear.bind(this)))
    this.router.post('/me/ereader-devices', apiHandler(MeController.updateUserEReaderDevices.bind(this)))

    //
    // Backup Routes
    //
    this.router.get('/backups', apiHandler(BackupController.middleware.bind(this)), apiHandler(BackupController.getAll.bind(this)))
    this.router.post('/backups', apiHandler(BackupController.middleware.bind(this)), apiHandler(BackupController.create.bind(this)))
    this.router.delete('/backups/:id', apiHandler(BackupController.middleware.bind(this)), apiHandler(BackupController.delete.bind(this)))
    this.router.get('/backups/:id/download', apiHandler(BackupController.middleware.bind(this)), apiHandler(BackupController.download.bind(this)))
    this.router.get('/backups/:id/apply', apiHandler(BackupController.middleware.bind(this)), apiHandler(BackupController.apply.bind(this)))
    this.router.post('/backups/upload', apiHandler(BackupController.middleware.bind(this)), apiHandler(BackupController.upload.bind(this)))
    this.router.patch('/backups/path', apiHandler(BackupController.middleware.bind(this)), apiHandler(BackupController.updatePath.bind(this)))

    //
    // File System Routes
    //
    this.router.get('/filesystem', apiHandler(FileSystemController.getPaths.bind(this)))
    this.router.post('/filesystem/pathexists', apiHandler(FileSystemController.checkPathExists.bind(this)))

    //
    // Author Routes
    //
    this.router.get('/authors/:id', apiHandler(AuthorController.middleware.bind(this)), apiHandler(AuthorController.findOne.bind(this)))
    this.router.patch('/authors/:id', apiHandler(AuthorController.middleware.bind(this)), apiHandler(AuthorController.update.bind(this)))
    this.router.delete('/authors/:id', apiHandler(AuthorController.middleware.bind(this)), apiHandler(AuthorController.delete.bind(this)))
    this.router.post('/authors/:id/match', apiHandler(AuthorController.middleware.bind(this)), apiHandler(AuthorController.match.bind(this)))
    this.router.get('/authors/:id/image', apiHandler(AuthorController.getImage.bind(this)))
    this.router.post('/authors/:id/image', apiHandler(AuthorController.middleware.bind(this)), apiHandler(AuthorController.uploadImage.bind(this)))
    this.router.delete('/authors/:id/image', apiHandler(AuthorController.middleware.bind(this)), apiHandler(AuthorController.deleteImage.bind(this)))

    //
    // Series Routes
    //
    this.router.get('/series/:id', apiHandler(SeriesController.middleware.bind(this)), apiHandler(SeriesController.findOne.bind(this)))
    this.router.patch('/series/:id', apiHandler(SeriesController.middleware.bind(this)), apiHandler(SeriesController.update.bind(this)))

    //
    // Playback Session Routes
    //
    this.router.get('/sessions', apiHandler(SessionController.getAllWithUserData.bind(this)))
    this.router.delete('/sessions/:id', apiHandler(SessionController.middleware.bind(this)), apiHandler(SessionController.delete.bind(this)))
    this.router.get('/sessions/open', apiHandler(SessionController.getOpenSessions.bind(this)))
    this.router.post('/sessions/batch/delete', apiHandler(SessionController.batchDelete.bind(this)))
    this.router.post('/session/local', apiHandler(SessionController.syncLocal.bind(this)))
    this.router.post('/session/local-all', apiHandler(SessionController.syncLocalSessions.bind(this)))
    // TODO: Update these endpoints because they are only for open playback sessions
    this.router.get('/session/:id', apiHandler(SessionController.openSessionMiddleware.bind(this)), apiHandler(SessionController.getOpenSession.bind(this)))
    this.router.post('/session/:id/sync', apiHandler(SessionController.openSessionMiddleware.bind(this)), apiHandler(SessionController.sync.bind(this)))
    this.router.post('/session/:id/close', apiHandler(SessionController.openSessionMiddleware.bind(this)), apiHandler(SessionController.close.bind(this)))

    //
    // Podcast Routes
    //
    this.router.post('/podcasts', apiHandler(PodcastController.create.bind(this)))
    this.router.post('/podcasts/feed', apiHandler(PodcastController.getPodcastFeed.bind(this)))
    this.router.post('/podcasts/opml/parse', apiHandler(PodcastController.getFeedsFromOPMLText.bind(this)))
    this.router.post('/podcasts/opml/create', apiHandler(PodcastController.bulkCreatePodcastsFromOpmlFeedUrls.bind(this)))
    this.router.get('/podcasts/:id/checknew', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.checkNewEpisodes.bind(this)))
    this.router.get('/podcasts/:id/downloads', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.getEpisodeDownloads.bind(this)))
    this.router.get('/podcasts/:id/clear-queue', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.clearEpisodeDownloadQueue.bind(this)))
    this.router.get('/podcasts/:id/search-episode', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.findEpisode.bind(this)))
    this.router.post('/podcasts/:id/download-episodes', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.downloadEpisodes.bind(this)))
    this.router.post('/podcasts/:id/match-episodes', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.quickMatchEpisodes.bind(this)))
    this.router.get('/podcasts/:id/episode/:episodeId', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.getEpisode.bind(this)))
    this.router.patch('/podcasts/:id/episode/:episodeId', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.updateEpisode.bind(this)))
    this.router.delete('/podcasts/:id/episode/:episodeId', apiHandler(PodcastController.middleware.bind(this)), apiHandler(PodcastController.removeEpisode.bind(this)))

    //
    // Notification Routes (Admin and up)
    //
    this.router.get('/notifications', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.get.bind(this)))
    this.router.patch('/notifications', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.update.bind(this)))
    this.router.get('/notificationdata', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.getData.bind(this)))
    this.router.get('/notifications/test', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.fireTestEvent.bind(this)))
    this.router.post('/notifications', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.createNotification.bind(this)))
    this.router.delete('/notifications/:id', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.deleteNotification.bind(this)))
    this.router.patch('/notifications/:id', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.updateNotification.bind(this)))
    this.router.get('/notifications/:id/test', apiHandler(NotificationController.middleware.bind(this)), apiHandler(NotificationController.sendNotificationTest.bind(this)))

    //
    // Email Routes (Admin and up)
    //
    this.router.get('/emails/settings', apiHandler(EmailController.adminMiddleware.bind(this)), apiHandler(EmailController.getSettings.bind(this)))
    this.router.patch('/emails/settings', apiHandler(EmailController.adminMiddleware.bind(this)), apiHandler(EmailController.updateSettings.bind(this)))
    this.router.post('/emails/test', apiHandler(EmailController.adminMiddleware.bind(this)), apiHandler(EmailController.sendTest.bind(this)))
    this.router.post('/emails/ereader-devices', apiHandler(EmailController.adminMiddleware.bind(this)), apiHandler(EmailController.updateEReaderDevices.bind(this)))
    this.router.post('/emails/send-ebook-to-device', apiHandler(EmailController.sendEBookToDevice.bind(this)))

    //
    // Search Routes
    //
    this.router.get('/search/covers', apiHandler(SearchController.findCovers.bind(this)))
    this.router.get('/search/books', apiHandler(SearchController.findBooks.bind(this)))
    this.router.get('/search/podcast', apiHandler(SearchController.findPodcasts.bind(this)))
    this.router.get('/search/authors', apiHandler(SearchController.findAuthor.bind(this)))
    this.router.get('/search/chapters', apiHandler(SearchController.findChapters.bind(this)))
    this.router.get('/search/providers', apiHandler(SearchController.getAllProviders.bind(this)))

    //
    // Cache Routes (Admin and up)
    //
    this.router.post('/cache/purge', apiHandler(CacheController.purgeCache.bind(this)))
    this.router.post('/cache/items/purge', apiHandler(CacheController.purgeItemsCache.bind(this)))

    //
    // Tools Routes (Admin and up)
    //
    this.router.post('/tools/item/:id/encode-m4b', apiHandler(ToolsController.middleware.bind(this)), apiHandler(ToolsController.encodeM4b.bind(this)))
    this.router.delete('/tools/item/:id/encode-m4b', apiHandler(ToolsController.middleware.bind(this)), apiHandler(ToolsController.cancelM4bEncode.bind(this)))
    this.router.post('/tools/item/:id/embed-metadata', apiHandler(ToolsController.middleware.bind(this)), apiHandler(ToolsController.embedAudioFileMetadata.bind(this)))
    this.router.post('/tools/batch/embed-metadata', apiHandler(ToolsController.middleware.bind(this)), apiHandler(ToolsController.batchEmbedMetadata.bind(this)))

    //
    // RSS Feed Routes (Admin and up)
    //
    this.router.get('/feeds', apiHandler(RSSFeedController.middleware.bind(this)), apiHandler(RSSFeedController.getAll.bind(this)))
    this.router.post('/feeds/item/:itemId/open', apiHandler(RSSFeedController.middleware.bind(this)), apiHandler(RSSFeedController.openRSSFeedForItem.bind(this)))
    this.router.post('/feeds/collection/:collectionId/open', apiHandler(RSSFeedController.middleware.bind(this)), apiHandler(RSSFeedController.openRSSFeedForCollection.bind(this)))
    this.router.post('/feeds/series/:seriesId/open', apiHandler(RSSFeedController.middleware.bind(this)), apiHandler(RSSFeedController.openRSSFeedForSeries.bind(this)))
    this.router.post('/feeds/:id/close', apiHandler(RSSFeedController.middleware.bind(this)), apiHandler(RSSFeedController.closeRSSFeed.bind(this)))

    //
    // Custom Metadata Provider routes
    //
    this.router.get('/custom-metadata-providers', apiHandler(CustomMetadataProviderController.middleware.bind(this)), apiHandler(CustomMetadataProviderController.getAll.bind(this)))
    this.router.post('/custom-metadata-providers', apiHandler(CustomMetadataProviderController.middleware.bind(this)), apiHandler(CustomMetadataProviderController.create.bind(this)))
    this.router.delete('/custom-metadata-providers/:id', apiHandler(CustomMetadataProviderController.middleware.bind(this)), apiHandler(CustomMetadataProviderController.delete.bind(this)))

    //
    // Share routes
    //
    this.router.post('/share/mediaitem', apiHandler(ShareController.createMediaItemShare.bind(this)))
    this.router.delete('/share/mediaitem/:id', apiHandler(ShareController.deleteMediaItemShare.bind(this)))

    //
    // Stats Routes
    //
    this.router.get('/stats/year/:year', apiHandler(StatsController.middleware.bind(this)), apiHandler(StatsController.getAdminStatsForYear.bind(this)))
    this.router.get('/stats/server', apiHandler(StatsController.middleware.bind(this)), apiHandler(StatsController.getServerStats.bind(this)))

    //
    // API Key Routes
    //
    this.router.get('/api-keys', apiHandler(ApiKeyController.middleware.bind(this)), apiHandler(ApiKeyController.getAll.bind(this)))
    this.router.post('/api-keys', apiHandler(ApiKeyController.middleware.bind(this)), apiHandler(ApiKeyController.create.bind(this)))
    this.router.patch('/api-keys/:id', apiHandler(ApiKeyController.middleware.bind(this)), apiHandler(ApiKeyController.update.bind(this)))
    this.router.delete('/api-keys/:id', apiHandler(ApiKeyController.middleware.bind(this)), apiHandler(ApiKeyController.delete.bind(this)))

    //
    // Misc Routes
    //
    this.router.post('/upload', apiHandler(MiscController.handleUpload.bind(this)))
    this.router.get('/tasks', apiHandler(MiscController.getTasks.bind(this)))
    this.router.patch('/settings', apiHandler(MiscController.updateServerSettings.bind(this)))
    this.router.patch('/sorting-prefixes', apiHandler(MiscController.updateSortingPrefixes.bind(this)))
    this.router.post('/authorize', apiHandler(MiscController.authorize.bind(this)))
    this.router.get('/tags', apiHandler(MiscController.getAllTags.bind(this)))
    this.router.post('/tags/rename', apiHandler(MiscController.renameTag.bind(this)))
    this.router.delete('/tags/:tag', apiHandler(MiscController.deleteTag.bind(this)))
    this.router.get('/genres', apiHandler(MiscController.getAllGenres.bind(this)))
    this.router.post('/genres/rename', apiHandler(MiscController.renameGenre.bind(this)))
    this.router.delete('/genres/:genre', apiHandler(MiscController.deleteGenre.bind(this)))
    this.router.post('/validate-cron', apiHandler(MiscController.validateCronExpression.bind(this)))
    this.router.get('/auth-settings', apiHandler(MiscController.getAuthSettings.bind(this)))
    this.router.patch('/auth-settings', apiHandler(MiscController.updateAuthSettings.bind(this)))
    this.router.post('/watcher/update', apiHandler(MiscController.updateWatchedPath.bind(this)))
    this.router.get('/logger-data', apiHandler(MiscController.getLoggerData.bind(this)))
  }

  //
  // Helper Methods
  //
  /**
   * Remove library item and associated entities
   * @param {string} libraryItemId
   * @param {string[]} mediaItemIds array of bookId or podcastEpisodeId
   * @param {string} libraryId
   */
  async handleDeleteLibraryItem(libraryItemId: string, mediaItemIds: string[], libraryId: string | null) {
    const numProgressRemoved = await Database.mediaProgressModel.destroy({
      where: {
        mediaItemId: mediaItemIds
      }
    })
    if (numProgressRemoved > 0) {
      Logger.info(`[ApiRouter] Removed ${numProgressRemoved} media progress entries for library item "${libraryItemId}"`)
    }

    // remove item from playlists
    await Database.playlistModel.removeMediaItemsFromPlaylists(mediaItemIds)

    // Close rss feed - remove from db and emit socket event
    await RssFeedManager.closeFeedForEntityId(libraryItemId)

    // purge cover cache
    await CacheManager.purgeCoverCache(libraryItemId)

    // Remove metadata file if in /metadata/items dir
    if (global.MetadataPath) {
      const itemMetadataPath = Path.join(global.MetadataPath, 'items', libraryItemId)
      if (await fs.pathExists(itemMetadataPath)) {
        Logger.info(`[ApiRouter] Removing item metadata at "${itemMetadataPath}"`)
        await fs.remove(itemMetadataPath)
      }
    }

    await Database.libraryItemModel.removeById(libraryItemId)

    SocketAuthority.emitter('item_removed', {
      id: libraryItemId,
      libraryId
    })
  }

  /**
   * After deleting book(s), remove empty series
   *
   * @param {string[]} seriesIds
   */
  async checkRemoveEmptySeries(seriesIds: string[]) {
    if (!seriesIds?.length) return

    const transaction = await Database.sequelize!.transaction()
    try {
      const seriesToRemove = (
        await Database.seriesModel.findAll({
          where: [
            {
              id: seriesIds
            },
            sequelize.where(sequelize.literal('(SELECT count(*) FROM bookSeries bs WHERE bs.seriesId = series.id)'), 0)
          ],
          attributes: ['id', 'name', 'libraryId'],
          include: {
            model: Database.bookModel,
            attributes: ['id'],
            required: false // Ensure it includes series even if no books exist
          },
          transaction
        })
      ).map((s) => ({ id: s.id, name: s.name, libraryId: s.libraryId }))

      if (seriesToRemove.length) {
        await Database.seriesModel.destroy({
          where: {
            id: seriesToRemove.map((s) => s.id)
          },
          transaction
        })
      }

      await transaction.commit()

      seriesToRemove.forEach(({ id, name, libraryId }) => {
        Logger.info(`[ApiRouter] Series "${name}" is now empty. Removing series`)

        // Remove series from library filter data
        Database.removeSeriesFromFilterData(libraryId!, id)
        SocketAuthority.emitter('series_removed', { id: id, libraryId: libraryId })
      })
      // Close rss feeds - remove from db and emit socket event
      if (seriesToRemove.length) {
        await RssFeedManager.closeFeedsForEntityIds(seriesToRemove.map((s) => s.id))
      }
    } catch (error) {
      await transaction.rollback()
      Logger.error(`[ApiRouter] Error removing empty series: ${(error as Error).message}`)
    }
  }

  /**
   * Remove authors with no books and unset asin, description and imagePath
   * Note: Other implementation is in BookScanner.checkAuthorsRemovedFromBooks (can be merged)
   *
   * @param {string[]} authorIds
   * @returns {Promise<void>}
   */
  async checkRemoveAuthorsWithNoBooks(authorIds: string[]) {
    if (!authorIds?.length) return

    const transaction = await Database.sequelize!.transaction()
    try {
      // Select authors with locking to prevent concurrent updates
      const bookAuthorsToRemove = (
        await Database.authorModel.findAll({
          where: [
            {
              id: authorIds,
              asin: {
                [sequelize.Op.or]: [null, '']
              },
              description: {
                [sequelize.Op.or]: [null, '']
              },
              imagePath: {
                [sequelize.Op.or]: [null, '']
              }
            },
            sequelize.where(sequelize.literal('(SELECT count(*) FROM bookAuthors ba WHERE ba.authorId = author.id)'), 0)
          ],
          attributes: ['id', 'name', 'libraryId'],
          raw: true,
          transaction
        })
      ).map((au) => ({ id: au.id, name: au.name, libraryId: au.libraryId }))

      if (bookAuthorsToRemove.length) {
        await Database.authorModel.destroy({
          where: {
            id: bookAuthorsToRemove.map((au) => au.id)
          },
          transaction
        })
      }

      await transaction.commit()

      // Remove all book authors after completing remove from database
      bookAuthorsToRemove.forEach(({ id, name, libraryId }) => {
        Database.removeAuthorFromFilterData(libraryId!, id)
        // TODO: Clients were expecting full author in payload but its unnecessary
        SocketAuthority.emitter('author_removed', { id, libraryId })
        Logger.info(`[ApiRouter] Removed author "${name}" with no books`)
      })
    } catch (error) {
      await transaction.rollback()
      Logger.error(`[ApiRouter] Error removing authors: ${(error as Error).message}`)
    }
  }

  async getUserListeningSessionsHelper(userId: string) {
    const userSessions = await Database.getPlaybackSessions({ userId })
    return (userSessions as ListeningSession[]).sort((a, b) => b.updatedAt! - a.updatedAt!)
  }

  async getUserItemListeningSessionsHelper(userId: string, mediaItemId: string | null) {
    const userSessions = await Database.getPlaybackSessions({ userId, mediaItemId })
    return (userSessions as ListeningSession[]).sort((a, b) => b.updatedAt! - a.updatedAt!)
  }

  async getUserListeningStatsHelpers(userId: string) {
    const today = date.format(new Date(), 'YYYY-MM-DD')

    const listeningSessions = await this.getUserListeningSessionsHelper(userId)
    const listeningStats = {
      totalTime: 0,
      items: {} as Record<string, { id: ListeningSession['libraryItemId']; timeListening: ListeningSession['timeListening']; mediaMetadata: ListeningSession['mediaMetadata']; lastUpdate?: number }>,
      days: {} as Record<string, number>,
      dayOfWeek: {} as Record<string, number>,
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
        listeningStats.dayOfWeek[s.dayOfWeek] += sessionTimeListening!
      }
      if (s.date && sessionTimeListening! > 0) {
        if (!listeningStats.days[s.date]) listeningStats.days[s.date] = 0
        listeningStats.days[s.date] += sessionTimeListening!

        if (s.date === today) {
          listeningStats.today += sessionTimeListening!
        }
      }
      const itemKey = String(s.libraryItemId)
      if (!listeningStats.items[itemKey]) {
        listeningStats.items[itemKey] = {
          id: s.libraryItemId,
          timeListening: sessionTimeListening,
          mediaMetadata: s.mediaMetadata,
          lastUpdate: s.lastUpdate
        }
      } else {
        listeningStats.items[itemKey].timeListening = listeningStats.items[itemKey].timeListening! + sessionTimeListening!
      }

      listeningStats.totalTime += sessionTimeListening!
    })
    return listeningStats
  }
}
export = ApiRouter
