import type { Server as HttpServer } from 'http'
import { Server as SocketIoServer } from 'socket.io'

import Logger from './Logger'
import Database from './Database'
import TokenManager from './auth/TokenManager'
import coverSearchManagerJs from './managers/CoverSearchManager'
import { LogLevel } from './utils/constants'
import type User from './models/User'
import type LibraryItem from './models/LibraryItem'

type PlaybackSessions = Parameters<User['toJSONForPublic']>[0]
type PublicUser = ReturnType<User['toJSONForPublic']>
type AccessibleLibraryItem = Parameters<User['checkCanAccessLibraryItem']>[0] & {
  toOldJSONExpanded(): ReturnType<LibraryItem['toOldJSONExpanded']>
}

type AbsServer = {
  server: HttpServer
  playbackSessionManager: { sessions: PlaybackSessions }
  cancelLibraryScan(libraryId: unknown): void
}

type SocketClient = {
  id: string
  socket: ClientSocket
  connected_at: number
  user?: User
}

type ClientSocket = {
  id: string
  sheepClient?: SocketClient
  emit(event: string, data?: unknown): void
  on(event: string, listener: (payload: unknown) => void): void
}

type IoServer = {
  path: string
  close(callback: () => void): void
  on(event: 'connection', listener: (socket: ClientSocket) => void): void
}

type CoverSearchResult = {
  provider: unknown
  covers: unknown
  total: unknown
}

type CoverSearchManagerApi = {
  startSearch(
    requestId: unknown,
    searchParams: { title: unknown; author: unknown; provider: unknown; podcast: unknown },
    onResult: (result: CoverSearchResult) => void,
    onComplete: () => void,
    onError: (provider: unknown, errorMessage: unknown) => void
  ): Promise<unknown>
  cancelSearch(requestId: unknown): boolean
}

const CoverSearchManager = coverSearchManagerJs as CoverSearchManagerApi

function templateValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || value == null) {
    return String(value)
  }
  if (typeof value === 'symbol') {
    return String(value)
  }
  if (typeof value === 'object') {
    const toString = (value as { toString?: unknown }).toString
    if (typeof toString === 'function') {
      const converted: unknown = toString.call(value)
      if (typeof converted === 'string' || typeof converted === 'number' || typeof converted === 'boolean' || typeof converted === 'bigint' || converted == null) {
        return String(converted)
      }
    }
  }
  return Object.prototype.toString.call(value)
}

class SocketAuthority {
  declare Server: AbsServer | null
  declare socketIoServers: IoServer[]
  declare clients: Record<string, SocketClient>

  constructor() {
    this.Server = null
    this.socketIoServers = []
    this.clients = {}
  }

  /**
   * returns an array of User.toJSONForPublic with `connections` for the # of socket connections
   *  a user can have many socket connections
   */
  getUsersOnline() {
    const onlineUsersMap: Record<string, PublicUser & { connections: number }> = {}
    Object.values(this.clients)
      .filter((client): client is SocketClient & { user: User } => !!client.user)
      .forEach((client) => {
        const existing = onlineUsersMap[client.user.id]
        if (existing) {
          existing.connections++
        } else {
          onlineUsersMap[client.user.id] = {
            ...client.user.toJSONForPublic(this.Server!.playbackSessionManager.sessions),
            connections: 1
          }
        }
      })
    return Object.values(onlineUsersMap)
  }

  getClientsForUser(userId: string | null) {
    return Object.values(this.clients).filter((client) => client.user?.id === userId)
  }

  /**
   * Emits event to all authorized clients
   */
  emitter(evt: string, data: unknown, filter: ((user: User) => boolean) | null = null) {
    for (const socketId in this.clients) {
      const client = this.clients[socketId]
      if (client.user) {
        if (filter && !filter(client.user)) continue

        client.socket.emit(evt, data)
      }
    }
  }

