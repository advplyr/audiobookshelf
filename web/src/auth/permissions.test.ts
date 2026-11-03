import { describe, expect, it } from 'vitest'
import { getPermissions } from './permissions'
import type { User } from '../api/types'

const user = (over: Partial<User> = {}): User => ({
  id: 'u1',
  username: 'tester',
  type: 'user',
  isActive: true,
  permissions: {},
  librariesAccessible: [],
  itemTagsSelected: [],
  ...over
})

describe('getPermissions', () => {
  it('denies everything when signed out', () => {
    const p = getPermissions(null)
    expect(p.isAdmin).toBe(false)
    expect(p.canDownload).toBe(false)
    expect(p.canAccessLibrary('lib1')).toBe(false)
  })

  it('treats root and admin as admins, plain users not', () => {
    expect(getPermissions(user({ type: 'root' })).isAdmin).toBe(true)
    expect(getPermissions(user({ type: 'root' })).isRoot).toBe(true)
    expect(getPermissions(user({ type: 'admin' })).isAdmin).toBe(true)
    expect(getPermissions(user({ type: 'admin' })).isRoot).toBe(false)
    expect(getPermissions(user()).isAdmin).toBe(false)
  })

  it('follows the permission flags, and an inactive user gets none (like the server)', () => {
    const flags = { download: true, update: true, delete: false, upload: true }
    expect(getPermissions(user({ permissions: flags }))).toMatchObject({ canDownload: true, canUpdate: true, canDelete: false, canUpload: true })
    expect(getPermissions(user({ permissions: flags, isActive: false }))).toMatchObject({ canDownload: false, canUpdate: false, canUpload: false })
  })

  it('limits libraries to the allowed list unless all libraries are allowed', () => {
    const limited = getPermissions(user({ librariesAccessible: ['lib1'] }))
    expect(limited.canAccessLibrary('lib1')).toBe(true)
    expect(limited.canAccessLibrary('lib2')).toBe(false)
    expect(getPermissions(user({ permissions: { accessAllLibraries: true } })).canAccessLibrary('lib2')).toBe(true)
  })
})
