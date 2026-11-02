// Partial shapes of ABS server responses. Only fields the UI uses; extend as needed.

export interface User {
  id: string
  username: string
  type: 'root' | 'admin' | 'user' | 'guest'
  accessToken?: string
  mediaProgress?: MediaProgress[]
}

export interface LoginResponse {
  user: User
  userDefaultLibraryId: string | null
  serverSettings: Record<string, unknown>
}

export interface ServerStatus {
  app: string
  serverVersion: string
  isInit: boolean
  authMethods: string[]
}

export interface Library {
  id: string
  name: string
  mediaType: 'book' | 'podcast'
  icon: string
  displayOrder: number
}

export interface BookMetadata {
  title: string
  subtitle?: string | null
  authorName?: string
  narratorName?: string
  seriesName?: string
  genres?: string[]
  publishedYear?: string | null
  description?: string | null
}

export interface LibraryItem {
  id: string
  libraryId: string
  mediaType: 'book' | 'podcast'
  updatedAt: number
  addedAt: number
  media: {
    metadata: BookMetadata
    duration?: number
    coverPath?: string | null
  }
}

export interface ItemsPage {
  results: LibraryItem[]
  total: number
  limit: number
  page: number
}

/** Fork addition: server/models/WishlistItem.js */
export interface WishlistItem {
  id: string
  title: string
  author: string | null
  series: string | null
  asin: string | null
  isbn: string | null
  url: string | null
  coverUrl: string | null
  notes: string | null
  status: 'wanted' | 'acquired'
  libraryItemId: string | null
  createdAt: number
  updatedAt: number
}

export interface MediaProgress {
  id: string
  libraryItemId: string
  episodeId?: string | null
  progress: number
  currentTime: number
  isFinished: boolean
  lastUpdate: number
}
