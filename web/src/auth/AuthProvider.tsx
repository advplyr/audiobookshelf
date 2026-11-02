import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getAccessToken, onTokenChange, setAccessToken } from '../api/client'
import { useSocketBridge } from '../api/socketBridge'
import type { LoginResponse, User } from '../api/types'
import { getPermissions, type Permissions } from './permissions'

interface AuthContextValue {
  user: User | null
  permissions: Permissions
  defaultLibraryId: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore: /api/authorize returns the login payload for a valid token (no new token).
  // An expired token triggers the client's refresh-and-retry automatically.
  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false)
      return
    }
    api<LoginResponse>('/api/authorize', { method: 'POST' })
      .then(setSession)
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false))
  }, [])

  // Refresh failure anywhere in the app logs the user out.
  useEffect(() => onTokenChange((t) => !t && setSession(null)), [])

  // The server pushes user_updated when an admin changes this user's permissions or access.
  const updateUser = useCallback((user: User) => setSession((s) => (s ? { ...s, user: { ...s.user, ...user } } : s)), [])
  useSocketBridge(session?.user.id, updateUser)

  const login = useCallback(async (username: string, password: string) => {
    const data = await api<LoginResponse>('/login', { method: 'POST', body: JSON.stringify({ username, password }) })
    setAccessToken(data.user.accessToken ?? null)
    setSession(data)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/logout', { method: 'POST' })
    } finally {
      setAccessToken(null)
      setSession(null)
    }
  }, [])

  const user = session?.user ?? null
  const value = useMemo(
    () => ({
      user,
      permissions: getPermissions(user),
      defaultLibraryId: session?.userDefaultLibraryId ?? null,
      loading,
      login,
      logout
    }),
    [user, session?.userDefaultLibraryId, loading, login, logout]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
