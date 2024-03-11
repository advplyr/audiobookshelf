const Path = require('path')
const Sequelize = require('sequelize')
const express = require('express')
const http = require('http')
const util = require('util')
const fs = require('./libs/fsExtra')
const fileUpload = require('./libs/expressFileupload')
const cookieParser = require("cookie-parser")

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

const LogManager = require('./managers/LogManager')
const NotificationManager = require('./managers/NotificationManager')
const EmailManager = require('./managers/EmailManager')
const AbMergeManager = require('./managers/AbMergeManager')
const CacheManager = require('./managers/CacheManager')
const BackupManager = require('./managers/BackupManager')
const PlaybackSessionManager = require('./managers/PlaybackSessionManager')
const PodcastManager = require('./managers/PodcastManager')
const AudioMetadataMangaer = require('./managers/AudioMetadataManager')
const RssFeedManager = require('./managers/RssFeedManager')
const CronManager = require('./managers/CronManager')
const ApiCacheManager = require('./managers/ApiCacheManager')
const BinaryManager = require('./managers/BinaryManager')
const LibraryScanner = require('./scanner/LibraryScanner')

//Import the main Passport and Express-Session library
const passport = require('passport')
const expressSession = require('express-session')

class Server {
  constructor(SOURCE, PORT, HOST, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH) {
    this.Port = PORT
    this.Host = HOST
    global.Source = SOURCE
    global.isWin = process.platform === 'win32'
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
    this.notificationManager = new NotificationManager()
    this.emailManager = new EmailManager()
    this.backupManager = new BackupManager()
    this.abMergeManager = new AbMergeManager()
    this.playbackSessionManager = new PlaybackSessionManager()
    this.podcastManager = new PodcastManager(this.watcher, this.notificationManager)
    this.audioMetadataManager = new AudioMetadataMangaer()
    this.rssFeedManager = new RssFeedManager()
    this.cronManager = new CronManager(this.podcastManager)
    this.apiCacheManager = new ApiCacheManager()
    this.binaryManager = new BinaryManager()

    // Routers
    this.apiRouter = new ApiRouter(this)
    this.hlsRouter = new HlsRouter(this.auth, this.playbackSessionManager)

    Logger.logManager = new LogManager()

    this.server = null
    this.io = null
  }

  authMiddleware(req, res, next) {
    // ask passportjs if the current request is authenticated
    this.auth.isAuthenticated(req, res, next)
  }

  cancelLibraryScan(libraryId) {
    LibraryScanner.setCancelLibraryScan(libraryId)
  }

  /**
   * Initialize database, backups, logs, rss feeds, cron jobs & watcher
   * Cleanup stale/invalid data
   */
  async init() {
    Logger.info('[Server] Init v' + version)

    await this.playbackSessionManager.removeOrphanStreams()

    await Database.init(false)

    await Logger.logManager.init()

    // Create token secret if does not exist (Added v2.1.0)
    if (!Database.serverSettings.tokenSecret) {
      await this.auth.initTokenSecret()
    }

    await this.cleanUserData() // Remove invalid user item progress
    await CacheManager.ensureCachePaths()

    await this.backupManager.init()
    await this.rssFeedManager.init()

    const libraries = await Database.libraryModel.getAllOldLibraries()
    await this.cronManager.init(libraries)
    this.apiCacheManager.init()

    // Download ffmpeg & ffprobe if not found (Currently only in use for Windows installs)
    if (global.isWin || Logger.isDev) {
      await this.binaryManager.init()
    }

    if (Database.serverSettings.scannerDisableWatcher) {
      Logger.info(`[Server] Watcher is disabled`)
      this.watcher.disabled = true
    } else {
      this.watcher.initWatcher(libraries)
    }
  }

  /**
   * Listen for SIGINT and uncaught exceptions
   */
  initProcessEventListeners() {
    let sigintAlreadyReceived = false
    process.on('SIGINT', async () => {
      if (!sigintAlreadyReceived) {
        sigintAlreadyReceived = true
        Logger.info('SIGINT (Ctrl+C) received. Shutting down...')
        await this.stop()
        Logger.info('Server stopped. Exiting.')
      } else {
        Logger.info('SIGINT (Ctrl+C) received again. Exiting immediately.')
      }
      process.exit(0)
    })

    /**
     * @see https://nodejs.org/api/process.html#event-uncaughtexceptionmonitor
     */
    process.on('uncaughtExceptionMonitor', async (error, origin) => {
      await Logger.fatal(`[Server] Uncaught exception origin: ${origin}, error:`, util.format('%O', error))
    })
    /**
     * @see https://nodejs.org/api/process.html#event-unhandledrejection
     */
    process.on('unhandledRejection', async (reason, promise) => {
      await Logger.fatal(`[Server] Unhandled rejection: ${reason}, promise:`, util.format('%O', promise))
      process.exit(1)
    })
  }

