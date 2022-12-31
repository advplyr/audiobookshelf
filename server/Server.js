const Path = require('path')
const express = require('express')
const http = require('http')
const fs = require('./libs/fsExtra')
const fileUpload = require('./libs/expressFileupload')
const rateLimit = require('./libs/expressRateLimit')

const { version } = require('../package.json')

// Utils
const dbMigration = require('./utils/dbMigration')
const filePerms = require('./utils/filePerms')
const Logger = require('./Logger')

const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Scanner = require('./scanner/Scanner')
const Db = require('./Db')
const SocketAuthority = require('./SocketAuthority')

const ApiRouter = require('./routers/ApiRouter')
const HlsRouter = require('./routers/HlsRouter')
const StaticRouter = require('./routers/StaticRouter')

const NotificationManager = require('./managers/NotificationManager')
const CoverManager = require('./managers/CoverManager')
const AbMergeManager = require('./managers/AbMergeManager')
const CacheManager = require('./managers/CacheManager')
const LogManager = require('./managers/LogManager')
const BackupManager = require('./managers/BackupManager')
const PlaybackSessionManager = require('./managers/PlaybackSessionManager')
const PodcastManager = require('./managers/PodcastManager')
const AudioMetadataMangaer = require('./managers/AudioMetadataManager')
const RssFeedManager = require('./managers/RssFeedManager')
const CronManager = require('./managers/CronManager')
const TaskManager = require('./managers/TaskManager')

class Server {
  constructor(SOURCE, PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH) {
    this.Port = PORT
    this.Host = HOST
    global.Source = SOURCE
    global.Uid = isNaN(UID) ? 0 : Number(UID)
    global.Gid = isNaN(GID) ? 0 : Number(GID)
    global.ConfigPath = Path.normalize(CONFIG_PATH)
    global.MetadataPath = Path.normalize(METADATA_PATH)
    global.RouterBasePath = ROUTER_BASE_PATH

    // Fix backslash if not on Windows
    if (process.platform !== 'win32') {
      global.ConfigPath = global.ConfigPath.replace(/\\/g, '/')
      global.MetadataPath = global.MetadataPath.replace(/\\/g, '/')
    }

    if (!fs.pathExistsSync(global.ConfigPath)) {
      fs.mkdirSync(global.ConfigPath)
      filePerms.setDefaultDirSync(global.ConfigPath, false)
    }
    if (!fs.pathExistsSync(global.MetadataPath)) {
      fs.mkdirSync(global.MetadataPath)
      filePerms.setDefaultDirSync(global.MetadataPath, false)
    }

    this.db = new Db()
    this.watcher = new Watcher()
    this.auth = new Auth(this.db)

    // Managers
    this.taskManager = new TaskManager()
    this.notificationManager = new NotificationManager(this.db)
    this.backupManager = new BackupManager(this.db)
    this.logManager = new LogManager(this.db)
    this.cacheManager = new CacheManager()
    this.abMergeManager = new AbMergeManager(this.db, this.taskManager)
    this.playbackSessionManager = new PlaybackSessionManager(this.db)
    this.coverManager = new CoverManager(this.db, this.cacheManager)
    this.podcastManager = new PodcastManager(this.db, this.watcher, this.notificationManager)
    this.audioMetadataManager = new AudioMetadataMangaer(this.db, this.taskManager)
    this.rssFeedManager = new RssFeedManager(this.db)

    this.scanner = new Scanner(this.db, this.coverManager)
    this.cronManager = new CronManager(this.db, this.scanner, this.podcastManager)

    // Routers
    this.apiRouter = new ApiRouter(this)
    this.hlsRouter = new HlsRouter(this.db, this.auth, this.playbackSessionManager)
    this.staticRouter = new StaticRouter(this.db)

    Logger.logManager = this.logManager

    this.server = null
    this.io = null
  }

  authMiddleware(req, res, next) {
    this.auth.authMiddleware(req, res, next)
  }