  // Emits event to all clients for a specific user
  clientEmitter(userId: string | null, evt: string, data: unknown) {
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
  adminEmitter(evt: string, data: unknown) {
    for (const socketId in this.clients) {
      const client = this.clients[socketId]
      if (client.user?.isAdminOrUp) {
        client.socket.emit(evt, data)
      }
    }
  }

  requireAdminSocket(socket: ClientSocket, eventName: string) {
    const client = this.clients[socket.id]
    if (client?.user?.isAdminOrUp) return true

    Logger.warn(`[SocketAuthority] Unauthorized ${eventName} socket event from socket ${socket.id}`)
    return false
  }

  /**
   * Emits event with library item to all clients that can access the library item
   * Note: Emits toOldJSONExpanded()
   */
  libraryItemEmitter(evt: string, libraryItem: AccessibleLibraryItem) {
    for (const socketId in this.clients) {
      const client = this.clients[socketId]
      if (client.user?.checkCanAccessLibraryItem(libraryItem)) {
        client.socket.emit(evt, libraryItem.toOldJSONExpanded())
      }
    }
  }

  /**
   * Emits event with library items to all clients that can access the library items
   * Note: Emits toOldJSONExpanded()
   */
  libraryItemsEmitter(evt: string, libraryItems: AccessibleLibraryItem[]) {
    for (const socketId in this.clients) {
      const client = this.clients[socketId]
      if (client.user) {
        const user = client.user
        const libraryItemsAccessibleToUser = libraryItems.filter((libraryItem) => user.checkCanAccessLibraryItem(libraryItem))
        if (libraryItemsAccessibleToUser.length) {
          client.socket.emit(
            evt,
            libraryItemsAccessibleToUser.map((libraryItem) => libraryItem.toOldJSONExpanded())
          )
        }
      }
    }
  }

  /**
   * Closes the Socket.IO server and disconnect all clients
   */
  async close() {
    Logger.info('[SocketAuthority] closing...')
    const closePromises = this.socketIoServers.map((io) => {
      return new Promise<void>((resolve) => {
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

  initialize(server: object) {
    const absServer = server as AbsServer
    this.Server = absServer

    const socketIoOptions = {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    }

    const ioServer = new SocketIoServer(absServer.server, socketIoOptions) as unknown as IoServer
    ioServer.path = '/socket.io'
    this.socketIoServers.push(ioServer)

    if (global.RouterBasePath) {
      // open a separate socket.io server for the router base path, keeping the original server open for legacy clients
      const ioBasePath = `${global.RouterBasePath}/socket.io`
      const ioBasePathServer = new SocketIoServer(absServer.server, { ...socketIoOptions, path: ioBasePath }) as unknown as IoServer
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
        socket.on('auth', (token) => {
          void this.authenticateSocket(socket, token)
        })

        // Scanning
        socket.on('cancel_scan', (libraryId) => {
          if (!this.requireAdminSocket(socket, 'cancel_scan')) return
          this.cancelScan(libraryId)
        })

        // Cover search streaming
        socket.on('search_covers', (payload) => {
          void this.handleCoverSearch(socket, payload)
        })
        socket.on('cancel_cover_search', (requestId) => this.handleCancelCoverSearch(socket, requestId))

        // Logs
        socket.on('set_log_listener', (level) => {
          if (!this.requireAdminSocket(socket, 'set_log_listener')) return

          if (!Number.isInteger(level) || !Object.values(LogLevel).includes(level as number)) {
            Logger.warn(`[SocketAuthority] Invalid set_log_listener level from socket ${socket.id}`)
            return
          }
          Logger.addSocketListener(socket, level as number)
        })
        socket.on('remove_log_listener', () => Logger.removeSocketListener(socket.id))

        // Sent automatically from socket.io clients
        socket.on('disconnect', (reason) => {
          Logger.removeSocketListener(socket.id)

          const _client = this.clients[socket.id]
          if (!_client) {
            Logger.warn(`[SocketAuthority] Socket ${socket.id} disconnect, no client (Reason: ${templateValue(reason)})`)
          } else if (!_client.user) {
            Logger.info(`[SocketAuthority] Unauth socket ${socket.id} disconnected (Reason: ${templateValue(reason)})`)
            delete this.clients[socket.id]
          } else {
            Logger.debug('[SocketAuthority] User Offline ' + _client.user.username)
            this.adminEmitter('user_offline', _client.user.toJSONForPublic(this.Server!.playbackSessionManager.sessions))

            const disconnectTime = Date.now() - _client.connected_at
            Logger.info(`[SocketAuthority] Socket ${socket.id} disconnected from client "${_client.user.username}" after ${disconnectTime}ms (Reason: ${templateValue(reason)})`)

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
          const client = this.clients[socket.id]
          if (client?.user?.isAdminOrUp) {
            this.emitter('admin_message', (payload as { message?: unknown }).message || '')
          } else {
            Logger.error(`[SocketAuthority] Non-admin user sent the message_all_users event`)
          }
        })
        socket.on('ping', () => {
          const client = this.clients[socket.id]
          const username = client?.user?.username || 'No User'
          Logger.debug(`[SocketAuthority] Received ping from socket ${username}`)
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
   */
  async authenticateSocket(socket: ClientSocket, token: unknown) {
    // we don't use passport to authenticate the jwt we get over the socket connection.
    // it's easier to directly verify/decode it.
    const token_data = TokenManager.validateAccessToken(token as string)

    if (!token_data) {
      // Token invalid
      Logger.error('Cannot validate socket - invalid token')
      return socket.emit('auth_failed', { message: 'Invalid token' })
    }

    let user: User | null = null

    if (token_data.type === 'api') {
      // Api key based authentication
      const apiKey = await Database.apiKeyModel.getById(token_data.keyId as string)

      if (!apiKey?.isActive) {
        Logger.error('Cannot validate socket - API key not found or inactive')
        return socket.emit('auth_failed', { message: 'Invalid API key' })
      }

      if (token_data.exp && token_data.exp < Date.now() / 1000) {
        apiKey.isActive = false
        await apiKey.save()
        Logger.info(`[SocketAuthority] API key ${apiKey.id} is expired - deactivated`)
        return socket.emit('auth_failed', { message: 'API key expired' })
      }

      user = await Database.userModel.getUserById(apiKey.userId)
      if (!user) {
        Logger.error('Cannot validate socket - user not found for API key')
        return socket.emit('auth_failed', { message: 'Invalid API key' })
      }
    } else {
      // JWT based authentication
      if (!TokenManager.isBearerAccessTokenPayload(token_data)) {
        Logger.error('Cannot validate socket - invalid token')
        return socket.emit('auth_failed', { message: 'Invalid token' })
      }

      if (token_data.exp && token_data.exp < Date.now() / 1000) {
        Logger.error('Cannot validate socket - token expired')
        return socket.emit('auth_failed', { message: 'Token expired' })
      }

      // get the user via the id from the decoded jwt.
      user = await Database.userModel.getUserByIdOrOldId(token_data.userId)
      if (!user) {
        // user not found
        Logger.error('Cannot validate socket - invalid token')
        return socket.emit('auth_failed', { message: 'Invalid token' })
      }
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
    this.adminEmitter('user_online', client.user.toJSONForPublic(this.Server!.playbackSessionManager.sessions))

    // Update user lastSeen without firing sequelize bulk update hooks
    user.lastSeen = Date.now() as unknown as Date
    await user.save({ hooks: false })

    const initialPayload: { userId: string; username: string | null; usersOnline?: ReturnType<SocketAuthority['getUsersOnline']> } = {
      userId: client.user.id,
      username: client.user.username
    }
    if (user.isAdminOrUp) {
      initialPayload.usersOnline = this.getUsersOnline()
    }
    client.socket.emit('init', initialPayload)
  }

  cancelScan(id: unknown) {
    Logger.debug('[SocketAuthority] Cancel scan', id)
    this.Server!.cancelLibraryScan(id)
  }

  /**
   * Handle cover search request via WebSocket
   */
  async handleCoverSearch(socket: ClientSocket, payload: unknown) {
    const client = this.clients[socket.id]
    const searchPayload = payload as { requestId?: unknown; title?: unknown; author?: unknown; provider?: unknown; podcast?: unknown }
    if (!client?.user) {
      Logger.error('[SocketAuthority] Unauthorized cover search request')
      socket.emit('cover_search_error', {
        requestId: searchPayload.requestId,
        error: 'Unauthorized'
      })
      return
    }

    const { requestId, title, author, provider, podcast } = searchPayload

    if (!requestId || !title) {
      Logger.error('[SocketAuthority] Invalid cover search request')
      socket.emit('cover_search_error', {
        requestId,
        error: 'Invalid request parameters'
      })
      return
    }

    Logger.info(`[SocketAuthority] User ${client.user.username} initiated cover search ${templateValue(requestId)}`)

    // Callback for streaming results to client
    const onResult = (result: CoverSearchResult) => {
      socket.emit('cover_search_result', {
        requestId,
        provider: result.provider,
        covers: result.covers,
        total: result.total
      })
    }

    // Callback when search completes
    const onComplete = () => {
      Logger.info(`[SocketAuthority] Cover search ${templateValue(requestId)} completed`)
      socket.emit('cover_search_complete', { requestId })
    }

    // Callback for provider errors
    const onError = (provider: unknown, errorMessage: unknown) => {
      socket.emit('cover_search_provider_error', {
        requestId,
        provider,
        error: errorMessage
      })
    }

    // Start the search
    await CoverSearchManager.startSearch(requestId, { title, author, provider, podcast }, onResult, onComplete, onError).catch((error: unknown) => {
      Logger.error(`[SocketAuthority] Cover search ${templateValue(requestId)} failed:`, error)
      const failure = error as { message?: unknown }
      socket.emit('cover_search_error', {
        requestId,
        error: failure.message
      })
    })
  }

  /**
   * Handle cancel cover search request
   */
  handleCancelCoverSearch(socket: ClientSocket, requestId: unknown) {
    const client = this.clients[socket.id]
    if (!client?.user) {
      Logger.error('[SocketAuthority] Unauthorized cancel cover search request')
      return
    }

    Logger.info(`[SocketAuthority] User ${client.user.username} cancelled cover search ${templateValue(requestId)}`)

    const cancelled = CoverSearchManager.cancelSearch(requestId)
    if (cancelled) {
      socket.emit('cover_search_cancelled', { requestId })
    }
  }

  /**
   * Cancel all cover searches associated with a socket (called on disconnect)
   */
  cancelSocketCoverSearches(socketId: string) {
    // Get all active search request IDs and cancel those that might belong to this socket
    // Since we don't track socket-to-request mapping, we log this for debugging
    // The client will handle reconnection gracefully
    Logger.debug(`[SocketAuthority] Socket ${socketId} disconnected, any active searches will timeout`)
  }
}
export = new SocketAuthority()
