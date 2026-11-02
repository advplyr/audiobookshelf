import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, MoreHorizontal, Plus, Trash2, Undo2 } from 'lucide-react'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import type { WishlistItem } from '../api/types'
import { Button, ErrorScreen, Field, IconButton, Input, Menu, Modal, TextArea, cn, useToast } from '../components/ui'

// Server side: server/controllers/WishlistController.js (fork addition).
// Live updates from other tabs/devices come through the socket bridge (wishlist_item_* events).
type Filter = 'wanted' | 'acquired'
const FILTER_LABELS: Record<Filter, string> = { wanted: 'Wanted', acquired: 'Acquired' }

export function WishlistPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('wanted')
  const [adding, setAdding] = useState(false)

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.wishlist(),
    queryFn: () => api<{ wishlist: WishlistItem[] }>('/api/wishlist').then((r) => r.wishlist)
  })

  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.wishlist() })
  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<WishlistItem> & { id: string }) =>
      api<WishlistItem>(`/api/wishlist/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (item) => {
      refresh()
      toast.success(item.status === 'acquired' ? `Marked "${item.title}" as acquired` : `Moved "${item.title}" back to wanted`)
    },
    onError: () => toast.error("Couldn't update that item")
  })
  const remove = useMutation({
    mutationFn: (item: WishlistItem) => api(`/api/wishlist/${item.id}`, { method: 'DELETE' }),
    onSuccess: (_, item) => {
      refresh()
      toast.info(`Removed "${item.title}"`)
    },
    onError: () => toast.error("Couldn't remove that item")
  })

  if (error) return <ErrorScreen title="Couldn't load your wishlist" detail={error.message} onRetry={() => refetch()} />

  const visible = items?.filter((i) => i.status === filter) ?? []
  const count = (f: Filter) => items?.filter((i) => i.status === f).length ?? 0

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Wishlist</h1>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          Add book
        </Button>
      </div>

      <AddModal open={adding} onClose={() => setAdding(false)} />

      <div role="tablist" className="flex gap-1 border-b border-border">
        {(['wanted', 'acquired'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn('-mb-px border-b-2 px-3 py-1.5 text-sm', filter === f ? 'border-accent text-fg' : 'border-transparent text-muted')}
          >
            {FILTER_LABELS[f]} ({count(f)})
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted">Loading…</p>}
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
                <a href={item.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  Link <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
            <Menu
              trigger={(props) => <IconButton label={`Actions for ${item.title}`} variant="ghost" size="sm" icon={<MoreHorizontal className="size-4" />} {...props} />}
              items={[
                item.status === 'wanted'
                  ? { label: 'Mark acquired', icon: <Check className="size-4" />, onSelect: () => update.mutate({ id: item.id, status: 'acquired' }) }
                  : { label: 'Move to wanted', icon: <Undo2 className="size-4" />, onSelect: () => update.mutate({ id: item.id, status: 'wanted' }) },
                { label: 'Remove', icon: <Trash2 className="size-4" />, danger: true, onSelect: () => remove.mutate(item) }
              ]}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

const EMPTY = { title: '', author: '', series: '', url: '', coverUrl: '', notes: '' }

function AddModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const close = () => {
    setForm(EMPTY)
    create.reset()
    onClose()
  }
  const create = useMutation({
    mutationFn: (body: typeof EMPTY) => {
      // Send only filled fields; the server rejects non-http(s) links with a 400.
      const payload = Object.fromEntries(Object.entries(body).filter(([, v]) => v.trim()))
      return api<WishlistItem>('/api/wishlist', { method: 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: queryKeys.wishlist() })
      toast.success(`Added "${item.title}"`)
      close()
    }
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate(form)
  }

  const text = (name: keyof typeof EMPTY, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label}>{(a11y) => <Input {...a11y} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} {...props} />}</Field>
  )

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add to wishlist"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form="wishlist-add" loading={create.isPending} disabled={!form.title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <form id="wishlist-add" onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {text('title', 'Title *', { required: true, autoFocus: true })}
          {text('author', 'Author')}
          {text('series', 'Series')}
          {text('url', 'Link (https://…)', { type: 'url' })}
        </div>
        {text('coverUrl', 'Cover image URL', { type: 'url' })}
        <Field label="Notes" error={create.isError ? "Couldn't save. Links must start with http:// or https://." : null}>
          {(a11y) => <TextArea {...a11y} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  )
}
