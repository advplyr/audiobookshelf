import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'
import { cn } from './cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Buttons row at the bottom, right-aligned. */
  footer?: ReactNode
  className?: string
}

/**
 * Built on <dialog>: the browser handles focus trapping, Escape and the backdrop.
 * Clicking the backdrop closes it too.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-lg rounded-card border border-border bg-surface p-0 text-fg shadow-xl backdrop:bg-black/50',
        className
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 id="modal-title" className="text-base font-semibold">
              {title}
            </h2>
            <IconButton label="Close" variant="ghost" size="sm" icon={<X className="size-4" />} onClick={onClose} />
          </div>
          <div className="overflow-y-auto px-4 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
