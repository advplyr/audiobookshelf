import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ApiError } from '../api/client'
import { Button, Field, Input } from '../components/ui'

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
        <Field label="Username">
          {(a11y) => <Input {...a11y} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />}
        </Field>
        <Field label="Password" error={error}>
          {(a11y) => <Input {...a11y} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
        </Field>
        <Button variant="primary" type="submit" className="w-full" loading={busy} disabled={!username}>
          Sign in
        </Button>
      </form>
    </div>
  )
}
