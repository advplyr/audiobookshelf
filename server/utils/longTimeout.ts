/**
 * Handle timeouts greater than 32-bit signed integer
 */
class LongTimeout {
  timeout: number
  timer: NodeJS.Timeout | null

  constructor() {
    this.timeout = 0
    this.timer = null
  }

  clear(): void {
    // Node treats both null and undefined as an absent timer handle.
    clearTimeout(this.timer ?? undefined)
  }

  set(fn: () => void, timeout: number): void {
    const maxValue = 2147483647

    const handleTimeout = () => {
      if (this.timeout > 0) {
        let delay = Math.min(this.timeout, maxValue)
        this.timeout = this.timeout - delay
        this.timer = setTimeout(handleTimeout, delay)
        return
      }
      fn()
    }

    this.timeout = timeout
    handleTimeout()
  }
}
export = LongTimeout
