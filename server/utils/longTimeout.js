/**
 * Handle timeouts greater than 32-bit signed integer
 */
class LongTimeout {
  constructor() {
    this.timeout = 0
    this.timer = null
  }

  clear() {
    clearTimeout(this.timer)
  }

  /**
   *
   * @param {Function} fn
   * @param {number} timeout
   */
  set(fn, timeout) {
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
module.exports = LongTimeout