  async init() {
    Logger.info('[Server] Init v' + version)
    await this.playbackSessionManager.removeOrphanStreams()

    const previousVersion = await this.db.checkPreviousVersion() // Returns null if same server version
    if (previousVersion) {
      Logger.debug(`[Server] Upgraded from previous version ${previousVersion}`)
    }
    if (previousVersion && previousVersion.localeCompare('2.0.0') < 0) { // Old version data model migration
      Logger.debug(`[Server] Previous version was < 2.0.0 - migration required`)
      await dbMigration.migrate(this.db)
    } else {
      await this.db.init()
    }

    // Create token secret if does not exist (Added v2.1.0)
    if (!this.db.serverSettings.tokenSecret) {
      await this.auth.initTokenSecret()
    }

    await this.cleanUserData() // Remove invalid user item progress
    await this.purgeMetadata() // Remove metadata folders without library item
    await this.playbackSessionManager.removeInvalidSessions()
    await this.cacheManager.ensureCachePaths()
    await this.abMergeManager.ensureDownloadDirPath()

    await this.backupManager.init()
    await this.logManager.init()
    await this.apiRouter.checkRemoveEmptySeries(this.db.series) // Remove empty series
    await this.rssFeedManager.init()
    this.cronManager.init()

    if (this.db.serverSettings.scannerDisableWatcher) {
      Logger.info(`[Server] Watcher is disabled`)
      this.watcher.disabled = true
    } else {
      this.watcher.initWatcher(this.db.libraries)
      this.watcher.on('files', this.filesChanged.bind(this))
    }
  }

  async start() {
    Logger.info('=== Starting Server ===')
    await this.init()

    const app = express()
    const router = express.Router()
    app.use(global.RouterBasePath, router)

    this.server = http.createServer(app)

    router.use(this.auth.cors)
    router.use(fileUpload())
    router.use(express.urlencoded({ extended: true, limit: "5mb" }));
    router.use(express.json({ limit: "5mb" }))

    // Static path to generated nuxt
    const distPath = Path.join(global.appRoot, '/client/dist')
    router.use(express.static(distPath))

    // Metadata folder static path
    router.use('/metadata', this.authMiddleware.bind(this), express.static(global.MetadataPath))

    // Static folder
    router.use(express.static(Path.join(global.appRoot, 'static')))

    router.use('/api', this.authMiddleware.bind(this), this.apiRouter.router)
    router.use('/hls', this.authMiddleware.bind(this), this.hlsRouter.router)
    router.use('/s', this.authMiddleware.bind(this), this.staticRouter.router)

    // EBook static file routes
    router.get('/ebook/:library/:folder/*', (req, res) => {
      const library = this.db.libraries.find(lib => lib.id === req.params.library)
      if (!library) return res.sendStatus(404)
      const folder = library.folders.find(fol => fol.id === req.params.folder)
      if (!folder) return res.status(404).send('Folder not found')

      const remainingPath = req.params['0']
      const fullPath = Path.join(folder.fullPath, remainingPath)
      res.sendFile(fullPath)
    })

    // RSS Feed temp route
    router.get('/feed/:id', (req, res) => {
      Logger.info(`[Server] Requesting rss feed ${req.params.id}`)
      this.rssFeedManager.getFeed(req, res)
    })
    router.get('/feed/:id/cover', (req, res) => {
      this.rssFeedManager.getFeedCover(req, res)
    })
    router.get('/feed/:id/item/:episodeId/*', (req, res) => {
      Logger.debug(`[Server] Requesting rss feed episode ${req.params.id}/${req.params.episodeId}`)
      this.rssFeedManager.getFeedItem(req, res)
    })

    // Client dynamic routes
    const dyanimicRoutes = [
      '/item/:id',
      '/author/:id',
      '/audiobook/:id/chapters',
      '/audiobook/:id/edit',
      '/audiobook/:id/manage',
      '/library/:library',
      '/library/:library/search',
      '/library/:library/bookshelf/:id?',
      '/library/:library/authors',
      '/library/:library/series/:id?',
      '/library/:library/podcast/search',
      '/library/:library/podcast/latest',
      '/config/users/:id',
      '/config/users/:id/sessions',
      '/config/item-metadata-utils/:id',
      '/collection/:id',
      '/playlist/:id'
    ]
    dyanimicRoutes.forEach((route) => router.get(route, (req, res) => res.sendFile(Path.join(distPath, 'index.html'))))

    router.post('/login', this.getLoginRateLimiter(), (req, res) => this.auth.login(req, res))
    router.post('/logout', this.authMiddleware.bind(this), this.logout.bind(this))
    router.post('/init', (req, res) => {
      if (this.db.hasRootUser) {
        Logger.error(`[Server] attempt to init server when server already has a root user`)
        return res.sendStatus(500)
      }
      this.initializeServer(req, res)
    })
    router.get('/status', (req, res) => {
      // status check for client to see if server has been initialized
      // server has been initialized if a root user exists
      const payload = {
        isInit: this.db.hasRootUser,
        language: this.db.serverSettings.language
      }
      if (!payload.isInit) {
        payload.ConfigPath = global.ConfigPath
        payload.MetadataPath = global.MetadataPath
      }
      res.json(payload)
    })
    router.get('/ping', (req, res) => {
      Logger.info('Received ping')
      res.json({ success: true })
    })
    app.get('/healthcheck', (req, res) => res.sendStatus(200))

    this.server.listen(this.Port, this.Host, () => {
      if (this.Host) Logger.info(`Listening on http://${this.Host}:${this.Port}`)
      else Logger.info(`Listening on port :${this.Port}`)
    })

    // Start listening for socket connections
    SocketAuthority.initialize(this)
  }

