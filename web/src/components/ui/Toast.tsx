import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from './cn'

type Kind = 'info' | 'success' | 'error'
interface Toast {
  id: number
  kind: Kind
  message: string
}

interface ToastApi {
  info: (message: string) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
const DURATION_MS = 5000
const ICONS = { info: Info, success: CircleCheck, error: CircleAlert }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-3), { id, kind, message }])
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss]
  )

  const api = useMemo<ToastApi>(
    () => ({ info: (m) => push('info', m), success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* polite region: screen readers announce new toasts without interrupting */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-card border border-border bg-surface p-3 text-sm shadow-lg"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', t.kind === 'error' ? 'text-danger' : t.kind === 'success' ? 'text-success' : 'text-accent')} aria-hidden />
              <p className="flex-1">{t.message}</p>
              <button type="button" aria-label="Dismiss" className="text-muted hover:text-fg" onClick={() => dismiss(t.id)}>
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
