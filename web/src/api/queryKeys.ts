/**
 * Every React Query key in one place, so the socket bridge and the pages agree on them.
 * Keys are hierarchical: invalidating `libraryItems(id)` also refreshes every page/sort of it.
 */
export const queryKeys = {
  libraries: () => ['libraries'] as const,
  libraryItems: (libraryId: string) => ['library-items', libraryId] as const,
  libraryItemsPage: (libraryId: string, page: number, sort: string) => ['library-items', libraryId, page, sort] as const,
  item: (itemId: string) => ['item', itemId] as const,
  wishlist: () => ['wishlist'] as const
}
