import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getSocket } from './socket'
import { queryKeys } from './queryKeys'
import type { User } from './types'

type WithLibrary = { id?: string; libraryId?: string }
// socket.io's listener type; each handler below narrows its own payload
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => void

/**
 * Server socket event -> which cached data it makes stale. Pages never subscribe to the
 * socket themselves; they just use queries, and this keeps them fresh.
 * Event names/payloads: server/SocketAuthority.js and the stock client's layouts/default.vue.
 */
export function buildEventHandlers(qc: QueryClient, onUserUpdated: (user: User) => void): Record<string, Handler> {
  const items = (payload: WithLibrary | WithLibrary[]) => {
    for (const item of Array.isArray(payload) ? payload : [payload]) {
      if (item.libraryId) qc.invalidateQueries({ queryKey: queryKeys.libraryItems(item.libraryId) })
      if (item.id) qc.invalidateQueries({ queryKey: queryKeys.item(item.id) })
    }
  }
  const libraries = () => qc.invalidateQueries({ queryKey: queryKeys.libraries() })
  const wishlist = () => qc.invalidateQueries({ queryKey: queryKeys.wishlist() })

  return {
    item_added: items,
    item_updated: items,
    item_removed: items,
    items_added: items,
    items_updated: items,
    library_added: libraries,
    library_updated: libraries,
    library_removed: libraries,
    // Permissions or library access may have changed: update the user and re-check libraries
    user_updated: (user: User) => {
      onUserUpdated(user)
      libraries()
    },
    wishlist_item_added: wishlist,
    wishlist_item_updated: wishlist,
    wishlist_item_removed: wishlist
  }
}

/** Mount once inside the signed-in app. */
export function useSocketBridge(userId: string | undefined, onUserUpdated: (user: User) => void) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!userId) return
    const socket = getSocket()
    const handlers = buildEventHandlers(qc, (user) => user.id === userId && onUserUpdated(user))
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler)
    }
  }, [qc, userId, onUserUpdated])
}
