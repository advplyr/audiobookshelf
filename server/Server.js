const Path = require('path')
const express = require('express')
const http = require('http')
const SocketIO = require('socket.io')
const fs = require('fs-extra')
const fileUpload = require('express-fileupload')
const rateLimit = require('express-rate-limit')

const { version } = require('../package.json')

// Utils
const dbMigration = require('./utils/dbMigration')
const Logger = require('./Logger')

// Classes
const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Scanner = require('./scanner/Scanner')
const Db = require('./Db')
const BackupManager = require('./BackupManager')
const LogManager = require('./LogManager')
const ApiRouter = require('./routers/ApiRouter')
const HlsRouter = require('./routers/HlsRouter')
const StaticRouter = require('./routers/StaticRouter')
const PlaybackSessionManager = require('./PlaybackSessionManager')
const DownloadManager = require('./DownloadManager')
const CoverController = require('./CoverController')
const CacheManager = require('./CacheManager')

class Server {
  constructor(PORT, HOST, UID, GID, CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH) {
    this.Port = PORT
    this.Host = HOST
    global.Uid = isNaN(UID) ? 0 : Number(UID)
    global.Gid = isNaN(GID) ? 0 : Number(GID)
    global.ConfigPath = Path.normalize(CONFIG_PATH)
    global.AudiobookPath = Path.normalize(AUDIOBOOK_PATH)
    global.MetadataPath = Path.normalize(METADATA_PATH)
    // Fix backslash if not on Windows
    if (process.platform !== 'win32') {
      global.ConfigPath = global.ConfigPath.replace(/\\/g, '/')
      global.AudiobookPath = global.AudiobookPath.replace(/\\/g, '/')
      global.MetadataPath = global.MetadataPath.replace(/\\/g, '/')
    }

    fs.ensureDirSync(global.ConfigPath, 0o774)
    fs.ensureDirSync(global.MetadataPath, 0o774)
    fs.ensureDirSync(global.AudiobookPath, 0o774)

    this.db = new Db()
    this.auth = new Auth(this.db)
    this.backupManager = new BackupManager(this.db, this.emitter.bind(this))
    this.logManager = new LogManager(this.db)
    this.cacheManager = new CacheManager()
    this.watcher = new Watcher()
    this.coverController = new CoverController(this.db, this.cacheManager)
    this.scanner = new Scanner(this.db, this.coverController, this.emitter.bind(this))
    this.playbackSessionManager = new PlaybackSessionManager(this.db, this.emitter.bind(this), this.clientEmitter.bind(this))
    this.downloadManager = new DownloadManager(this.db)

    // Routers
    this.apiRouter = new ApiRouter(this.db, this.auth, this.scanner, this.playbackSessionManager, this.downloadManager, this.coverController, this.backupManager, this.watcher, this.cacheManager, this.emitter.bind(this), this.clientEmitter.bind(this))
    this.hlsRouter = new HlsRouter(this.db, this.auth, this.playbackSessionManager, this.emitter.bind(this))
    this.staticRouter = new StaticRouter(this.db)

    Logger.logManager = this.logManager

    this.server = null
    this.io = null

    this.clients = {}
  }

  get usersOnline() {
    // TODO: Map open user sessions
    return Object.values(this.clients).filter(c => c.user).map(client => {
      return client.user.toJSONForPublic(this.playbackSessionManager.sessions, this.db.libraryItems)
    })
  }

  getClientsForUser(userId) {
    return Object.values(this.clients).filter(c => c.user && c.user.id === userId)
  }

  emitter(ev, data) {
    // Logger.debug('EMITTER', ev)
    this.io.emit(ev, data)
  }

  clientEmitter(userId, ev, data) {
    var clients = this.getClientsForUser(userId)
    if (!clients.length) {
      return Logger.debug(`[Server] clientEmitter - no clients found for user ${userId}`)
    }
    clients.forEach((client) => {
      if (client.socket) {
        client.socket.emit(ev, data)
      }
    })
  }

  authMiddleware(req, res, next) {
    this.auth.authMiddleware(req, res, next)
  }

  async init() {
    Logger.info('[Server] Init v' + version)
    // TODO: Remove orphan streams from playback session manager
    // await this.streamManager.ensureStreamsDir()
    // await this.streamManager.removeOrphanStreams()
    await this.downloadManager.removeOrphanDownloads()

    if (version.localeCompare('1.7.3') < 0) { // Old version data model migration
      await dbMigration.migrateUserData(this.db) // Db not yet loaded
      await this.db.init()
      await dbMigration.migrateLibraryItems(this.db)
      // TODO: Eventually remove audiobooks db when stable
    } else {
      await this.db.init()
    }

    this.auth.init()

    // TODO: Implement method to remove old user auidobook data and book metadata folders
    // await this.checkUserAudiobookData()
    // await this.purgeMetadata()

    await this.backupManager.init()
    await this.logManager.init()

    // If server upgrade and last version was 1.7.0 or earlier - add abmetadata files
    // if (this.db.checkPreviousVersionIsBefore('1.7.1')) {
    // TODO: wait until stable
    // }

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
    this.server = http.createServer(app)

    app.use(this.auth.cors)
    app.use(fileUpload())
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json())