  async start() {
    Logger.info('=== Starting Server ===')
    this.initProcessEventListeners()
    await this.init()

    const app = express()

    /**
     * @temporary
     * This is necessary for the ebook & cover API endpoint in the mobile apps
     * The mobile app ereader is using fetch api in Capacitor that is currently difficult to switch to native requests
     * so we have to allow cors for specific origins to the /api/items/:id/ebook endpoint
     * The cover image is fetched with XMLHttpRequest in the mobile apps to load into a canvas and extract colors
     * @see https://ionicframework.com/docs/troubleshooting/cors
     * 
     * Running in development allows cors to allow testing the mobile apps in the browser 
     */
    app.use((req, res, next) => {
      if (Logger.isDev || req.path.match(/\/api\/items\/([a-z0-9-]{36})\/(ebook|cover)(\/[0-9]+)?/)) {
        const allowedOrigins = ['capacitor://localhost', 'http://localhost']
        if (Logger.isDev || allowedOrigins.some(o => o === req.get('origin'))) {
          res.header('Access-Control-Allow-Origin', req.get('origin'))
          res.header("Access-Control-Allow-Methods", 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
          res.header('Access-Control-Allow-Headers', '*')
          res.header('Access-Control-Allow-Credentials', true)
          if (req.method === 'OPTIONS') {
            return res.sendStatus(200)
          }
        }
      }

      next()
    })

    // parse cookies in requests
    app.use(cookieParser())
    // enable express-session
    app.use(expressSession({
      secret: global.ServerSettings.tokenSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        // also send the cookie if were are not on https (not every use has https)
        secure: false
      },
    }))
    // init passport.js
    app.use(passport.initialize())
    // register passport in express-session
    app.use(passport.session())
    // config passport.js
    await this.auth.initPassportJs()

    const router = express.Router()
    app.use(global.RouterBasePath, router)
    app.disable('x-powered-by')

    this.server = http.createServer(app)

    router.use(fileUpload({
      defCharset: 'utf8',
      defParamCharset: 'utf8',
      useTempFiles: true,
      tempFileDir: Path.join(global.MetadataPath, 'tmp')
    }))
    router.use(express.urlencoded({ extended: true, limit: "5mb" }))
    router.use(express.json({ limit: "5mb" }))

    // Static path to generated nuxt
    const distPath = Path.join(global.appRoot, '/client/dist')
    router.use(express.static(distPath))

    // Static folder
    router.use(express.static(Path.join(global.appRoot, 'static')))

    router.use('/api', this.authMiddleware.bind(this), this.apiRouter.router)
    router.use('/hls', this.authMiddleware.bind(this), this.hlsRouter.router)

    // RSS Feed temp route
    router.get('/feed/:slug', (req, res) => {
      Logger.info(`[Server] Requesting rss feed ${req.params.slug}`)
      this.rssFeedManager.getFeed(req, res)
    })
    router.get('/feed/:slug/cover*', (req, res) => {
      this.rssFeedManager.getFeedCover(req, res)
    })
    router.get('/feed/:slug/item/:episodeId/*', (req, res) => {
      Logger.debug(`[Server] Requesting rss feed episode ${req.params.slug}/${req.params.episodeId}`)
      this.rssFeedManager.getFeedItem(req, res)
    })

    // Auth routes
    await this.auth.initAuthRoutes(router)

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
      '/library/:library/narrators',
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
        app: 'audiobookshelf',
        serverVersion: version,
        isInit: Database.hasRootUser,
        language: Database.serverSettings.language,
        authMethods: Database.serverSettings.authActiveAuthMethods,
        authFormData: Database.serverSettings.authFormData
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

  /**
   * Gracefully stop server
   * Stops watcher and socket server
   */
  async stop() {
    Logger.info('=== Stopping Server ===')
    await this.watcher.close()
    Logger.info('Watcher Closed')

    return new Promise((resolve) => {
      SocketAuthority.close((err) => {
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
