import type { ReactNode } from 'react'
import { SettingsPage } from './pages/SettingsPage'
import { WishlistPage } from './pages/WishlistPage'

/**
 * App-level sections shown in the sidebar below the libraries. Adding a feature
 * (e.g. Wishlist) = one entry here; this is the lightweight "plugin sections" seam.
 */
export interface Section {
  path: string
  label: string
  element: ReactNode
}

export const SECTIONS: Section[] = [
  { path: 'wishlist', label: 'Wishlist', element: <WishlistPage /> },
  { path: 'settings', label: 'Settings', element: <SettingsPage /> }
]