    // Static path to generated nuxt
    const distPath = Path.join(global.appRoot, '/client/dist')
    app.use(express.static(distPath))


    // Metadata folder static path
    app.use('/metadata', this.authMiddleware.bind(this), express.static(global.MetadataPath))

    // TODO: Are these necessary?
    // Downloads folder static path
    // app.use('/downloads', this.authMiddleware.bind(this), express.static(this.downloadManager.downloadDirPath))
    // Static folder
    app.use(express.static(Path.join(global.appRoot, 'static')))

    app.use('/api', this.authMiddleware.bind(this), this.apiRouter.router)
    app.use('/hls', this.authMiddleware.bind(this), this.hlsRouter.router)
    app.use('/s', this.authMiddleware.bind(this), this.staticRouter.router)

    // EBook static file routes
    app.get('/ebook/:library/:folder/*', (req, res) => {
      var library = this.db.libraries.find(lib => lib.id === req.params.library)
      if (!library) return res.sendStatus(404)
      var folder = library.folders.find(fol => fol.id === req.params.folder)
      if (!folder) return res.status(404).send('Folder not found')

      var remainingPath = req.params['0']
      var fullPath = Path.join(folder.fullPath, remainingPath)
      res.sendFile(fullPath)
    })

    // Client dynamic routes
    app.get('/item/:id', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/audiobook/:id/edit', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/search', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/bookshelf/:id?', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/authors', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/series/:id?', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/config/users/:id', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/collection/:id', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))

    app.post('/login', this.getLoginRateLimiter(), (req, res) => this.auth.login(req, res))
    app.post('/logout', this.authMiddleware.bind(this), this.logout.bind(this))
    app.get('/ping', (req, res) => {
      Logger.info('Recieved ping')
      res.json({ success: true })
    })

    this.server.listen(this.Port, this.Host, () => {
      Logger.info(`Listening on http://${this.Host}:${this.Port}`)
    })

    this.io = new SocketIO.Server(this.server, {
      cors: {
        origin: '*',
        methods: ["GET", "POST"]
      }
    })
    this.io.on('connection', (socket) => {
      this.clients[socket.id] = {
        id: socket.id,
        socket,
        connected_at: Date.now()
      }
      socket.sheepClient = this.clients[socket.id]

      Logger.info('[Server] Socket Connected', socket.id)

      socket.on('auth', (token) => this.authenticateSocket(socket, token))

      // Scanning
      socket.on('cancel_scan', this.cancelScan.bind(this))
      socket.on('save_metadata', (libraryItemId) => this.saveMetadata(socket, libraryItemId))

      // Downloading
      socket.on('download', (payload) => this.downloadManager.downloadSocketRequest(socket, payload))
      socket.on('remove_download', (downloadId) => this.downloadManager.removeSocketRequest(socket, downloadId))

      // Logs
      socket.on('set_log_listener', (level) => Logger.addSocketListener(socket, level))
      socket.on('fetch_daily_logs', () => this.logManager.socketRequestDailyLogs(socket))

      socket.on('disconnect', () => {
        Logger.removeSocketListener(socket.id)

        var _client = this.clients[socket.id]
        if (!_client) {
          Logger.warn('[Server] Socket disconnect, no client ' + socket.id)
        } else if (!_client.user) {
          Logger.info('[Server] Unauth socket disconnected ' + socket.id)
          delete this.clients[socket.id]
        } else {
          Logger.debug('[Server] User Offline ' + _client.user.username)
          this.io.emit('user_offline', _client.user.toJSONForPublic(this.playbackSessionManager.sessions, this.db.libraryItems))

          const disconnectTime = Date.now() - _client.connected_at
          Logger.info(`[Server] Socket ${socket.id} disconnected from client "${_client.user.username}" after ${disconnectTime}ms`)
          delete this.clients[socket.id]
        }
      })
    })
  }

  async filesChanged(fileUpdates) {
    Logger.info('[Server]', fileUpdates.length, 'Files Changed')
    await this.scanner.scanFilesChanged(fileUpdates)
  }

  cancelScan(id) {
    Logger.debug('[Server] Cancel scan', id)
    this.scanner.setCancelLibraryScan(id)
  }

  // Generates an NFO metadata file, if no audiobookId is passed then all audiobooks are done
  async saveMetadata(socket, audiobookId = null) {
    Logger.info('[Server] Starting save metadata files')
    var response = await this.scanner.saveMetadata(audiobookId)
    Logger.info(`[Server] Finished saving metadata files Successful: ${response.success}, Failed: ${response.failed}`)
    socket.emit('save_metadata_complete', response)
  }

