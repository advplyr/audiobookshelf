const SocketIO = require('socket.io')
const Logger = require('./Logger')

class SocketAuthority {
  constructor() {
    this.Server = null
    this.io = null

    this.clients = {}
  }

  // returns an array of User.toJSONForPublic with `connections` for the # of socket connections
  //  a user can have many socket connections
  getUsersOnline() {
    const onlineUsersMap = {}
    Object.values(this.clients).filter(c => c.user).forEach(client => {
      if (onlineUsersMap[client.user.id]) {
        onlineUsersMap[client.user.id].connections++
      } else {
        onlineUsersMap[client.user.id] = {
          ...client.user.toJSONForPublic(this.Server.playbackSessionManager.sessions, this.Server.db.libraryItems),
          connections: 1
        }
      }
    })
    return Object.values(onlineUsersMap)
  }

  getClientsForUser(userId) {
    return Object.values(this.clients).filter(c => c.user && c.user.id === userId)
  }

  emitter(evt, data) {
    for (const socketId in this.clients) {
      this.clients[socketId].socket.emit(evt, data)
    }
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

  initialize(Server) {
    this.Server = Server

    this.io = new SocketIO.Server(this.Server.server, {
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

      // Required for associating a User with a socket
      socket.on('auth', (token) => this.authenticateSocket(socket, token))

      // Scanning
      socket.on('cancel_scan', this.cancelScan.bind(this))

      // Logs
      socket.on('set_log_listener', (level) => Logger.addSocketListener(socket, level))
      socket.on('remove_log_listener', () => Logger.removeSocketListener(socket.id))
      socket.on('fetch_daily_logs', () => this.Server.logManager.socketRequestDailyLogs(socket))

      // Events for testing
      socket.on('message_all_users', (payload) => {
        // admin user can send a message to all authenticated users
        //   displays on the web app as a toast
        const client = this.clients[socket.id] || {}
        if (client.user && client.user.isAdminOrUp) {
          this.emitter('admin_message', payload.message || '')
        } else {
          Logger.error(`[Server] Non-admin user sent the message_all_users event`)
        }
      })
      socket.on('ping', () => {
        const client = this.clients[socket.id] || {}
        const user = client.user || {}
        Logger.debug(`[Server] Received ping from socket ${user.username || 'No User'}`)
        socket.emit('pong')
      })

      // Sent automatically from socket.io clients
      socket.on('disconnect', (reason) => {
        Logger.removeSocketListener(socket.id)

        const _client = this.clients[socket.id]
        if (!_client) {
          Logger.warn(`[Server] Socket ${socket.id} disconnect, no client (Reason: ${reason})`)
        } else if (!_client.user) {
          Logger.info(`[Server] Unauth socket ${socket.id} disconnected (Reason: ${reason})`)
          delete this.clients[socket.id]
        } else {
          Logger.debug('[Server] User Offline ' + _client.user.username)
          this.io.emit('user_offline', _client.user.toJSONForPublic(this.Server.playbackSessionManager.sessions, this.Server.db.libraryItems))

          const disconnectTime = Date.now() - _client.connected_at
          Logger.info(`[Server] Socket ${socket.id} disconnected from client "${_client.user.username}" after ${disconnectTime}ms (Reason: ${reason})`)
          delete this.clients[socket.id]
        }
      })
    })
  }

  // When setting up a socket connection the user needs to be associated with a socket id
  //  for this the client will send a 'auth' event that includes the users API token
  async authenticateSocket(socket, token) {
    const user = await this.Server.auth.authenticateUser(token)
    if (!user) {
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('invalid_token')
    }
    const client = this.clients[socket.id]

    if (client.user !== undefined) {
      Logger.debug(`[Server] Authenticating socket client already has user`, client.user.username)
    }

    client.user = user

    if (!client.user.toJSONForBrowser) {
      Logger.error('Invalid user...', client.user)
      return
    }

    Logger.debug(`[Server] User Online ${client.user.username}`)

    // TODO: Send to authenticated clients only
    this.io.emit('user_online', client.user.toJSONForPublic(this.Server.playbackSessionManager.sessions, this.Server.db.libraryItems))

    user.lastSeen = Date.now()
    await this.Server.db.updateEntity('user', user)

    const initialPayload = {
      userId: client.user.id,
      username: client.user.username,
      librariesScanning: this.Server.scanner.librariesScanning
    }
    if (user.isAdminOrUp) {
      initialPayload.usersOnline = this.getUsersOnline()
    }

    client.socket.emit('init', initialPayload)
  }

  logout(socketId) {
    // Strip user and client from client and client socket
    if (socketId && this.clients[socketId]) {
      var client = this.clients[socketId]
      var clientSocket = client.socket
      Logger.debug(`[Server] Found user client ${clientSocket.id}, Has user: ${!!client.user}, Socket has client: ${!!clientSocket.sheepClient}`)

      if (client.user) {
        Logger.debug('[Server] User Offline ' + client.user.username)
        this.io.emit('user_offline', client.user.toJSONForPublic(null, this.Server.db.libraryItems))
      }

      delete this.clients[socketId].user
      if (clientSocket && clientSocket.sheepClient) delete this.clients[socketId].socket.sheepClient
    } else if (socketId) {
      Logger.warn(`[Server] No client for socket ${socketId}`)
    }
  }

  cancelScan(id) {
    Logger.debug('[Server] Cancel scan', id)
    this.Server.scanner.setCancelLibraryScan(id)
  }
}
module.exports = new SocketAuthority()