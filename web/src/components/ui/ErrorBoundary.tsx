import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from './Button'

/** Full-area error message with an optional retry. Also used for failed queries. */
export function ErrorScreen({ title = 'Something went wrong', detail, onRetry }: { title?: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <TriangleAlert className="size-8 text-danger" aria-hidden />
      <p className="font-medium">{title}</p>
      {detail && <p className="max-w-md text-sm text-muted">{detail}</p>}
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}

interface Props {
  children: ReactNode
  /** Changing this (e.g. the route path) clears a caught error. */
  resetKey?: unknown
}

/** Catches render errors so one broken page doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return <ErrorScreen detail={this.state.error.message} onRetry={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}
