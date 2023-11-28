const SocketIO = require('socket.io')
const Logger = require('./Logger')
const Database = require('./Database')
const Auth = require('./Auth')

class SocketAuthority {
  constructor() {
    this.Server = null
    this.io = null

    this.clients = {}
  }

  /**
   * returns an array of User.toJSONForPublic with `connections` for the # of socket connections
   *  a user can have many socket connections
   * @returns {object[]}
   */
  getUsersOnline() {
    const onlineUsersMap = {}
    Object.values(this.clients).filter(c => c.user).forEach(client => {
      if (onlineUsersMap[client.user.id]) {
        onlineUsersMap[client.user.id].connections++
      } else {
        onlineUsersMap[client.user.id] = {
          ...client.user.toJSONForPublic(this.Server.playbackSessionManager.sessions),
          connections: 1
        }
      }
    })
    return Object.values(onlineUsersMap)
  }

  getClientsForUser(userId) {
    return Object.values(this.clients).filter(c => c.user && c.user.id === userId)
  }

  /**
   * Emits event to all authorized clients
   * @param {string} evt 
   * @param {any} data 
   * @param {Function} [filter] optional filter function to only send event to specific users
   */
  emitter(evt, data, filter = null) {
    for (const socketId in this.clients) {
      if (this.clients[socketId].user) {
        if (filter && !filter(this.clients[socketId].user)) continue

        this.clients[socketId].socket.emit(evt, data)
      }
    }
  }

  // Emits event to all clients for a specific user
  clientEmitter(userId, evt, data) {
    const clients = this.getClientsForUser(userId)
    if (!clients.length) {
      return Logger.debug(`[SocketAuthority] clientEmitter - no clients found for user ${userId}`)
    }
    clients.forEach((client) => {
      if (client.socket) {
        client.socket.emit(evt, data)
      }
    })
  }

  // Emits event to all admin user clients
  adminEmitter(evt, data) {
    for (const socketId in this.clients) {
      if (this.clients[socketId].user && this.clients[socketId].user.isAdminOrUp) {
        this.clients[socketId].socket.emit(evt, data)
      }
    }
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

      Logger.info('[SocketAuthority] Socket Connected', socket.id)

      // Required for associating a User with a socket
      socket.on('auth', (token) => this.authenticateSocket(socket, token))

      // Scanning
      socket.on('cancel_scan', (libraryId) => this.cancelScan(libraryId))

      // Logs
      socket.on('set_log_listener', (level) => Logger.addSocketListener(socket, level))
      socket.on('remove_log_listener', () => Logger.removeSocketListener(socket.id))
      socket.on('fetch_daily_logs', () => this.Server.logManager.socketRequestDailyLogs(socket))

      // Sent automatically from socket.io clients
      socket.on('disconnect', (reason) => {
        Logger.removeSocketListener(socket.id)

        const _client = this.clients[socket.id]
        if (!_client) {
          Logger.warn(`[SocketAuthority] Socket ${socket.id} disconnect, no client (Reason: ${reason})`)
        } else if (!_client.user) {
          Logger.info(`[SocketAuthority] Unauth socket ${socket.id} disconnected (Reason: ${reason})`)
          delete this.clients[socket.id]
        } else {
          Logger.debug('[SocketAuthority] User Offline ' + _client.user.username)
          this.adminEmitter('user_offline', _client.user.toJSONForPublic(this.Server.playbackSessionManager.sessions))

          const disconnectTime = Date.now() - _client.connected_at
          Logger.info(`[SocketAuthority] Socket ${socket.id} disconnected from client "${_client.user.username}" after ${disconnectTime}ms (Reason: ${reason})`)
          delete this.clients[socket.id]
        }
      })

      //
      // Events for testing
      //
      socket.on('message_all_users', (payload) => {
        // admin user can send a message to all authenticated users
        //   displays on the web app as a toast
        const client = this.clients[socket.id] || {}
        if (client.user && client.user.isAdminOrUp) {
          this.emitter('admin_message', payload.message || '')
        } else {
          Logger.error(`[SocketAuthority] Non-admin user sent the message_all_users event`)
        }
      })
      socket.on('ping', () => {
        const client = this.clients[socket.id] || {}
        const user = client.user || {}
        Logger.debug(`[SocketAuthority] Received ping from socket ${user.username || 'No User'}`)
        socket.emit('pong')
      })
    })
  }

  /**
   * When setting up a socket connection the user needs to be associated with a socket id
   * for this the client will send a 'auth' event that includes the users API token
   * 
   * @param {SocketIO.Socket} socket 
   * @param {string} token JWT
   */
  async authenticateSocket(socket, token) {
    // we don't use passport to authenticate the jwt we get over the socket connection.
    // it's easier to directly verify/decode it.
    const token_data = Auth.validateAccessToken(token)

    if (!token_data?.userId) {
      // Token invalid
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('invalid_token')
    }
    // get the user via the id from the decoded jwt.
    const user = await Database.userModel.getUserByIdOrOldId(token_data.userId)
    if (!user) {
      // user not found
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('invalid_token')
    }

    const client = this.clients[socket.id]
    if (!client) {
      Logger.error(`[SocketAuthority] Socket for user ${user.username} has no client`)
      return
    }

    if (client.user !== undefined) {
      Logger.debug(`[SocketAuthority] Authenticating socket client already has user`, client.user.username)
    }

    client.user = user

    if (!client.user.toJSONForBrowser) {
      Logger.error('Invalid user...', client.user)
      return
    }

    Logger.debug(`[SocketAuthority] User Online ${client.user.username}`)

    this.adminEmitter('user_online', client.user.toJSONForPublic(this.Server.playbackSessionManager.sessions))

    // Update user lastSeen without firing sequelize bulk update hooks
    user.lastSeen = Date.now()
    await Database.userModel.updateFromOld(user, false)

    const initialPayload = {
      userId: client.user.id,
      username: client.user.username
    }
    if (user.isAdminOrUp) {
      initialPayload.usersOnline = this.getUsersOnline()
    }
    client.socket.emit('init', initialPayload)
  }

  logout(socketId) {
    // Strip user and client from client and client socket
    if (socketId && this.clients[socketId]) {
      const client = this.clients[socketId]
      const clientSocket = client.socket
      Logger.debug(`[SocketAuthority] Found user client ${clientSocket.id}, Has user: ${!!client.user}, Socket has client: ${!!clientSocket.sheepClient}`)

      if (client.user) {
        Logger.debug('[SocketAuthority] User Offline ' + client.user.username)
        this.adminEmitter('user_offline', client.user.toJSONForPublic())
      }

      delete this.clients[socketId].user
      if (clientSocket && clientSocket.sheepClient) delete this.clients[socketId].socket.sheepClient
    } else if (socketId) {
      Logger.warn(`[SocketAuthority] No client for socket ${socketId}`)
    }
  }

  cancelScan(id) {
    Logger.debug('[SocketAuthority] Cancel scan', id)
    this.Server.cancelLibraryScan(id)
  }
}
module.exports = new SocketAuthority()