  // Remove unused /metadata/books/{id} folders
  async purgeMetadata() {
    var booksMetadata = Path.join(global.MetadataPath, 'books')
    var booksMetadataExists = await fs.pathExists(booksMetadata)
    if (!booksMetadataExists) return
    var foldersInBooksMetadata = await fs.readdir(booksMetadata)

    var purged = 0
    await Promise.all(foldersInBooksMetadata.map(async foldername => {
      var hasMatchingAudiobook = this.db.audiobooks.find(ab => ab.id === foldername)
      if (!hasMatchingAudiobook) {
        var folderPath = Path.join(booksMetadata, foldername)
        Logger.debug(`[Server] Purging unused metadata ${folderPath}`)

        await fs.remove(folderPath).then(() => {
          purged++
        }).catch((err) => {
          Logger.error(`[Server] Failed to delete folder path ${folderPath}`, err)
        })
      }
    }))
    if (purged > 0) {
      Logger.info(`[Server] Purged ${purged} unused audiobook metadata`)
    }
    return purged
  }

  // Check user audiobook data has matching audiobook
  async checkUserAudiobookData() {
    for (let i = 0; i < this.db.users.length; i++) {
      var _user = this.db.users[i]
      if (_user.audiobooks) {
        // Find user audiobook data that has no matching audiobook
        var audiobookIdsToRemove = Object.keys(_user.audiobooks).filter(aid => {
          return !this.db.audiobooks.find(ab => ab.id === aid)
        })
        if (audiobookIdsToRemove.length) {
          Logger.debug(`[Server] Found ${audiobookIdsToRemove.length} audiobook data to remove from user ${_user.username}`)
          for (let y = 0; y < audiobookIdsToRemove.length; y++) {
            _user.removeLibraryItemProgress(audiobookIdsToRemove[y])
          }
          await this.db.updateEntity('user', _user)
        }
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
    var { socketId } = req.body
    Logger.info(`[Server] User ${req.user ? req.user.username : 'Unknown'} is logging out with socket ${socketId}`)

    // Strip user and client from client and client socket
    if (socketId && this.clients[socketId]) {
      var client = this.clients[socketId]
      var clientSocket = client.socket
      Logger.debug(`[Server] Found user client ${clientSocket.id}, Has user: ${!!client.user}, Socket has client: ${!!clientSocket.sheepClient}`)

      if (client.user) {
        Logger.debug('[Server] User Offline ' + client.user.username)
        this.io.emit('user_offline', client.user.toJSONForPublic(null, this.db.libraryItems))
      }

      delete this.clients[socketId].user
      if (clientSocket && clientSocket.sheepClient) delete this.clients[socketId].socket.sheepClient
    } else if (socketId) {
      Logger.warn(`[Server] No client for socket ${socketId}`)
    }

    res.sendStatus(200)
  }

  async authenticateSocket(socket, token) {
    var user = await this.auth.authenticateUser(token)
    if (!user) {
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('invalid_token')
    }
    var client = this.clients[socket.id]

    if (client.user !== undefined) {
      Logger.debug(`[Server] Authenticating socket client already has user`, client.user)
    }

    client.user = user

    if (!client.user.toJSONForBrowser) {
      Logger.error('Invalid user...', client.user)
      return
    }

    // Check if user has session open
    var session = this.playbackSessionManager.getUserSession(user.id)
    if (session) {
      Logger.debug(`[Server] User Online "${client.user.username}" with session open "${session.id}"`)
      session = session.toJSONForClient()
      var sessionLibraryItem = this.db.libraryItems.find(li => li.id === session.libraryItemId)
      if (!sessionLibraryItem) {
        Logger.error(`[Server] Library Item for session "${session.id}" does not exist "${session.libraryItemId}"`)
        this.playbackSessionManager.removeSession(session.id)
        session = null
      } else {
        session.libraryItem = sessionLibraryItem.toJSONExpanded()
      }
    } else {
      Logger.debug(`[Server] User Online ${client.user.username}`)
    }
    this.io.emit('user_online', client.user.toJSONForPublic(this.playbackSessionManager.sessions, this.db.libraryItems))

    user.lastSeen = Date.now()
    await this.db.updateEntity('user', user)

    const initialPayload = {
      serverSettings: this.db.serverSettings.toJSON(),
      audiobookPath: global.AudiobookPath,
      metadataPath: global.MetadataPath,
      configPath: global.ConfigPath,
      user: client.user.toJSONForBrowser(),
      session,
      librariesScanning: this.scanner.librariesScanning,
      backups: (this.backupManager.backups || []).map(b => b.toJSON())
    }
    if (user.type === 'root') {
      initialPayload.usersOnline = this.usersOnline
    }
    client.socket.emit('init', initialPayload)

    // Setup log listener for root user
    if (user.type === 'root') {
      Logger.addSocketListener(socket, this.db.serverSettings.logLevel || 0)
    }
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
