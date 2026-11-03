import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { buildEventHandlers } from './socketBridge'
import { queryKeys } from './queryKeys'

function setup() {
  const qc = new QueryClient()
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const onUserUpdated = vi.fn()
  const handlers = buildEventHandlers(qc, onUserUpdated)
  const keys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
  return { handlers, keys, onUserUpdated }
}

describe('socket bridge', () => {
  it('refreshes the library and the item on item_updated', () => {
    const { handlers, keys } = setup()
    handlers.item_updated({ id: 'item1', libraryId: 'lib1' })
    expect(keys()).toEqual([queryKeys.libraryItems('lib1'), queryKeys.item('item1')])
  })

  it('handles batched items_added payloads (arrays)', () => {
    const { handlers, keys } = setup()
    handlers.items_added([
      { id: 'a', libraryId: 'lib1' },
      { id: 'b', libraryId: 'lib2' }
    ])
    expect(keys()).toContainEqual(queryKeys.libraryItems('lib1'))
    expect(keys()).toContainEqual(queryKeys.libraryItems('lib2'))
  })

  it('refreshes the library list on library events', () => {
    const { handlers, keys } = setup()
    handlers.library_added({ id: 'lib3' })
    expect(keys()).toEqual([queryKeys.libraries()])
  })

  it('updates the user and re-checks libraries on user_updated', () => {
    const { handlers, keys, onUserUpdated } = setup()
    const user = { id: 'u1', username: 'tester' }
    handlers.user_updated(user)
    expect(onUserUpdated).toHaveBeenCalledWith(user)
    expect(keys()).toEqual([queryKeys.libraries()])
  })

  it('refreshes the wishlist on wishlist events', () => {
    const { handlers, keys } = setup()
    handlers.wishlist_item_removed({ id: 'w1' })
    expect(keys()).toEqual([queryKeys.wishlist()])
  })
})
