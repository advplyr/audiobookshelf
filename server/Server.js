const Path = require('path')
const express = require('express')
const cookieParser = require("cookie-parser");
var session = require('express-session')
const http = require('http')
const SocketIO = require('socket.io')
const fs = require('fs-extra')
const fileUpload = require('express-fileupload')
const rateLimit = require('express-rate-limit')
const passport = require('passport');
const OidcStrategy = require('passport-openidconnect').Strategy;

const { version } = require('../package.json')

// Utils
const { ScanResult } = require('./utils/constants')
const filePerms = require('./utils/filePerms')
const { secondsToTimestamp, getId } = require('./utils/index')
const Logger = require('./Logger')

// Classes
const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Scanner = require('./scanner/Scanner')
const Db = require('./Db')
const BackupManager = require('./BackupManager')
const LogManager = require('./LogManager')
const ApiController = require('./ApiController')
const HlsController = require('./HlsController')
const StreamManager = require('./StreamManager')
const RssFeeds = require('./RssFeeds')
const DownloadManager = require('./DownloadManager')
const CoverController = require('./CoverController')
const CacheManager = require('./CacheManager')
const User = require('./objects/User')

class Server {
  constructor(PORT, UID, GID, CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH) {
    this.Port = PORT
    this.Uid = isNaN(UID) ? 0 : Number(UID)
    this.Gid = isNaN(GID) ? 0 : Number(GID)
    this.Host = '0.0.0.0'
    this.ConfigPath = Path.normalize(CONFIG_PATH)
    this.AudiobookPath = Path.normalize(AUDIOBOOK_PATH)
    this.MetadataPath = Path.normalize(METADATA_PATH)

    console.info(this.ConfigPath)
    console.info(this.MetadataPath)
    console.info(this.AudiobookPath)

    fs.ensureDirSync(CONFIG_PATH, 0o774)
    fs.ensureDirSync(METADATA_PATH, 0o774)
    fs.ensureDirSync(AUDIOBOOK_PATH, 0o774)

    this.db = new Db(this.ConfigPath, this.AudiobookPath)
    this.auth = new Auth(this.db)
    this.backupManager = new BackupManager(this.MetadataPath, this.Uid, this.Gid, this.db)
    this.logManager = new LogManager(this.MetadataPath, this.db)
    this.cacheManager = new CacheManager(this.MetadataPath)
    this.watcher = new Watcher(this.AudiobookPath)
    this.coverController = new CoverController(this.db, this.cacheManager, this.MetadataPath, this.AudiobookPath)
    this.scanner = new Scanner(this.AudiobookPath, this.MetadataPath, this.db, this.coverController, this.emitter.bind(this))

    this.streamManager = new StreamManager(this.db, this.MetadataPath, this.emitter.bind(this), this.clientEmitter.bind(this))
    this.rssFeeds = new RssFeeds(this.Port, this.db)
    this.downloadManager = new DownloadManager(this.db, this.MetadataPath, this.AudiobookPath, this.Uid, this.Gid)
    this.apiController = new ApiController(this.MetadataPath, this.db, this.auth, this.streamManager, this.rssFeeds, this.downloadManager, this.coverController, this.backupManager, this.watcher, this.cacheManager, this.emitter.bind(this), this.clientEmitter.bind(this))
    this.hlsController = new HlsController(this.db, this.auth, this.streamManager, this.emitter.bind(this), this.streamManager.StreamsPath)

    Logger.logManager = this.logManager

    this.expressApp = null
    this.server = null
    this.io = null

    this.clients = {}
    passport.serializeUser((user, next) => {
      next(null, user);
    });
    
    passport.deserializeUser((obj, next) => {
      next(null, obj);
    });
    passport.use(new OidcStrategy({
        issuer: process.env.OIDC_ISSUER,
        authorizationURL: process.env.OIDC_AUTHORIZATION_URL,
        tokenURL: process.env.OIDC_TOKEN_URL,
        userInfoURL: process.env.OIDC_USER_INFO_URL,
        clientID: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        callbackURL: '/oidc/callback',
        scope: "openid email profile"
      }, async (issuer, profile, cb) => {
        let user = this.db.users.find(u => u.id === profile.id)
        if (!user) {
          // create a user
          let account = {}      
          account.id = profile.id
          account.username = profile.username
          account.type = "guest"
          account.permissions = {
            download: false,
            update: false,
            delete: false,
            upload: false,
            accessAllLibraries: false
          }
          account.pash = await this.auth.hashPass(getId(profile.id))
          account.token = await this.auth.generateAccessToken({ userId: account.id })
          account.createdAt = Date.now()
          user = new User(account)
          const success = await this.db.insertEntity('user', user)
          if (!success) {
            cb('Failed to save new user')
          }
        }
        if (!user || !user.isActive) {
          Logger.debug(`[Auth] Failed login attempt`)
          cb("Invalid user or password")
          return
        }
        cb(null, user)
      })
    )
  }

