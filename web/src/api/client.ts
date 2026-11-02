/**
 * Thin fetch wrapper for the ABS server.
 * - Access token (1h JWT) lives in memory + localStorage and goes out as a Bearer header.
 * - On 401 we call /auth/refresh once (refresh token is an httpOnly cookie) and retry.
 * Server contracts: server/Auth.js (login/refresh), server/routers/ApiRouter.js.
 */
export const BASE = '/audiobookshelf'

const TOKEN_KEY = 'abs-ui.accessToken'
let accessToken: string | null = readToken()
const tokenListeners = new Set<(t: string | null) => void>()

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore storage failures
  }
  tokenListeners.forEach((fn) => fn(token))
}

/** Notified on login, refresh and logout (the socket re-auths on this). */
export function onTokenChange(fn: (t: string | null) => void) {
  tokenListeners.add(fn)
  return () => {
    tokenListeners.delete(fn)
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let refreshing: Promise<boolean> | null = null

async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (!res.ok) return false
      const data = await res.json()
      setAccessToken(data.user?.accessToken ?? null)
      return !!data.user?.accessToken
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export async function api<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' })

  if (res.status === 401 && retry && path !== '/login') {
    if (await refresh()) return api<T>(path, init, false)
    setAccessToken(null)
  }
  if (!res.ok) throw new ApiError(res.status, (await res.text()) || res.statusText)

  const type = res.headers.get('content-type') ?? ''
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>
}

/** Covers are public (no auth); ts busts the 24h cache when the item changes. */
export function coverUrl(itemId: string, updatedAt?: number, width = 400) {
  const params = new URLSearchParams({ width: String(width), format: 'webp' })
  if (updatedAt) params.set('ts', String(updatedAt))
  return `${BASE}/api/items/${itemId}/cover?${params}`
}
