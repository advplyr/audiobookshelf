const Path = require('path')
const express = require('express')
const http = require('http')
const SocketIO = require('socket.io')
const fs = require('fs-extra')
const fileUpload = require('express-fileupload')

const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Scanner = require('./Scanner')
const Db = require('./Db')
const ApiController = require('./ApiController')
const HlsController = require('./HlsController')
const StreamManager = require('./StreamManager')
const RssFeeds = require('./RssFeeds')
const DownloadManager = require('./DownloadManager')
const Logger = require('./Logger')

class Server {
  constructor(PORT, CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH) {
    this.Port = PORT
    this.Host = '0.0.0.0'
    this.ConfigPath = Path.normalize(CONFIG_PATH)
    this.AudiobookPath = Path.normalize(AUDIOBOOK_PATH)
    this.MetadataPath = Path.normalize(METADATA_PATH)

    fs.ensureDirSync(CONFIG_PATH)
    fs.ensureDirSync(METADATA_PATH)
    fs.ensureDirSync(AUDIOBOOK_PATH)

    this.db = new Db(this.ConfigPath)
    this.auth = new Auth(this.db)
    this.watcher = new Watcher(this.AudiobookPath)
    this.scanner = new Scanner(this.AudiobookPath, this.MetadataPath, this.db, this.emitter.bind(this))
    this.streamManager = new StreamManager(this.db, this.MetadataPath)
    this.rssFeeds = new RssFeeds(this.Port, this.db)
    this.downloadManager = new DownloadManager(this.db, this.MetadataPath, this.AudiobookPath, this.emitter.bind(this))
    this.apiController = new ApiController(this.db, this.scanner, this.auth, this.streamManager, this.rssFeeds, this.downloadManager, this.emitter.bind(this), this.clientEmitter.bind(this))
    this.hlsController = new HlsController(this.db, this.scanner, this.auth, this.streamManager, this.emitter.bind(this), this.MetadataPath)

    this.server = null
    this.io = null

    this.clients = {}

    this.isScanning = false
    this.isScanningCovers = false
    this.isInitialized = false
  }

  get audiobooks() {
    return this.db.audiobooks
  }
  get serverSettings() {
    return this.db.serverSettings
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

  async filesChanged(files) {
    Logger.info('[Server]', files.length, 'Files Changed')
    var result = await this.scanner.filesChanged(files)
    Logger.info('[Server] Files changed result', result)
  }

  async scan() {
    Logger.info('[Server] Starting Scan')
    this.isScanning = true
    this.isInitialized = true
    this.emitter('scan_start', 'files')
    var results = await this.scanner.scan()
    this.isScanning = false
    this.emitter('scan_complete', { scanType: 'files', results })
    Logger.info('[Server] Scan complete')
  }

  async scanCovers() {
    Logger.info('[Server] Start cover scan')
    this.isScanningCovers = true
    this.emitter('scan_start', 'covers')
    var results = await this.scanner.scanCovers()
    this.isScanningCovers = false
    this.emitter('scan_complete', { scanType: 'covers', results })
    Logger.info('[Server] Cover scan complete')
  }

  cancelScan() {
    if (!this.isScanningCovers && !this.isScanning) return
    this.scanner.cancelScan = true
  }

  async init() {
    Logger.info('[Server] Init')
    await this.streamManager.removeOrphanStreams()
    await this.downloadManager.removeOrphanDownloads()
    await this.db.init()
    this.auth.init()

    this.watcher.initWatcher()
    this.watcher.on('files', this.filesChanged.bind(this))
  }

  authMiddleware(req, res, next) {
    this.auth.authMiddleware(req, res, next)
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

    if (!files.length || !title || !author) {
      return res.json({
        error: 'Invalid post data received'
      })
    }

    var outputDirectory = ''
    if (series && series.length && series !== 'null') {
      outputDirectory = Path.join(this.AudiobookPath, author, series, title)
    } else {
      outputDirectory = Path.join(this.AudiobookPath, author, title)
    }

    var exists = await fs.pathExists(outputDirectory)
    if (exists) {
      Logger.error(`[Server] Upload directory "${outputDirectory}" already exists`)
      return res.json({
        error: `Directory "${outputDirectory}" already exists`
      })
    }

    await fs.ensureDir(outputDirectory)
    Logger.info(`Uploading ${files.length} files to`, outputDirectory)

    for (let i = 0; i < files.length; i++) {
      var file = files[i]

      var path = Path.join(outputDirectory, file.name)
      await file.mv(path).catch((error) => {
        Logger.error('Failed to move file', path, error)
      })
    }
    res.sendStatus(200)
  }

  async start() {
    Logger.info('=== Starting Server ===')

    await this.init()

    const app = express()

    this.server = http.createServer(app)

    app.use(this.auth.cors)
    app.use(fileUpload())

    // Static path to generated nuxt
    const distPath = Path.join(global.appRoot, '/client/dist')
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(distPath))
      app.use('/local', express.static(this.AudiobookPath))
    } else {
      app.use(express.static(this.AudiobookPath))
    }

