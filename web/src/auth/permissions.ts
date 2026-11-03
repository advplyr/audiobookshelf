import type { User } from '../api/types'

export interface Permissions {
  isRoot: boolean
  isAdmin: boolean
  canDownload: boolean
  canUpdate: boolean
  canDelete: boolean
  canUpload: boolean
  canAccessLibrary: (libraryId: string) => boolean
}

const NONE: Permissions = {
  isRoot: false,
  isAdmin: false,
  canDownload: false,
  canUpdate: false,
  canDelete: false,
  canUpload: false,
  canAccessLibrary: () => false
}

/**
 * Mirrors the server's checks (server/models/User.js getters) so the UI hides actions the
 * server would refuse. The server still enforces them; this is only for display.
 */
export function getPermissions(user: User | null): Permissions {
  if (!user) return NONE
  const active = user.isActive !== false
  const p = user.permissions ?? {}
  const isRoot = user.type === 'root'
  return {
    isRoot,
    isAdmin: isRoot || user.type === 'admin',
    canDownload: active && !!p.download,
    canUpdate: active && !!p.update,
    canDelete: active && !!p.delete,
    canUpload: active && !!p.upload,
    canAccessLibrary: (id) => !!p.accessAllLibraries || (user.librariesAccessible ?? []).includes(id)
  }
}
