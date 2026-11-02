import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, coverUrl } from '../api/client'
import { getSocket } from '../api/socket'
import type { ItemsPage, LibraryItem } from '../api/types'

const PAGE_SIZE = 48
const SORTS = [
  { value: 'addedAt', label: 'Recently added', desc: true },
  { value: 'media.metadata.title', label: 'Title', desc: false },
  { value: 'media.metadata.authorName', label: 'Author', desc: false }
]

export function LibraryPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState(SORTS[0])
  const qc = useQueryClient()

  useEffect(() => setPage(0), [libraryId])

  const { data, isLoading, error } = useQuery({
    queryKey: ['library-items', libraryId, page, sort.value],
    queryFn: () =>
      api<ItemsPage>(
        `/api/libraries/${libraryId}/items?limit=${PAGE_SIZE}&page=${page}&sort=${sort.value}&desc=${sort.desc ? 1 : 0}&minified=1`
      ),
    enabled: !!libraryId,
    placeholderData: keepPreviousData
  })

  // Live updates: refetch this library when the server reports changes to it.
  useEffect(() => {
    const socket = getSocket()
    const onChange = (payload: { libraryId?: string } | { libraryId?: string }[]) => {
      const items = Array.isArray(payload) ? payload : [payload]
      if (items.some((i) => i.libraryId === libraryId)) qc.invalidateQueries({ queryKey: ['library-items', libraryId] })
    }
    const events = ['item_added', 'item_updated', 'item_removed', 'items_added', 'items_updated']
    events.forEach((e) => socket.on(e, onChange))
    return () => events.forEach((e) => socket.off(e, onChange))
  }, [libraryId, qc])

  const pageCount = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{data ? `${data.total} items` : ' '}</p>
        <select
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
          value={sort.value}
          onChange={(e) => {
            setSort(SORTS.find((s) => s.value === e.target.value)!)
            setPage(0)
          }}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Failed to load library.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {data?.results.map((item) => <ItemCard key={item.id} item={item} />)}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button className="rounded-md border border-border px-3 py-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Prev
          </button>
          <span className="text-sm text-muted">
            {page + 1} / {pageCount}
          </span>
          <button
            className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item }: { item: LibraryItem }) {
  const { title, authorName } = item.media.metadata
  return (
    <div className="space-y-1">
      <div className="aspect-square overflow-hidden rounded-card bg-surface-2">
        {item.media.coverPath ? (
          <img src={coverUrl(item.id, item.updatedAt)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-sm text-muted">{title}</div>
        )}
      </div>
      <p className="truncate text-sm font-medium" title={title}>
        {title}
      </p>
      <p className="truncate text-xs text-muted">{authorName}</p>
    </div>
  )
}
