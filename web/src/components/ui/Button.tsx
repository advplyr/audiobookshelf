import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'border border-border bg-surface hover:bg-surface-2',
  ghost: 'hover:bg-surface-2',
  danger: 'text-danger hover:bg-surface-2'
}
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5',
  md: 'h-9 px-3 text-sm gap-2'
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, disabled, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

/** Square icon-only button; `label` is required so screen readers can name it. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'children'> & { label: string }>(function IconButton(
  { label, className, size = 'md', ...rest },
  ref
) {
  return <Button ref={ref} aria-label={label} title={label} size={size} className={cn(size === 'sm' ? 'w-8 px-0' : 'w-9 px-0', className)} {...rest} />
})