  get audiobooks() {
    return this.db.audiobooks
  }
  get libraries() {
    return this.db.libraries
  }
  get serverSettings() {
    return this.db.serverSettings
  }
  get usersOnline() {
    return Object.values(this.clients).filter(c => c.user).map(client => {
      return client.user.toJSONForPublic(this.streamManager.streams)
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
      return Logger.error(`[Server] clientEmitter - no clients found for user ${userId}`)
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
    await this.streamManager.ensureStreamsDir()
    await this.streamManager.removeOrphanStreams()
    await this.downloadManager.removeOrphanDownloads()

    await this.db.init()
    this.auth.init()

    await this.checkUserAudiobookData()
    await this.purgeMetadata()
    await this.backupManager.init()
    await this.logManager.init()

    // Only fix duplicate ids once on upgrade
    if (this.db.previousVersion === '1.0.0') {
      Logger.info(`[Server] Running scan for duplicate book IDs`)
      await this.scanner.fixDuplicateIds()
    }

    this.watcher.initWatcher(this.libraries)
    this.watcher.on('files', this.filesChanged.bind(this))
  }

  async start() {
    Logger.info('=== Starting Server ===')
    await this.init()

    const app = express()
    this.expressApp = app

    this.server = http.createServer(app)

    app.use(this.auth.cors)
    app.use(fileUpload())
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json())
    app.use(cookieParser());
    app.use(session({
      secret: process.env.TOKEN_SECRET,
      resave: false,
      saveUninitialized: true
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    /*
    if (req.method === 'GET' && req.query && req.query.token) {
      token = req.query.token
    } else {
      const authHeader = req.headers['authorization']
      token = authHeader && authHeader.split(' ')[1]
    }
    */
    
    // Static path to generated nuxt
    const distPath = Path.join(global.appRoot, '/client/dist')
    app.use(express.static(distPath))

    // Old static path for covers
    app.use('/local', this.authMiddleware.bind(this), express.static(this.AudiobookPath))

    // Metadata folder static path
    app.use('/metadata', this.authMiddleware.bind(this), express.static(this.MetadataPath))

    // Downloads folder static path
    app.use('/downloads', this.authMiddleware.bind(this), express.static(this.downloadManager.downloadDirPath))

    // Static folder
    app.use(express.static(Path.join(global.appRoot, 'static')))

    // Static file routes
    app.get('/lib/:library/:folder/*', this.authMiddleware.bind(this), (req, res) => {
      var library = this.libraries.find(lib => lib.id === req.params.library)
      if (!library) return res.sendStatus(404)
      var folder = library.folders.find(fol => fol.id === req.params.folder)
      if (!folder) return res.status(404).send('Folder not found')

      var remainingPath = req.params['0']
      var fullPath = Path.join(folder.fullPath, remainingPath)
      res.sendFile(fullPath)
    })

    // Book static file routes
    app.get('/s/book/:id/*', this.authMiddleware.bind(this), (req, res) => {
      var audiobook = this.audiobooks.find(ab => ab.id === req.params.id)
      if (!audiobook) return res.status(404).send('Book not found with id ' + req.params.id)

      var remainingPath = req.params['0']
      var fullPath = Path.join(audiobook.fullPath, remainingPath)
      res.sendFile(fullPath)
    })

    // EBook static file routes
    app.get('/ebook/:library/:folder/*', (req, res) => {
      var library = this.libraries.find(lib => lib.id === req.params.library)
      if (!library) return res.sendStatus(404)
      var folder = library.folders.find(fol => fol.id === req.params.folder)
      if (!folder) return res.status(404).send('Folder not found')

      var remainingPath = req.params['0']
      var fullPath = Path.join(folder.fullPath, remainingPath)
      res.sendFile(fullPath)
    })

    // Client dynamic routes
    app.get('/audiobook/:id', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/audiobook/:id/edit', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/search', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/bookshelf/:id?', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/authors', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/library/:library/series/:id?', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/config/users/:id', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))
    app.get('/collection/:id', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))

    app.use('/api', this.authMiddleware.bind(this), this.apiController.router)
    app.use('/hls', this.authMiddleware.bind(this), this.hlsController.router)

    // Incomplete work in progress
    // app.use('/feeds', this.rssFeeds.router)

    app.post('/upload', this.authMiddleware.bind(this), this.handleUpload.bind(this))

    var loginRateLimiter = this.getLoginRateLimiter()
    app.post('/login', loginRateLimiter, (req, res) => this.auth.login(req, res))

    app.post('/logout', this.authMiddleware.bind(this), this.logout.bind(this))

    app.get("/oidc/login", passport.authenticate('openidconnect'))

    app.get("/oidc/callback", 
      passport.authenticate('openidconnect', { failureRedirect: '/oidc/login', failureMessage: true }),
      async (req, res) => {
        const token = this.auth.generateAccessToken({userId: req.user.id})
        res.cookie('token', token, { httpOnly: true /* TODO: Set secure: true */ });
        res.cookie('sso', true, { httpOnly: false /* TODO: Set secure: true */ });

        res.redirect('/');
      }
      // (req, res, next) => {
      // passport.authenticate('openidconnect', async (err, user, info) => {
      //     
      //     Logger.debug(JSON.stringify({user, info}))
      //     
      //     const token = await this.auth.generateAccessToken({ userId: user.id })
      //     res.cookie('token', token, { httpOnly: true /* TODO: Set secure: true */ });
      //     res.cookie('sso', true, { httpOnly: false /* TODO: Set secure: true */ });
      //     
      //     res.redirect('/'); 
      //   })(req, res, next)
      // 
      // }
    )

    // app.get("/oidc/token", (req, res) => {
    //   req.cookies.get("token")
    // })

    app.get('/ping', (req, res) => {
      Logger.info('Recieved ping')
      res.json({ success: true })
    })

    // Used in development to set-up streams without authentication
    if (process.env.NODE_ENV !== 'production') {
      app.use('/test-hls', this.hlsController.router)
    }

    this.server.listen(this.Port, this.Host, () => {
      Logger.info(`Running on http://${this.Host}:${this.Port}`)
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

      Logger.info('[SOCKET] Socket Connected', socket.id)

      socket.on('auth', (token) => this.authenticateSocket(socket, token))

      // Scanning
      socket.on('scan', this.scan.bind(this))
      socket.on('cancel_scan', this.cancelScan.bind(this))
      socket.on('scan_audiobook', (audiobookId) => this.scanAudiobook(socket, audiobookId))
      socket.on('save_metadata', (audiobookId) => this.saveMetadata(socket, audiobookId))

      // Streaming
      socket.on('open_stream', (audiobookId) => this.streamManager.openStreamSocketRequest(socket, audiobookId))
      socket.on('close_stream', () => this.streamManager.closeStreamRequest(socket))
      socket.on('stream_update', (payload) => this.streamManager.streamUpdate(socket, payload))
      socket.on('stream_sync', (syncData) => this.streamManager.streamSync(socket, syncData))

      socket.on('progress_update', (payload) => this.audiobookProgressUpdate(socket, payload))

      // Downloading
      socket.on('download', (payload) => this.downloadManager.downloadSocketRequest(socket, payload))
      socket.on('remove_download', (downloadId) => this.downloadManager.removeSocketRequest(socket, downloadId))

      // Logs
      socket.on('set_log_listener', (level) => Logger.addSocketListener(socket, level))
      socket.on('fetch_daily_logs', () => this.logManager.socketRequestDailyLogs(socket))

      // Backups
      socket.on('create_backup', () => this.backupManager.requestCreateBackup(socket))
      socket.on('apply_backup', (id) => this.backupManager.requestApplyBackup(socket, id))

      // Bookmarks
      socket.on('create_bookmark', (payload) => this.createBookmark(socket, payload))
      socket.on('update_bookmark', (payload) => this.updateBookmark(socket, payload))
      socket.on('delete_bookmark', (payload) => this.deleteBookmark(socket, payload))

      socket.on('test', () => {
        socket.emit('test_received', socket.id)
      })

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
          this.io.emit('user_offline', _client.user.toJSONForPublic(this.streamManager.streams))

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

  async scan(libraryId, options = {}) {
    Logger.info('[Server] Starting Scan')
    await this.scanner.scan(libraryId, options)
    // await this.scanner.scan(libraryId)
    Logger.info('[Server] Scan complete')
  }

  async scanAudiobook(socket, audiobookId) {
    var result = await this.scanner.scanAudiobookById(audiobookId)
    var scanResultName = ''
    for (const key in ScanResult) {
      if (ScanResult[key] === result) {
        scanResultName = key
      }
    }
    socket.emit('audiobook_scan_complete', scanResultName)
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
    var booksMetadata = Path.join(this.MetadataPath, 'books')
    var booksMetadataExists = await fs.pathExists(booksMetadata)
    if (!booksMetadataExists) return
    var foldersInBooksMetadata = await fs.readdir(booksMetadata)

    var purged = 0
    await Promise.all(foldersInBooksMetadata.map(async foldername => {
      var hasMatchingAudiobook = this.audiobooks.find(ab => ab.id === foldername)
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
            _user.deleteAudiobookData(audiobookIdsToRemove[y])
          }
          await this.db.updateEntity('user', _user)
        }
      }
    }
  }

  async handleUpload(req, res) {
    if (!req.user.canUpload) {
      Logger.warn('User attempted to upload without permission', req.user)
      return res.sendStatus(403)
    }
    var files = Object.values(req.files)
    var title = req.body.title
    var author = req.body.author
    var series = req.body.series
    var libraryId = req.body.library
    var folderId = req.body.folder

    var library = this.db.libraries.find(lib => lib.id === libraryId)
    if (!library) {
      return res.status(500).error(`Library not found with id ${libraryId}`)
    }
    var folder = library.folders.find(fold => fold.id === folderId)
    if (!folder) {
      return res.status(500).error(`Folder not found with id ${folderId} in library ${library.name}`)
    }

    if (!files.length || !title || !author) {
      return res.status(500).error(`Invalid post data`)
    }

    // For setting permissions recursively
    var firstDirPath = Path.join(folder.fullPath, author)

    var outputDirectory = ''
    if (series && series.length && series !== 'null') {
      outputDirectory = Path.join(folder.fullPath, author, series, title)
    } else {
      outputDirectory = Path.join(folder.fullPath, author, title)
    }

    var exists = await fs.pathExists(outputDirectory)
    if (exists) {
      Logger.error(`[Server] Upload directory "${outputDirectory}" already exists`)
      return res.status(500).send(`Directory "${outputDirectory}" already exists`)
    }

    await fs.ensureDir(outputDirectory)

    Logger.info(`Uploading ${files.length} files to`, outputDirectory)

    for (let i = 0; i < files.length; i++) {
      var file = files[i]

      var path = Path.join(outputDirectory, file.name)
      await file.mv(path).then(() => {
        return true
      }).catch((error) => {
        Logger.error('Failed to move file', path, error)
        return false
      })
    }

    Logger.info(`[Server] Setting owner/perms for first dir "${firstDirPath}"`)
    await filePerms(firstDirPath, 0o774, this.Uid, this.Gid)

    res.sendStatus(200)
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

    res.clearCookie('sso');
    res.clearCookie('token');
    if (req.logout) req.logout();
    // Strip user and client from client and client socket
    if (socketId && this.clients[socketId]) {
      var client = this.clients[socketId]
      var clientSocket = client.socket
      Logger.debug(`[Server] Found user client ${clientSocket.id}, Has user: ${!!client.user}, Socket has client: ${!!clientSocket.sheepClient}`)

      if (client.user) {
        Logger.debug('[Server] User Offline ' + client.user.username)
        this.io.emit('user_offline', client.user.toJSONForPublic(null))
      }

      delete this.clients[socketId].user
      delete this.clients[socketId].stream
      if (clientSocket && clientSocket.sheepClient) delete this.clients[socketId].socket.sheepClient
    } else if (socketId) {
      Logger.warn(`[Server] No client for socket ${socketId}`)
    }

    res.sendStatus(200)
  }

  async audiobookProgressUpdate(socket, progressPayload) {
    var client = socket.sheepClient
    if (!client || !client.user) {
      Logger.error('[Server] audiobookProgressUpdate invalid socket client')
      return
    }
    var audiobookProgress = client.user.updateAudiobookData(progressPayload.audiobookId, progressPayload)
    if (audiobookProgress) {
      await this.db.updateEntity('user', client.user)
      this.clientEmitter(client.user.id, 'current_user_audiobook_update', {
        id: progressPayload.audiobookId,
        data: audiobookProgress || null
      })
    }
  }

  async createBookmark(socket, payload) {
    var client = socket.sheepClient
    if (!client || !client.user) {
      Logger.error('[Server] createBookmark invalid socket client')
      return
    }
    var userAudiobook = client.user.createBookmark(payload)
    if (!userAudiobook || userAudiobook.error) {
      var failMessage = (userAudiobook ? userAudiobook.error : null) || 'Unknown Error'
      socket.emit('show_error_toast', `Failed to create Bookmark: ${failMessage}`)
      return
    }

    await this.db.updateEntity('user', client.user)

    socket.emit('show_success_toast', `${secondsToTimestamp(payload.time)} Bookmarked`)

    this.clientEmitter(client.user.id, 'current_user_audiobook_update', {
      id: userAudiobook.audiobookId,
      data: userAudiobook || null
    })
  }

  async updateBookmark(socket, payload) {
    var client = socket.sheepClient
    if (!client || !client.user) {
      Logger.error('[Server] updateBookmark invalid socket client')
      return
    }
    var userAudiobook = client.user.updateBookmark(payload)
    if (!userAudiobook || userAudiobook.error) {
      var failMessage = (userAudiobook ? userAudiobook.error : null) || 'Unknown Error'
      socket.emit('show_error_toast', `Failed to update Bookmark: ${failMessage}`)
      return
    }

    await this.db.updateEntity('user', client.user)

    socket.emit('show_success_toast', `Bookmark ${secondsToTimestamp(payload.time)} Updated`)

    this.clientEmitter(client.user.id, 'current_user_audiobook_update', {
      id: userAudiobook.audiobookId,
      data: userAudiobook || null
    })
  }

  async deleteBookmark(socket, payload) {
    var client = socket.sheepClient
    if (!client || !client.user) {
      Logger.error('[Server] deleteBookmark invalid socket client')
      return
    }
    var userAudiobook = client.user.deleteBookmark(payload)
    if (!userAudiobook || userAudiobook.error) {
      var failMessage = (userAudiobook ? userAudiobook.error : null) || 'Unknown Error'
      socket.emit('show_error_toast', `Failed to delete Bookmark: ${failMessage}`)
      return
    }

    await this.db.updateEntity('user', client.user)

    socket.emit('show_success_toast', `Bookmark ${secondsToTimestamp(payload.time)} Removed`)

    this.clientEmitter(client.user.id, 'current_user_audiobook_update', {
      id: userAudiobook.audiobookId,
      data: userAudiobook || null
    })
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

    // Check if user has stream open
    if (client.user.stream) {
      Logger.info('User has stream open already', client.user.stream)
      client.stream = this.streamManager.getStream(client.user.stream)
      if (!client.stream) {
        Logger.error('Invalid user stream id', client.user.stream)
        this.streamManager.removeOrphanStreamFiles(client.user.stream)
        await this.db.updateUserStream(client.user.id, null)
      }
    }

    Logger.debug(`[Server] User Online ${client.user.username}`)
    this.io.emit('user_online', client.user.toJSONForPublic(this.streamManager.streams))

    user.lastSeen = Date.now()
    await this.db.updateEntity('user', user)

    const initialPayload = {
      serverSettings: this.serverSettings.toJSON(),
      audiobookPath: this.AudiobookPath,
      metadataPath: this.MetadataPath,
      configPath: this.ConfigPath,
      user: client.user.toJSONForBrowser(),
      stream: client.stream || null,
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