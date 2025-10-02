const SocketIO = require('socket.io')
const Logger = require('./Logger')
const Database = require('./Database')
const TokenManager = require('./auth/TokenManager')
const CoverSearchManager = require('./managers/CoverSearchManager')

/**
 * @typedef SocketClient
 * @property {string} id socket id
 * @property {SocketIO.Socket} socket
 * @property {number} connected_at
 * @property {import('./models/User')} user
 */

class SocketAuthority {
  constructor() {
    this.Server = null
    this.socketIoServers = []

    /** @type {Object.<string, SocketClient>} */
    this.clients = {}
  }

  /**
   * returns an array of User.toJSONForPublic with `connections` for the # of socket connections
   *  a user can have many socket connections
   * @returns {object[]}
   */
  getUsersOnline() {
    const onlineUsersMap = {}
    Object.values(this.clients)
      .filter((c) => c.user)
      .forEach((client) => {
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
    return Object.values(this.clients).filter((c) => c.user?.id === userId)
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
      if (this.clients[socketId].user?.isAdminOrUp) {
        this.clients[socketId].socket.emit(evt, data)
      }
    }
  }

  /**
   * Emits event with library item to all clients that can access the library item
   * Note: Emits toOldJSONExpanded()
   *
   * @param {string} evt
   * @param {import('./models/LibraryItem')} libraryItem
   */
  libraryItemEmitter(evt, libraryItem) {
    for (const socketId in this.clients) {
      if (this.clients[socketId].user?.checkCanAccessLibraryItem(libraryItem)) {
        this.clients[socketId].socket.emit(evt, libraryItem.toOldJSONExpanded())
      }
    }
  }

  /**
   * Emits event with library items to all clients that can access the library items
   * Note: Emits toOldJSONExpanded()
   *
   * @param {string} evt
   * @param {import('./models/LibraryItem')[]} libraryItems
   */
  libraryItemsEmitter(evt, libraryItems) {
    for (const socketId in this.clients) {
      if (this.clients[socketId].user) {
        const libraryItemsAccessibleToUser = libraryItems.filter((li) => this.clients[socketId].user.checkCanAccessLibraryItem(li))
        if (libraryItemsAccessibleToUser.length) {
          this.clients[socketId].socket.emit(
            evt,
            libraryItemsAccessibleToUser.map((li) => li.toOldJSONExpanded())
          )
        }
      }
    }
  }

  /**
   * Closes the Socket.IO server and disconnect all clients
   *
   * @param {Function} callback
   */
  async close() {
    Logger.info('[SocketAuthority] closing...')
    const closePromises = this.socketIoServers.map((io) => {
      return new Promise((resolve) => {
        Logger.info(`[SocketAuthority] Closing Socket.IO server: ${io.path}`)
        io.close(() => {
          Logger.info(`[SocketAuthority] Socket.IO server closed: ${io.path}`)
          resolve()
        })
      })
    })
    await Promise.all(closePromises)
    Logger.info('[SocketAuthority] closed')
    this.socketIoServers = []
  }

  initialize(Server) {
    this.Server = Server

    const socketIoOptions = {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    }

    const ioServer = new SocketIO.Server(Server.server, socketIoOptions)
    ioServer.path = '/socket.io'
    this.socketIoServers.push(ioServer)

    if (global.RouterBasePath) {
      // open a separate socket.io server for the router base path, keeping the original server open for legacy clients
      const ioBasePath = `${global.RouterBasePath}/socket.io`
      const ioBasePathServer = new SocketIO.Server(Server.server, { ...socketIoOptions, path: ioBasePath })
      ioBasePathServer.path = ioBasePath
      this.socketIoServers.push(ioBasePathServer)
    }

    this.socketIoServers.forEach((io) => {
      io.on('connection', (socket) => {
        this.clients[socket.id] = {
          id: socket.id,
          socket,
          connected_at: Date.now()
        }
        socket.sheepClient = this.clients[socket.id]

        Logger.info(`[SocketAuthority] Socket Connected to ${io.path}`, socket.id)

        // Required for associating a User with a socket
        socket.on('auth', (token) => this.authenticateSocket(socket, token))

        // Scanning
        socket.on('cancel_scan', (libraryId) => this.cancelScan(libraryId))

        // Cover search streaming
        socket.on('search_covers', (payload) => this.handleCoverSearch(socket, payload))
        socket.on('cancel_cover_search', (requestId) => this.handleCancelCoverSearch(socket, requestId))

        // Logs
        socket.on('set_log_listener', (level) => Logger.addSocketListener(socket, level))
        socket.on('remove_log_listener', () => Logger.removeSocketListener(socket.id))

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

            // Cancel any active cover searches for this socket
            this.cancelSocketCoverSearches(socket.id)

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
          if (client.user?.isAdminOrUp) {
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
    })
  }

  /**
   * When setting up a socket connection the user needs to be associated with a socket id
   * for this the client will send a 'auth' event that includes the users API token
   *
   * Sends event 'init' to the socket. For admins this contains an array of users online.
   * For failed authentication it sends event 'auth_failed' with a message
   *
   * @param {SocketIO.Socket} socket
   * @param {string} token JWT
   */
  async authenticateSocket(socket, token) {
    // we don't use passport to authenticate the jwt we get over the socket connection.
    // it's easier to directly verify/decode it.
    // TODO: Support API keys for web socket connections
    const token_data = TokenManager.validateAccessToken(token)

    if (!token_data?.userId) {
      // Token invalid
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('auth_failed', { message: 'Invalid token' })
    }

    // get the user via the id from the decoded jwt.
    const user = await Database.userModel.getUserByIdOrOldId(token_data.userId)
    if (!user) {
      // user not found
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('auth_failed', { message: 'Invalid token' })
    }
    if (!user.isActive) {
      Logger.error('Cannot validate socket - user is not active')
      return socket.emit('auth_failed', { message: 'Invalid user' })
    }

    const client = this.clients[socket.id]
    if (!client) {
      Logger.error(`[SocketAuthority] Socket for user ${user.username} has no client`)
      return
    }

    if (client.user !== undefined) {
      if (client.user.id === user.id) {
        // Allow re-authentication of a socket to the same user
        Logger.info(`[SocketAuthority] Authenticating socket already associated to user "${client.user.username}"`)
      } else {
        // Allow re-authentication of a socket to a different user but shouldn't happen
        Logger.warn(`[SocketAuthority] Authenticating socket to user "${user.username}", but is already associated with a different user "${client.user.username}"`)
      }
    } else {
      Logger.debug(`[SocketAuthority] Authenticating socket to user "${user.username}"`)
    }

    client.user = user
    this.adminEmitter('user_online', client.user.toJSONForPublic(this.Server.playbackSessionManager.sessions))

    // Update user lastSeen without firing sequelize bulk update hooks
    user.lastSeen = Date.now()
    await user.save({ hooks: false })

    const initialPayload = {
      userId: client.user.id,
      username: client.user.username
    }
    if (user.isAdminOrUp) {
      initialPayload.usersOnline = this.getUsersOnline()
    }
    client.socket.emit('init', initialPayload)
  }

  cancelScan(id) {
    Logger.debug('[SocketAuthority] Cancel scan', id)
    this.Server.cancelLibraryScan(id)
  }

  /**
   * Handle cover search request via WebSocket
   * @param {SocketIO.Socket} socket
   * @param {Object} payload
   */
  async handleCoverSearch(socket, payload) {
    const client = this.clients[socket.id]
    if (!client?.user) {
      Logger.error('[SocketAuthority] Unauthorized cover search request')
      socket.emit('cover_search_error', {
        requestId: payload.requestId,
        error: 'Unauthorized'
      })
      return
    }

    const { requestId, title, author, provider, podcast } = payload

    if (!requestId || !title) {
      Logger.error('[SocketAuthority] Invalid cover search request')
      socket.emit('cover_search_error', {
        requestId,
        error: 'Invalid request parameters'
      })
      return
    }

    Logger.info(`[SocketAuthority] User ${client.user.username} initiated cover search ${requestId}`)

    // Callback for streaming results to client
    const onResult = (result) => {
      socket.emit('cover_search_result', {
        requestId,
        provider: result.provider,
        covers: result.covers,
        total: result.total
      })
    }

    // Callback when search completes
    const onComplete = () => {
      Logger.info(`[SocketAuthority] Cover search ${requestId} completed`)
      socket.emit('cover_search_complete', { requestId })
    }

    // Callback for provider errors
    const onError = (provider, errorMessage) => {
      socket.emit('cover_search_provider_error', {
        requestId,
        provider,
        error: errorMessage
      })
    }

    // Start the search
    CoverSearchManager.startSearch(requestId, { title, author, provider, podcast }, onResult, onComplete, onError).catch((error) => {
      Logger.error(`[SocketAuthority] Cover search ${requestId} failed:`, error)
      socket.emit('cover_search_error', {
        requestId,
        error: error.message
      })
    })
  }

  /**
   * Handle cancel cover search request
   * @param {SocketIO.Socket} socket
   * @param {string} requestId
   */
  handleCancelCoverSearch(socket, requestId) {
    const client = this.clients[socket.id]
    if (!client?.user) {
      Logger.error('[SocketAuthority] Unauthorized cancel cover search request')
      return
    }

    Logger.info(`[SocketAuthority] User ${client.user.username} cancelled cover search ${requestId}`)

    const cancelled = CoverSearchManager.cancelSearch(requestId)
    if (cancelled) {
      socket.emit('cover_search_cancelled', { requestId })
    }
  }

  /**
   * Cancel all cover searches associated with a socket (called on disconnect)
   * @param {string} socketId
   */
  cancelSocketCoverSearches(socketId) {
    // Get all active search request IDs and cancel those that might belong to this socket
    // Since we don't track socket-to-request mapping, we log this for debugging
    // The client will handle reconnection gracefully
    Logger.debug(`[SocketAuthority] Socket ${socketId} disconnected, any active searches will timeout`)
  }
}
module.exports = new SocketAuthority()
