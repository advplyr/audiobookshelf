const Path = require('path')
const Sequelize = require('sequelize')
const express = require('express')
const http = require('http')
const util = require('util')
const fs = require('./libs/fsExtra')
const fileUpload = require('./libs/expressFileupload')
const cookieParser = require('cookie-parser')
const axios = require('axios')

const { version } = require('../package.json')

// Utils
const is = require('./libs/requestIp/isJs')
const fileUtils = require('./utils/fileUtils')
const { toNumber } = require('./utils/index')
const Logger = require('./Logger')

const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Database = require('./Database')
const SocketAuthority = require('./SocketAuthority')

const ApiRouter = require('./routers/ApiRouter')
const HlsRouter = require('./routers/HlsRouter')
const PublicRouter = require('./routers/PublicRouter')

const LogManager = require('./managers/LogManager')
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
const ShareManager = require('./managers/ShareManager')
const LibraryScanner = require('./scanner/LibraryScanner')

//Import the main Passport and Express-Session library
const passport = require('passport')
const expressSession = require('express-session')
const MemoryStore = require('./libs/memorystore')

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
    global.AllowCors = process.env.ALLOW_CORS === '1'

    if (process.env.EXP_PROXY_SUPPORT === '1') {
      // https://github.com/advplyr/audiobookshelf/pull/3754
      Logger.info(`[Server] Experimental Proxy Support Enabled, SSRF Request Filter was Disabled`)
      global.DisableSsrfRequestFilter = () => true

      axios.defaults.maxRedirects = 0
      axios.interceptors.response.use(
        (response) => response,
        (error) => {
          if ([301, 302].includes(error.response?.status)) {
            return axios({
              ...error.config,
              url: error.response.headers.location
            })
          }

          return Promise.reject(error)
        }
      )
    } else if (process.env.DISABLE_SSRF_REQUEST_FILTER === '1') {
      Logger.info(`[Server] SSRF Request Filter Disabled`)
      global.DisableSsrfRequestFilter = () => true
    } else if (process.env.SSRF_REQUEST_FILTER_WHITELIST?.length) {
      const whitelistedUrls = process.env.SSRF_REQUEST_FILTER_WHITELIST.split(',').map((url) => url.trim())
      if (whitelistedUrls.length) {
        Logger.info(`[Server] SSRF Request Filter Whitelisting: ${whitelistedUrls.join(',')}`)
        global.DisableSsrfRequestFilter = (url) => whitelistedUrls.includes(new URL(url).hostname)
      }
    }
    global.PodcastDownloadTimeout = toNumber(process.env.PODCAST_DOWNLOAD_TIMEOUT, 30000)
    global.MaxFailedEpisodeChecks = toNumber(process.env.MAX_FAILED_EPISODE_CHECKS, 24)

    if (!fs.pathExistsSync(global.ConfigPath)) {
      fs.mkdirSync(global.ConfigPath)
    }
    if (!fs.pathExistsSync(global.MetadataPath)) {
      fs.mkdirSync(global.MetadataPath)
    }

    this.auth = new Auth()

    // Managers
    this.emailManager = new EmailManager()
    this.backupManager = new BackupManager()
    this.abMergeManager = new AbMergeManager()
    this.playbackSessionManager = new PlaybackSessionManager()
    this.podcastManager = new PodcastManager()
    this.audioMetadataManager = new AudioMetadataMangaer()
    this.cronManager = new CronManager(this.podcastManager, this.playbackSessionManager)
    this.apiCacheManager = new ApiCacheManager()
    this.binaryManager = new BinaryManager()

    // Routers
    this.apiRouter = new ApiRouter(this)
    this.hlsRouter = new HlsRouter(this.auth, this.playbackSessionManager)
    this.publicRouter = new PublicRouter(this.playbackSessionManager)

    Logger.logManager = new LogManager()

    this.server = null
  }

  /**
   * Middleware to check if the current request is authenticated
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
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
    Logger.info('[Server] Node.js Version:', process.version)
    Logger.info('[Server] Platform:', process.platform)
    Logger.info('[Server] Arch:', process.arch)

    await this.playbackSessionManager.removeOrphanStreams()

    /**
     * Docker container ffmpeg/ffprobe binaries are included in the image.
     * Docker is currently using ffmpeg/ffprobe v6.1 instead of v5.1 so skipping the check
     * TODO: Support binary check for all sources
     */
    if (global.Source !== 'docker') {
      await this.binaryManager.init()
    }

    await Database.init(false)
    // Create or set JWT secret in token manager
    await this.auth.tokenManager.initTokenSecret()

    await Logger.logManager.init()

    await this.cleanUserData() // Remove invalid user item progress
    await CacheManager.ensureCachePaths()

    await ShareManager.init()
    await this.backupManager.init()
    await RssFeedManager.init()

    const libraries = await Database.libraryModel.getAllWithFolders()
    await this.cronManager.init(libraries)
    this.apiCacheManager.init()

    if (Database.serverSettings.scannerDisableWatcher) {
      Logger.info(`[Server] Watcher is disabled`)
      Watcher.disabled = true
    } else {
      Watcher.initWatcher(libraries)
      Watcher.on('scanFilesChanged', (pendingFileUpdates, pendingTask) => {
        LibraryScanner.scanFilesChanged(pendingFileUpdates, pendingTask)
      })
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
      await Logger.fatal('[Server] Unhandled rejection:', reason, '\npromise:', util.format('%O', promise))
      process.exit(1)
    })
  }

  async start() {
    Logger.info('=== Starting Server ===')

    this.initProcessEventListeners()
    await this.init()

    const app = express()

    app.use((req, res, next) => {
      if (!global.ServerSettings.allowIframe) {
        // Prevent clickjacking by disallowing iframes
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'")
      }

      // Security: Prevent referrer leakage to protect against token exposure
      // Using 'no-referrer' to completely prevent token leakage in referer headers
      res.setHeader('Referrer-Policy', 'no-referrer')

      /**
       * @temporary
       * This is necessary for the ebook & cover API endpoint in the mobile apps
       * The mobile app ereader is using fetch api in Capacitor that is currently difficult to switch to native requests
       * so we have to allow cors for specific origins to the /api/items/:id/ebook endpoint
       * The cover image is fetched with XMLHttpRequest in the mobile apps to load into a canvas and extract colors
       * @see https://ionicframework.com/docs/troubleshooting/cors
       *
       * Running in development allows cors to allow testing the mobile apps in the browser
       * or env variable ALLOW_CORS = '1'
       */
      if (global.AllowCors || Logger.isDev || req.path.match(/\/api\/items\/([a-z0-9-]{36})\/(ebook|cover)(\/[0-9]+)?/) || global.ServerSettings.allowedOrigins?.length) {
        const allowedOrigins = ['capacitor://localhost', 'http://localhost', ...(global.ServerSettings.allowedOrigins ? global.ServerSettings.allowedOrigins : [])]
        if (global.AllowCors || Logger.isDev || allowedOrigins.some((o) => o === req.get('origin'))) {
          res.header('Access-Control-Allow-Origin', req.get('origin'))
          res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
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
    app.use(
      expressSession({
        secret: this.auth.tokenManager.TokenSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          // also send the cookie if were are not on https (not every use has https)
          secure: false
        },
        store: new MemoryStore(86400000, 86400000, 1000)
      })
    )
    // init passport.js
    app.use(passport.initialize())
    // register passport in express-session
    app.use(this.auth.ifAuthNeeded(passport.session()))
    // config passport.js
    await this.auth.initPassportJs()

    const router = express.Router()

    // if RouterBasePath is set, modify all requests to include the base path
    app.use((req, res, next) => {
      const urlStartsWithRouterBasePath = req.url.startsWith(global.RouterBasePath)
      const host = req.get('host')
      const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
      const prefix = urlStartsWithRouterBasePath ? global.RouterBasePath : ''
      req.originalHostPrefix = `${protocol}://${host}${prefix}`
      if (!urlStartsWithRouterBasePath) {
        req.url = `${global.RouterBasePath}${req.url}`
      }
      next()
    })
    app.use(global.RouterBasePath, router)
    app.disable('x-powered-by')

    this.server = http.createServer(app)

    router.use(
      fileUpload({
        defCharset: 'utf8',
        defParamCharset: 'utf8',
        useTempFiles: true,
        tempFileDir: Path.join(global.MetadataPath, 'tmp')
      })
    )
    router.use(express.urlencoded({ extended: true, limit: '5mb' }))

    // Skip JSON parsing for internal-api routes
    router.use(/^(?!\/internal-api).*/, express.json({ limit: '10mb' }))

    router.use('/api', this.auth.ifAuthNeeded(this.authMiddleware.bind(this)), this.apiRouter.router)
    router.use('/hls', this.hlsRouter.router)
    router.use('/public', this.publicRouter.router)

    // Static folder
    router.use(express.static(Path.join(global.appRoot, 'static')))

    // RSS Feed temp route
    router.get('/feed/:slug', (req, res) => {
      Logger.info(`[Server] Requesting rss feed ${req.params.slug}`)
      RssFeedManager.getFeed(req, res)
    })
    router.get('/feed/:slug/cover*', (req, res) => {
      RssFeedManager.getFeedCover(req, res)
    })
    router.get('/feed/:slug/item/:episodeId/*', (req, res) => {
      Logger.debug(`[Server] Requesting rss feed episode ${req.params.slug}/${req.params.episodeId}`)
      RssFeedManager.getFeedItem(req, res)
    })

    // Auth routes
    await this.auth.initAuthRoutes(router)

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
    router.get('/healthcheck', (req, res) => res.sendStatus(200))

    const ReactClientPath = process.env.REACT_CLIENT_PATH
    if (!ReactClientPath) {
      // Static path to generated nuxt
      const distPath = Path.join(global.appRoot, '/client/dist')
      router.use(express.static(distPath))

      // Client dynamic routes
      const dynamicRoutes = [
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
        '/library/:library/stats',
        '/library/:library/series/:id?',
        '/library/:library/podcast/search',
        '/library/:library/podcast/latest',
        '/library/:library/podcast/download-queue',
        '/config/users/:id',
        '/config/users/:id/sessions',
        '/config/item-metadata-utils/:id',
        '/collection/:id',
        '/playlist/:id',
        '/share/:slug'
      ]
      dynamicRoutes.forEach((route) => router.get(route, (req, res) => res.sendFile(Path.join(distPath, 'index.html'))))
    } else {
      // This is for using the experimental Next.js client
      Logger.info(`Using React client at ${ReactClientPath}`)
      const nextPath = Path.join(ReactClientPath, 'node_modules/next')
      const next = require(nextPath)
      const nextApp = next({ dev: Logger.isDev, dir: ReactClientPath })
      const handle = nextApp.getRequestHandler()
      await nextApp.prepare()
      router.all('*', (req, res) => handle(req, res))
    }

    const unixSocketPrefix = 'unix/'
    if (this.Host?.startsWith(unixSocketPrefix)) {
      const sockPath = this.Host.slice(unixSocketPrefix.length)
      this.server.listen(sockPath, async () => {
        await fs.chmod(sockPath, 0o666)
        Logger.info(`Listening on unix socket ${sockPath}`)
      })
    } else {
      this.server.listen(this.Port, this.Host, () => {
        if (this.Host) Logger.info(`Listening on http://${is.ipv6(this.Host) ? `[${this.Host}]` : this.Host}:${this.Port}`)
        else Logger.info(`Listening on port :${this.Port}`)
      })
    }

    // Start listening for socket connections
    SocketAuthority.initialize(this)
  }

  async initializeServer(req, res) {
    Logger.info(`[Server] Initializing new server`)
    const newRoot = req.body.newRoot
    const rootUsername = newRoot.username || 'root'
    const rootPash = newRoot.password ? await this.auth.localAuthStrategy.hashPassword(newRoot.password) : ''
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
            [Sequelize.Op.in]: mediaProgressToRemove.map((mp) => mp.id)
          }
        }
      })
      if (mediaProgressRemoved) {
        Logger.info(`[Server] Removed ${mediaProgressRemoved} media progress for media items that no longer exist in db`)
      }
    }

    // Remove series from hide from continue listening that no longer exist
    try {
      const users = await Database.sequelize.query(`SELECT u.id, u.username, u.extraData, json_group_array(value) AS seriesIdsToRemove FROM users u, json_each(u.extraData->"seriesHideFromContinueListening") LEFT JOIN series se ON se.id = value WHERE se.id IS NULL GROUP BY u.id;`, {
        model: Database.userModel,
        type: Sequelize.QueryTypes.SELECT
      })
      for (const user of users) {
        const extraData = JSON.parse(user.extraData)
        const existingSeriesIds = extraData.seriesHideFromContinueListening
        const seriesIdsToRemove = JSON.parse(user.dataValues.seriesIdsToRemove)
        Logger.info(`[Server] Found ${seriesIdsToRemove.length} non-existent series in seriesHideFromContinueListening for user "${user.username}" - Removing (${seriesIdsToRemove.join(',')})`)
        const newExtraData = {
          ...extraData,
          seriesHideFromContinueListening: existingSeriesIds.filter((s) => !seriesIdsToRemove.includes(s))
        }
        await user.update({ extraData: newExtraData })
      }
    } catch (error) {
      Logger.error(`[Server] Failed to cleanup users seriesHideFromContinueListening`, error)
    }
  }

  /**
   * Gracefully stop server
   * Stops watcher and socket server
   */
  async stop() {
    Logger.info('=== Stopping Server ===')
    Watcher.close()
    Logger.info('[Server] Watcher Closed')
    await SocketAuthority.close()
    Logger.info('[Server] Closing HTTP Server')
    await new Promise((resolve) => this.server.close(resolve))
    Logger.info('[Server] HTTP Server Closed')
  }
}
module.exports = Server
