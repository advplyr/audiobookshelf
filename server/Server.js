const Path = require('path')
const express = require('express')
const http = require('http')
const SocketIO = require('socket.io')
const fs = require('fs-extra')
const cookieparser = require('cookie-parser')

const Auth = require('./Auth')
const Watcher = require('./Watcher')
const Scanner = require('./Scanner')
const Db = require('./Db')
const ApiController = require('./ApiController')
const HlsController = require('./HlsController')
const StreamManager = require('./StreamManager')
const Logger = require('./Logger')
const streamTest = require('./streamTest')

class Server {
  constructor(PORT, CONFIG_PATH, METADATA_PATH, AUDIOBOOK_PATH) {
    this.Port = PORT
    this.Host = '0.0.0.0'
    this.ConfigPath = CONFIG_PATH
    this.AudiobookPath = AUDIOBOOK_PATH
    this.MetadataPath = METADATA_PATH

    fs.ensureDirSync(CONFIG_PATH)
    fs.ensureDirSync(METADATA_PATH)
    fs.ensureDirSync(AUDIOBOOK_PATH)

    this.db = new Db(this.ConfigPath)
    this.auth = new Auth(this.db)
    this.watcher = new Watcher(this.AudiobookPath)
    this.scanner = new Scanner(this.AudiobookPath, this.MetadataPath, this.db, this.emitter.bind(this))
    this.streamManager = new StreamManager(this.db, this.MetadataPath)
    this.apiController = new ApiController(this.db, this.scanner, this.auth, this.streamManager, this.emitter.bind(this))
    this.hlsController = new HlsController(this.db, this.scanner, this.auth, this.streamManager, this.emitter.bind(this), this.MetadataPath)

    this.server = null
    this.io = null

    this.clients = {}

    this.isScanning = false
    this.isInitialized = false
  }

  get audiobooks() {
    return this.db.audiobooks
  }
  get settings() {
    return this.db.settings
  }

  emitter(ev, data) {
    Logger.debug('EMITTER', ev)
    if (!this.io) {
      Logger.error('Invalid IO')
      return
    }
    this.io.emit(ev, data)
  }

  async fileAddedUpdated({ path, fullPath }) {
    Logger.info('[SERVER] FileAddedUpdated', path, fullPath)
  }

  async fileRemoved({ path, fullPath }) { }

  async scan() {
    Logger.info('[SERVER] Starting Scan')
    this.isScanning = true
    this.isInitialized = true
    this.emitter('scan_start')
    await this.scanner.scan()
    this.isScanning = false
    this.emitter('scan_complete')
    Logger.info('[SERVER] Scan complete')
  }

  async init() {
    Logger.info('[SERVER] Init')
    await this.streamManager.removeOrphanStreams()
    await this.db.init()
    this.auth.init()

    this.watcher.initWatcher()
    this.watcher.on('file_added', this.fileAddedUpdated.bind(this))
    this.watcher.on('file_removed', this.fileRemoved.bind(this))
    this.watcher.on('file_updated', this.fileAddedUpdated.bind(this))
  }

  authMiddleware(req, res, next) {
    this.auth.authMiddleware(req, res, next)
  }

  async start() {
    Logger.info('=== Starting Server ===')

    await this.init()

    const app = express()

    this.server = http.createServer(app)

    app.use(cookieparser('secret_family_recipe'))
    app.use(this.auth.cors)

    // Static path to generated nuxt
    if (process.env.NODE_ENV === 'production') {
      const distPath = Path.join(global.appRoot, '/client/dist')
      app.use(express.static(distPath))
    }

    app.use(express.static(this.AudiobookPath))
    app.use(express.static(this.MetadataPath))
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json())

    app.use('/api', this.authMiddleware.bind(this), this.apiController.router)
    app.use('/hls', this.authMiddleware.bind(this), this.hlsController.router)

    app.get('/', (req, res) => {
      res.sendFile('/index.html')
    })
    app.get('/test/:id', (req, res) => {
      var audiobook = this.audiobooks.find(a => a.id === req.params.id)
      var startTime = !isNaN(req.query.start) ? Number(req.query.start) : 0
      Logger.info('/test with audiobook', audiobook.title)
      streamTest.start(audiobook, startTime)
      res.sendStatus(200)
    })

    app.post('/stream', (req, res) => this.streamManager.openStreamRequest(req, res))
    app.post('/login', (req, res) => this.auth.login(req, res))
    app.post('/logout', this.logout.bind(this))
    app.get('/ping', (req, res) => {
      Logger.info('Recieved ping')
      res.json({ success: true })
    })

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
      socket.on('scan', this.scan.bind(this))
      socket.on('open_stream', (audiobookId) => this.streamManager.openStreamSocketRequest(socket, audiobookId))
      socket.on('close_stream', () => this.streamManager.closeStreamRequest(socket))
      socket.on('stream_update', (payload) => this.streamManager.streamUpdate(socket, payload))
      socket.on('test', () => {
        console.log('Test Request from', socket.id)
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
      settings: this.settings,
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