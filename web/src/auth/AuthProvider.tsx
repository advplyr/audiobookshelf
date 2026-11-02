import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getAccessToken, onTokenChange, setAccessToken } from '../api/client'
import type { LoginResponse, User } from '../api/types'

interface AuthContextValue {
  user: User | null
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

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, defaultLibraryId: session?.userDefaultLibraryId ?? null, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
