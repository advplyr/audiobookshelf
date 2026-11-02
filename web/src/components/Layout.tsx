import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ExternalLink, Library as LibraryIcon, LogOut } from 'lucide-react'
import { api, BASE } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import type { Library } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { SECTIONS } from '../sections'
import { ErrorBoundary, IconButton, cn } from './ui'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm', isActive ? 'bg-accent text-accent-fg' : 'hover:bg-surface-2')

/** Libraries this user can open; kept fresh by the socket bridge (library_* events). */
export function useLibraries() {
  const { permissions } = useAuth()
  return useQuery({
    queryKey: queryKeys.libraries(),
    queryFn: () => api<{ libraries: Library[] }>('/api/libraries').then((r) => r.libraries),
    select: (libs) => libs.filter((l) => permissions.canAccessLibrary(l.id))
  })
}

export function Layout() {
  const { user, permissions, logout } = useAuth()
  const { data: libraries } = useLibraries()
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav aria-label="Main" className="shrink-0 space-y-4 border-b border-border bg-surface p-4 md:w-56 md:border-r md:border-b-0">
        <div className="text-lg font-semibold">Audiobookshelf</div>
        <div className="space-y-1">
          <p className="px-3 text-xs uppercase tracking-wide text-muted">Libraries</p>
          {libraries?.map((lib) => (
            <NavLink key={lib.id} to={`/library/${lib.id}`} className={linkClass}>
              <LibraryIcon className="size-4" aria-hidden />
              {lib.name}
            </NavLink>
          ))}
          {libraries?.length === 0 && <p className="px-3 text-sm text-muted">No libraries yet</p>}
        </div>
        <div className="space-y-1">
          {SECTIONS.filter((s) => !s.adminOnly || permissions.isAdmin).map((s) => (
            <NavLink key={s.path} to={`/${s.path}`} className={linkClass}>
              {s.icon}
              {s.label}
            </NavLink>
          ))}
          {/* Admin stays in the stock UI until Milestone 5 */}
          {permissions.isAdmin && (
            <a href={`${BASE}/config`} className={linkClass({ isActive: false })}>
              <ExternalLink className="size-4" aria-hidden />
              Server settings
            </a>
          )}
        </div>
        <div className="flex items-center justify-between pl-3 text-sm text-muted">
          <span className="truncate">{user?.username}</span>
          <IconButton label="Log out" variant="ghost" size="sm" icon={<LogOut className="size-4" />} onClick={logout} />
        </div>
      </nav>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
