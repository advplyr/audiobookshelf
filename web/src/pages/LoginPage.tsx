import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ApiError } from '../api/client'

export function LoginPage() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Invalid username or password' : 'Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Username</span>
          <input
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Password</span>
          <input
            type="password"
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 outline-none focus:border-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={busy || !username} className="w-full rounded-md bg-accent py-2 font-medium text-accent-fg disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
