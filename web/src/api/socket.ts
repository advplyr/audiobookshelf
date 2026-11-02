import { io, type Socket } from 'socket.io-client'
import { BASE, getAccessToken, onTokenChange } from './client'

/**
 * One shared socket. The server expects an 'auth' emit with the access token after
 * connecting (and again after every token refresh); it answers 'init' or 'auth_failed'.
 * See server/SocketAuthority.js.
 */
let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket
  socket = io({ path: `${BASE}/socket.io`, transports: ['websocket'], autoConnect: false })

  socket.on('connect', () => {
    const token = getAccessToken()
    if (token) socket!.emit('auth', token)
  })

  onTokenChange((token) => {
    if (!socket) return
    if (!token) socket.disconnect()
    else if (socket.connected) socket.emit('auth', token)
    else socket.connect()
  })

  if (getAccessToken()) socket.connect()
  return socket
}