    app.use(express.static(this.MetadataPath))
    app.use(express.static(Path.join(global.appRoot, 'static')))
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json())

    // Dynamic routes are not generated on client
    app.get('/audiobook/:id', (req, res) => res.sendFile(Path.join(distPath, 'index.html')))

    app.use('/api', this.authMiddleware.bind(this), this.apiController.router)
    app.use('/hls', this.authMiddleware.bind(this), this.hlsController.router)
    // app.use('/hls', this.hlsController.router)
    app.use('/feeds', this.rssFeeds.router)

    app.post('/upload', this.authMiddleware.bind(this), this.handleUpload.bind(this))

    app.post('/login', (req, res) => this.auth.login(req, res))
    app.post('/logout', this.logout.bind(this))
    app.get('/ping', (req, res) => {
      Logger.info('Recieved ping')
      res.json({ success: true })
    })

    // Used in development to set-up streams without authentication
    if (process.env.NODE_ENV !== 'production') {
      app.use('/test-hls', this.hlsController.router)
      app.get('/test-stream/:id', async (req, res) => {
        var uri = await this.streamManager.openTestStream(this.MetadataPath, req.params.id)
        res.send(uri)
      })
      app.get('/catalog.json', (req, res) => {
        Logger.error('Catalog request made', req.headers)
        res.json()
      })
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
      socket.on('scan_covers', this.scanCovers.bind(this))
      socket.on('cancel_scan', this.cancelScan.bind(this))

      // Streaming
      socket.on('open_stream', (audiobookId) => this.streamManager.openStreamSocketRequest(socket, audiobookId))
      socket.on('close_stream', () => this.streamManager.closeStreamRequest(socket))
      socket.on('stream_update', (payload) => this.streamManager.streamUpdate(socket, payload))

      socket.on('progress_update', (payload) => this.audiobookProgressUpdate(socket.sheepClient, payload))

      // Downloading
      socket.on('download', (payload) => this.downloadManager.downloadSocketRequest(socket, payload))
      socket.on('remove_download', (downloadId) => this.downloadManager.removeSocketRequest(socket, downloadId))

      socket.on('test', () => {
        socket.emit('test_received', socket.id)
      })

      socket.on('disconnect', () => {
        var _client = this.clients[socket.id]
        if (!_client) {
          Logger.warn('[SOCKET] Socket disconnect, no client ' + socket.id)
        } else if (!_client.user) {
          Logger.info('[SOCKET] Unauth socket disconnected ' + socket.id)
          delete this.clients[socket.id]
        } else {
          const disconnectTime = Date.now() - _client.connected_at
          Logger.info(`[SOCKET] Socket ${socket.id} disconnected from client "${_client.user.username}" after ${disconnectTime}ms`)
          delete this.clients[socket.id]
        }
      })
    })
  }

  logout(req, res) {
    res.sendStatus(200)
  }

  audiobookProgressUpdate(client, progressPayload) {
    if (!client || !client.user) {
      Logger.error('[Server] audiobookProgressUpdate invalid socket client')
      return
    }
    client.user.updateAudiobookProgress(progressPayload.audiobookId, progressPayload)
  }

  async authenticateSocket(socket, token) {
    var user = await this.auth.verifyToken(token)
    if (!user) {
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('invalid_token')
    }
    var client = this.clients[socket.id]
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

    const initialPayload = {
      serverSettings: this.serverSettings.toJSON(),
      isScanning: this.isScanning,
      isInitialized: this.isInitialized,
      audiobookPath: this.AudiobookPath,
      metadataPath: this.MetadataPath,
      configPath: this.ConfigPath,
      user: client.user.toJSONForBrowser(),
      stream: client.stream || null
    }
    client.socket.emit('init', initialPayload)
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