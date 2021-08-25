const LOG_LEVEL = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5
}

class Logger {
  constructor() {
    let env_log_level = process.env.LOG_LEVEL || 'TRACE'
    this.LogLevel = LOG_LEVEL[env_log_level] || LOG_LEVEL.TRACE
    this.info(`Log Level: ${this.LogLevel}`)
  }

  get timestamp() {
    return (new Date()).toISOString()
  }

  trace(...args) {
    if (this.LogLevel > LOG_LEVEL.TRACE) return
    console.trace(`[${this.timestamp}] TRACE:`, ...args)
  }

  debug(...args) {
    if (this.LogLevel > LOG_LEVEL.DEBUG) return
    console.debug(`[${this.timestamp}] DEBUG:`, ...args)
  }

  info(...args) {
    if (this.LogLevel > LOG_LEVEL.INFO) return
    console.info(`[${this.timestamp}]  INFO:`, ...args)
  }

  note(...args) {
    if (this.LogLevel > LOG_LEVEL.INFO) return
    console.log(`[${this.timestamp}] NOTE:`, ...args)
  }

  warn(...args) {
    if (this.LogLevel > LOG_LEVEL.WARN) return
    console.warn(`[${this.timestamp}]  WARN:`, ...args)
  }

  error(...args) {
    if (this.LogLevel > LOG_LEVEL.ERROR) return
    console.error(`[${this.timestamp}] ERROR:`, ...args)
  }

  fatal(...args) {
    console.error(`[${this.timestamp}] FATAL:`, ...args)
  }
}
module.exports = new Logger()