  async initializeServer(req, res) {
    Logger.info(`[Server] Initializing new server`)
    const newRoot = req.body.newRoot
    let rootPash = newRoot.password ? await this.auth.hashPass(newRoot.password) : ''
    if (!rootPash) Logger.warn(`[Server] Creating root user with no password`)
    let rootToken = await this.auth.generateAccessToken({ userId: 'root', username: newRoot.username })
    await this.db.createRootUser(newRoot.username, rootPash, rootToken)

    res.sendStatus(200)
  }

  async filesChanged(fileUpdates) {
    Logger.info('[Server]', fileUpdates.length, 'Files Changed')
    await this.scanner.scanFilesChanged(fileUpdates)
  }

  // Remove unused /metadata/items/{id} folders
  async purgeMetadata() {
    const itemsMetadata = Path.join(global.MetadataPath, 'items')
    if (!(await fs.pathExists(itemsMetadata))) return
    const foldersInItemsMetadata = await fs.readdir(itemsMetadata)

    let purged = 0
    await Promise.all(foldersInItemsMetadata.map(async foldername => {
      const hasMatchingItem = this.db.libraryItems.find(ab => ab.id === foldername)
      if (!hasMatchingItem) {
        const folderPath = Path.join(itemsMetadata, foldername)
        Logger.debug(`[Server] Purging unused metadata ${folderPath}`)

        await fs.remove(folderPath).then(() => {
          purged++
        }).catch((err) => {
          Logger.error(`[Server] Failed to delete folder path ${folderPath}`, err)
        })
      }
    }))
    if (purged > 0) {
      Logger.info(`[Server] Purged ${purged} unused library item metadata`)
    }
    return purged
  }

  // Remove user media progress with items that no longer exist & remove seriesHideFrom that no longer exist
  async cleanUserData() {
    for (let i = 0; i < this.db.users.length; i++) {
      const _user = this.db.users[i]
      let hasUpdated = false
      if (_user.mediaProgress.length) {
        const lengthBefore = _user.mediaProgress.length
        _user.mediaProgress = _user.mediaProgress.filter(mp => {
          const libraryItem = this.db.libraryItems.find(li => li.id === mp.libraryItemId)
          if (!libraryItem) return false
          if (mp.episodeId && (libraryItem.mediaType !== 'podcast' || !libraryItem.media.checkHasEpisode(mp.episodeId))) return false // Episode not found
          return true
        })

        if (lengthBefore > _user.mediaProgress.length) {
          Logger.debug(`[Server] Removing ${_user.mediaProgress.length - lengthBefore} media progress data from user ${_user.username}`)
          hasUpdated = true
        }
      }
      if (_user.seriesHideFromContinueListening.length) {
        _user.seriesHideFromContinueListening = _user.seriesHideFromContinueListening.filter(seriesId => {
          if (!this.db.series.some(se => se.id === seriesId)) { // Series removed
            hasUpdated = true
            return false
          }
          return true
        })
      }
      if (hasUpdated) {
        await this.db.updateEntity('user', _user)
      }
    }
  }

  // First time login rate limit is hit
  loginLimitReached(req, res, options) {
    Logger.error(`[Server] Login rate limit (${options.max}) was hit for ip ${req.ip}`)
    options.message = 'Too many attempts. Login temporarily locked.'
  }

  getLoginRateLimiter() {
    return rateLimit({
      windowMs: this.db.serverSettings.rateLimitLoginWindow, // 5 minutes
      max: this.db.serverSettings.rateLimitLoginRequests,
      skipSuccessfulRequests: true,
      onLimitReached: this.loginLimitReached
    })
  }

  logout(req, res) {
    if (req.body.socketId) {
      Logger.info(`[Server] User ${req.user ? req.user.username : 'Unknown'} is logging out with socket ${req.body.socketId}`)
      SocketAuthority.logout(req.body.socketId)
    }

    res.sendStatus(200)
  }

  async stop() {
    await this.watcher.close()
    Logger.info('Watcher Closed')

    return new Promise((resolve) => {
      this.server.close((err) => {
        if (err) {
          Logger.error('Failed to close server', err)
        } else {
          Logger.info('Server successfully closed')
        }
        resolve()
      })
    })
  }
}
module.exports = Server
