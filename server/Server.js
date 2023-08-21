const Path = require('path')
const express = require('express')
const http = require('http')
const fs = require('./libs/fsExtra')
const fileUpload = require('./libs/expressFileupload')
const rateLimit = require('./libs/expressRateLimit')

const { version } = require('../package.json')

// Utils
const filePerms = require('./utils/filePerms')
const fileUtils = require('./utils/fileUtils')
const Logger = require('./Logger')

const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Scanner = require('./scanner/Scanner')
const Database = require('./Database')
const SocketAuthority = require('./SocketAuthority')

const routes = require('./routes/index')

const ApiRouter = require('./routers/ApiRouter')
const HlsRouter = require('./routers/HlsRouter')

const NotificationManager = require('./managers/NotificationManager')
const EmailManager = require('./managers/EmailManager')
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
  constructor(SOURCE, PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH, ROUTER_BASE_PATH, LDAP_ENABLED, LDAP_URL, LDAP_BASE_DN, LDAP_BIND_USER, LDAP_BIND_PASS, LDAP_SEARCH_FILTER, LDAP_USERNAME_ATTRIBUTE) {
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
    global.ldapUrl = LDAP_URL
    global.ldapBaseDn = LDAP_BASE_DN
    global.ldapBindUser = LDAP_BIND_USER
    global.ldapBindPass = LDAP_BIND_PASS
    global.ldapSearchFilter = LDAP_SEARCH_FILTER
    global.ldapUsernameAttribute = LDAP_USERNAME_ATTRIBUTE
    global.ldapEnabled = LDAP_ENABLED

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

    this.watcher = new Watcher()
    this.auth = new Auth()

    // Managers
    this.taskManager = new TaskManager()
    this.notificationManager = new NotificationManager()
    this.emailManager = new EmailManager()
    this.backupManager = new BackupManager()
    this.logManager = new LogManager()
    this.cacheManager = new CacheManager()
    this.abMergeManager = new AbMergeManager(this.taskManager)
    this.playbackSessionManager = new PlaybackSessionManager()
    this.coverManager = new CoverManager(this.cacheManager)
    this.podcastManager = new PodcastManager(this.watcher, this.notificationManager, this.taskManager)
    this.audioMetadataManager = new AudioMetadataMangaer(this.taskManager)
    this.rssFeedManager = new RssFeedManager()

    this.scanner = new Scanner(this.coverManager, this.taskManager)
    this.cronManager = new CronManager(this.scanner, this.podcastManager)

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

  async init() {
    Logger.info('[Server] Init v' + version)
    await this.playbackSessionManager.removeOrphanStreams()

    await Database.init(false)

    // Create token secret if does not exist (Added v2.1.0)
    if (!Database.serverSettings.tokenSecret) {
      await this.auth.initTokenSecret()
    }

    await this.cleanUserData() // Remove invalid user item progress
    await this.purgeMetadata() // Remove metadata folders without library item
    await this.cacheManager.ensureCachePaths()

    await this.backupManager.init()
    await this.logManager.init()
    await this.apiRouter.checkRemoveEmptySeries(Database.series) // Remove empty series
    await this.rssFeedManager.init()
    this.cronManager.init()

    if (Database.serverSettings.scannerDisableWatcher) {
      Logger.info(`[Server] Watcher is disabled`)
      this.watcher.disabled = true
    } else {
      this.watcher.initWatcher(Database.libraries)
      this.watcher.on('files', this.filesChanged.bind(this))
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
      const itemFullPath = fileUtils.filePathToPOSIX(Path.join(itemsMetadata, foldername))

      const hasMatchingItem = Database.libraryItems.find(li => {
        if (!li.media.coverPath) return false
        return itemFullPath === fileUtils.filePathToPOSIX(Path.dirname(li.media.coverPath))
      })
      if (!hasMatchingItem) {
        Logger.debug(`[Server] Purging unused metadata ${itemFullPath}`)

        await fs.remove(itemFullPath).then(() => {
          purged++
        }).catch((err) => {
          Logger.error(`[Server] Failed to delete folder path ${itemFullPath}`, err)
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
    for (const _user of Database.users) {
      if (_user.mediaProgress.length) {
        for (const mediaProgress of _user.mediaProgress) {
          const libraryItem = Database.libraryItems.find(li => li.id === mediaProgress.libraryItemId)
          if (libraryItem && mediaProgress.episodeId) {
            const episode = libraryItem.media.checkHasEpisode?.(mediaProgress.episodeId)
            if (episode) continue
          } else {
            continue
          }

          Logger.debug(`[Server] Removing media progress ${mediaProgress.id} data from user ${_user.username}`)
          await Database.removeMediaProgress(mediaProgress.id)
        }
      }

      let hasUpdated = false
      if (_user.seriesHideFromContinueListening.length) {
        _user.seriesHideFromContinueListening = _user.seriesHideFromContinueListening.filter(seriesId => {
          if (!Database.series.some(se => se.id === seriesId)) { // Series removed
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
