import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { getSocket } from '../api/socket'
import type { Library } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { SECTIONS } from '../sections'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-accent text-accent-fg' : 'hover:bg-surface-2'}`

export function useLibraries() {
  const qc = useQueryClient()
  useEffect(() => {
    const socket = getSocket()
    const onChange = () => qc.invalidateQueries({ queryKey: ['libraries'] })
    const events = ['library_added', 'library_updated', 'library_removed']
    events.forEach((e) => socket.on(e, onChange))
    return () => events.forEach((e) => socket.off(e, onChange))
  }, [qc])

  return useQuery({
    queryKey: ['libraries'],
    queryFn: () => api<{ libraries: Library[] }>('/api/libraries').then((r) => r.libraries)
  })
}

export function Layout() {
  const { user, logout } = useAuth()
  const { data: libraries } = useLibraries()

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="shrink-0 space-y-4 border-b border-border bg-surface p-4 md:w-56 md:border-r md:border-b-0">
        <div className="text-lg font-semibold">Audiobookshelf</div>
        <div className="space-y-1">
          <p className="px-3 text-xs uppercase tracking-wide text-muted">Libraries</p>
          {libraries?.map((lib) => (
            <NavLink key={lib.id} to={`/library/${lib.id}`} className={linkClass}>
              {lib.name}
            </NavLink>
          ))}
          {libraries?.length === 0 && <p className="px-3 text-sm text-muted">No libraries yet</p>}
        </div>
        <div className="space-y-1">
          {SECTIONS.map((s) => (
            <NavLink key={s.path} to={`/${s.path}`} className={linkClass}>
              {s.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 text-sm text-muted">
          <span>{user?.username}</span>
          <button className="hover:text-fg" onClick={logout}>
            Log out
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
