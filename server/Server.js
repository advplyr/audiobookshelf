const Path = require('path')
const Sequelize = require('sequelize')
const express = require('express')
const http = require('http')
const fs = require('./libs/fsExtra')
const fileUpload = require('./libs/expressFileupload')
const rateLimit = require('./libs/expressRateLimit')

const { version } = require('../package.json')

// Utils
const fileUtils = require('./utils/fileUtils')
const Logger = require('./Logger')

const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Database = require('./Database')
const SocketAuthority = require('./SocketAuthority')

const ApiRouter = require('./routers/ApiRouter')
const HlsRouter = require('./routers/HlsRouter')

const NotificationManager = require('./managers/NotificationManager')
const EmailManager = require('./managers/EmailManager')
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
const LibraryScanner = require('./scanner/LibraryScanner')

class Server {
  constructor(SOURCE, PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH) {
    this.Port = PORT
    this.Host = HOST
    global.Source = SOURCE
    global.isWin = process.platform === 'win32'
    global.Uid = isNaN(UID) ? undefined : Number(UID)
    global.Gid = isNaN(GID) ? undefined : Number(GID)
    global.ConfigPath = fileUtils.filePathToPOSIX(Path.normalize(CONFIG_PATH))
    global.MetadataPath = fileUtils.filePathToPOSIX(Path.normalize(METADATA_PATH))
    global.RouterBasePath = ROUTER_BASE_PATH
    global.XAccel = process.env.USE_X_ACCEL

    if (!fs.pathExistsSync(global.ConfigPath)) {
      fs.mkdirSync(global.ConfigPath)
    }
    if (!fs.pathExistsSync(global.MetadataPath)) {
      fs.mkdirSync(global.MetadataPath)
    }

    this.watcher = new Watcher()
    this.auth = new Auth()

    // Managers
    this.taskManager = new TaskManager()
    this.notificationManager = new NotificationManager()
    this.emailManager = new EmailManager()
    this.backupManager = new BackupManager()
    this.logManager = new LogManager()
    this.abMergeManager = new AbMergeManager(this.taskManager)
    this.playbackSessionManager = new PlaybackSessionManager()
    this.podcastManager = new PodcastManager(this.watcher, this.notificationManager, this.taskManager)
    this.audioMetadataManager = new AudioMetadataMangaer(this.taskManager)
    this.rssFeedManager = new RssFeedManager()
    this.cronManager = new CronManager(this.podcastManager)

    // Routers
    this.apiRouter = new ApiRouter(this)
    this.hlsRouter = new HlsRouter(this.auth, this.playbackSessionManager)

    Logger.logManager = this.logManager

    this.server = null
    this.io = null
  }

  authMiddleware(req, res, next) {
    this.auth.authMiddleware(req, res, next)
  }

  cancelLibraryScan(libraryId) {
    LibraryScanner.setCancelLibraryScan(libraryId)
  }

  getLibrariesScanning() {
    return LibraryScanner.librariesScanning
  }

  /**
   * Initialize database, backups, logs, rss feeds, cron jobs & watcher
   * Cleanup stale/invalid data
   */
  async init() {
    Logger.info('[Server] Init v' + version)
    await this.playbackSessionManager.removeOrphanStreams()

    await Database.init(false)

    // Create token secret if does not exist (Added v2.1.0)
    if (!Database.serverSettings.tokenSecret) {
      await this.auth.initTokenSecret()
    }

    await this.cleanUserData() // Remove invalid user item progress
    await CacheManager.ensureCachePaths()

    await this.backupManager.init()
    await this.logManager.init()
    await this.rssFeedManager.init()

    const libraries = await Database.libraryModel.getAllOldLibraries()
    await this.cronManager.init(libraries)

    if (Database.serverSettings.scannerDisableWatcher) {
      Logger.info(`[Server] Watcher is disabled`)
      this.watcher.disabled = true
    } else {
      this.watcher.initWatcher(libraries)
    }
  }

