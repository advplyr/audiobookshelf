import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { api, coverUrl } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import type { ItemsPage, LibraryItem } from '../api/types'
import { ErrorScreen, IconButton, Select } from '../components/ui'

const PAGE_SIZE = 48
const SORTS = [
  { value: 'addedAt', label: 'Recently added', desc: true },
  { value: 'media.metadata.title', label: 'Title', desc: false },
  { value: 'media.metadata.authorName', label: 'Author', desc: false }
]

export function LibraryPage() {
  const { libraryId = '' } = useParams<{ libraryId: string }>()
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState(SORTS[0])

  useEffect(() => setPage(0), [libraryId])

  // Live updates come from the socket bridge invalidating queryKeys.libraryItems(libraryId)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.libraryItemsPage(libraryId, page, sort.value),
    queryFn: () =>
      api<ItemsPage>(
        `/api/libraries/${libraryId}/items?limit=${PAGE_SIZE}&page=${page}&sort=${sort.value}&desc=${sort.desc ? 1 : 0}&minified=1`
      ),
    enabled: !!libraryId,
    placeholderData: keepPreviousData
  })

  if (error) return <ErrorScreen title="Couldn't load this library" detail={error.message} onRetry={() => refetch()} />

  const pageCount = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{data ? `${data.total} items` : ' '}</p>
        <Select
          aria-label="Sort by"
          className="w-auto"
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
        </Select>
      </div>

      {isLoading && <Loader2 className="mx-auto size-6 animate-spin text-muted" aria-label="Loading" />}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {data?.results.map((item) => <ItemCard key={item.id} item={item} />)}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <IconButton label="Previous page" icon={<ChevronLeft className="size-4" />} disabled={page === 0} onClick={() => setPage(page - 1)} />
          <span className="text-sm text-muted">
            {page + 1} / {pageCount}
          </span>
          <IconButton label="Next page" icon={<ChevronRight className="size-4" />} disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} />
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
