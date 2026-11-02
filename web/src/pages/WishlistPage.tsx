import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { getSocket } from '../api/socket'
import type { WishlistItem } from '../api/types'

// Server side: server/controllers/WishlistController.js (fork addition)
const KEY = ['wishlist']
type Filter = 'wanted' | 'acquired'

export function WishlistPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('wanted')
  const [adding, setAdding] = useState(false)

  const { data: items, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ wishlist: WishlistItem[] }>('/api/wishlist').then((r) => r.wishlist)
  })

  // Keep in sync with changes made from other tabs/devices.
  useEffect(() => {
    const socket = getSocket()
    const refetch = () => qc.invalidateQueries({ queryKey: KEY })
    const events = ['wishlist_item_added', 'wishlist_item_updated', 'wishlist_item_removed']
    events.forEach((e) => socket.on(e, refetch))
    return () => events.forEach((e) => socket.off(e, refetch))
  }, [qc])

  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<WishlistItem> & { id: string }) =>
      api<WishlistItem>(`/api/wishlist/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/wishlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY })
  })

  const visible = items?.filter((i) => i.status === filter) ?? []
  const counts = { wanted: items?.filter((i) => i.status === 'wanted').length ?? 0, acquired: items?.filter((i) => i.status === 'acquired').length ?? 0 }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Wishlist</h1>
        <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg" onClick={() => setAdding(true)}>
          + Add book
        </button>
      </div>

      {adding && <AddForm onDone={() => setAdding(false)} />}

      <div className="flex gap-1 border-b border-border">
        {(['wanted', 'acquired'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm capitalize ${filter === f ? 'border-accent text-fg' : 'border-transparent text-muted'}`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-danger">Failed to load wishlist.</p>}
      {items && visible.length === 0 && (
        <p className="py-8 text-center text-muted">{filter === 'wanted' ? 'Nothing on your wishlist yet.' : 'Nothing marked as acquired yet.'}</p>
      )}

      <ul className="space-y-2">
        {visible.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-card border border-border bg-surface p-3">
            {item.coverUrl && <img src={item.coverUrl} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover" />}
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-medium">{item.title}</p>
              {(item.author || item.series) && <p className="text-sm text-muted">{[item.author, item.series].filter(Boolean).join(' · ')}</p>}
              {item.notes && <p className="text-sm whitespace-pre-wrap">{item.notes}</p>}
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-sm text-accent hover:underline">
                  Link
                </a>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
              <button
                className="rounded-md border border-border px-2 py-1 hover:bg-surface-2"
                onClick={() => update.mutate({ id: item.id, status: item.status === 'wanted' ? 'acquired' : 'wanted' })}
              >
                {item.status === 'wanted' ? 'Mark acquired' : 'Move to wanted'}
              </button>
              <button className="px-2 py-1 text-danger" onClick={() => remove.mutate(item.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const EMPTY = { title: '', author: '', series: '', url: '', coverUrl: '', notes: '' }

function AddForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const create = useMutation({
    mutationFn: (body: typeof EMPTY) => {
      // Send only filled fields; the server rejects non-http(s) links with a 400.
      const payload = Object.fromEntries(Object.entries(body).filter(([, v]) => v.trim()))
      return api<WishlistItem>('/api/wishlist', { method: 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      onDone()
    }
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate(form)
  }

  const field = (name: keyof typeof EMPTY, label: string, props: Record<string, unknown> = {}) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 outline-none focus:border-accent"
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        {...props}
      />
    </label>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('title', 'Title *', { required: true, autoFocus: true })}
        {field('author', 'Author')}
        {field('series', 'Series')}
        {field('url', 'Link (https://…)', { type: 'url' })}
        {field('coverUrl', 'Cover image URL', { type: 'url' })}
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted">Notes</span>
        <textarea
          className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 outline-none focus:border-accent"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
      {create.isError && <p className="text-sm text-danger">Couldn't save. Links must start with http:// or https://.</p>}
      <div className="flex gap-2">
        <button disabled={create.isPending || !form.title.trim()} className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:opacity-50">
          {create.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}