  async start() {
    Logger.info('=== Starting Server ===')
    await this.init()

    const app = express()
    const router = express.Router()
    app.use(global.RouterBasePath, router)
    app.disable('x-powered-by')

    this.server = http.createServer(app)

    router.use(this.auth.cors)
    router.use(fileUpload({
      defCharset: 'utf8',
      defParamCharset: 'utf8',
      useTempFiles: true,
      tempFileDir: Path.join(global.MetadataPath, 'tmp')
    }))
    router.use(express.urlencoded({ extended: true, limit: "5mb" }));
    router.use(express.json({ limit: "5mb" }))

    // Static path to generated nuxt
    const distPath = Path.join(global.appRoot, '/client/dist')
    router.use(express.static(distPath))

    // Static folder
    router.use(express.static(Path.join(global.appRoot, 'static')))

    // router.use('/api/v1', routes) // TODO: New routes
    router.use('/api', this.authMiddleware.bind(this), this.apiRouter.router)
    router.use('/hls', this.authMiddleware.bind(this), this.hlsRouter.router)

    // RSS Feed temp route
    router.get('/feed/:slug', (req, res) => {
      Logger.info(`[Server] Requesting rss feed ${req.params.slug}`)
      this.rssFeedManager.getFeed(req, res)
    })
    router.get('/feed/:slug/cover', (req, res) => {
      this.rssFeedManager.getFeedCover(req, res)
    })
    router.get('/feed/:slug/item/:episodeId/*', (req, res) => {
      Logger.debug(`[Server] Requesting rss feed episode ${req.params.slug}/${req.params.episodeId}`)
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
      '/library/:library/podcast/download-queue',
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
      if (Database.hasRootUser) {
        Logger.error(`[Server] attempt to init server when server already has a root user`)
        return res.sendStatus(500)
      }
      this.initializeServer(req, res)
    })
    router.get('/status', (req, res) => {
      // status check for client to see if server has been initialized
      // server has been initialized if a root user exists
      const payload = {
        isInit: Database.hasRootUser,
        language: Database.serverSettings.language
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
    const rootUsername = newRoot.username || 'root'
    const rootPash = newRoot.password ? await this.auth.hashPass(newRoot.password) : ''
    if (!rootPash) Logger.warn(`[Server] Creating root user with no password`)
    await Database.createRootUser(rootUsername, rootPash, this.auth)

    res.sendStatus(200)
  }

  /**
   * Remove user media progress for items that no longer exist & remove seriesHideFrom that no longer exist
   */
  async cleanUserData() {
    // Get all media progress without an associated media item
    const mediaProgressToRemove = await Database.mediaProgressModel.findAll({
      where: {
        '$podcastEpisode.id$': null,
        '$book.id$': null
      },
      attributes: ['id'],
      include: [
        {
          model: Database.bookModel,
          attributes: ['id']
        },
        {
          model: Database.podcastEpisodeModel,
          attributes: ['id']
        }
      ]
    })
    if (mediaProgressToRemove.length) {
      // Remove media progress
      const mediaProgressRemoved = await Database.mediaProgressModel.destroy({
        where: {
          id: {
            [Sequelize.Op.in]: mediaProgressToRemove.map(mp => mp.id)
          }
        }
      })
      if (mediaProgressRemoved) {
        Logger.info(`[Server] Removed ${mediaProgressRemoved} media progress for media items that no longer exist in db`)
      }
    }

    // Remove series from hide from continue listening that no longer exist
    const users = await Database.userModel.getOldUsers()
    for (const _user of users) {
      let hasUpdated = false
      if (_user.seriesHideFromContinueListening.length) {
        const seriesHiding = (await Database.seriesModel.findAll({
          where: {
            id: _user.seriesHideFromContinueListening
          },
          attributes: ['id'],
          raw: true
        })).map(se => se.id)
        _user.seriesHideFromContinueListening = _user.seriesHideFromContinueListening.filter(seriesId => {
          if (!seriesHiding.includes(seriesId)) { // Series removed
            hasUpdated = true
            return false
          }
          return true
        })
      }
      if (hasUpdated) {
        await Database.updateUser(_user)
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
      windowMs: Database.serverSettings.rateLimitLoginWindow, // 5 minutes
      max: Database.serverSettings.rateLimitLoginRequests,
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
