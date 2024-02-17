const date = require('./libs/dateAndTime')
const { LogLevel } = require('./utils/constants')

class Logger {
  constructor() {
    /** @type {import('./managers/LogManager')} */
    this.logManager = null

    this.isDev = process.env.NODE_ENV !== 'production'
    this.logLevel = !this.isDev ? LogLevel.INFO : LogLevel.TRACE
    this.socketListeners = []
  }

  /**
   * @returns {string}
   */
  get timestamp() {
    return date.format(new Date(), 'YYYY-MM-DD HH:mm:ss.SSS')
  }

  get levelString() {
    for (const key in LogLevel) {
      if (LogLevel[key] === this.logLevel) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  /**
   * @returns {string}
   */
  get source() {
    try {
      throw new Error()
    } catch (error) {
      const regex = global.isWin ? /^.*\\([^\\:]*:[0-9]*):[0-9]*\)*/ : /^.*\/([^/:]*:[0-9]*):[0-9]*\)*/
      return error.stack.split('\n')[3].replace(regex, '$1')
    }
  }

  getLogLevelString(level) {
    for (const key in LogLevel) {
      if (LogLevel[key] === level) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  addSocketListener(socket, level) {
    var index = this.socketListeners.findIndex(s => s.id === socket.id)
    if (index >= 0) {
      this.socketListeners.splice(index, 1, {
        id: socket.id,
        socket,
        level
      })
    } else {
      this.socketListeners.push({
        id: socket.id,
        socket,
        level
      })
    }
  }

  removeSocketListener(socketId) {
    this.socketListeners = this.socketListeners.filter(s => s.id !== socketId)
  }

  /**
   * 
   * @param {number} level 
   * @param {string[]} args 
   */
  async handleLog(level, args) {
    const logObj = {
      timestamp: this.timestamp,
      source: this.source,
      message: args.join(' '),
      levelName: this.getLogLevelString(level),
      level
    }

    // Emit log to sockets that are listening to log events
    this.socketListeners.forEach((socketListener) => {
      if (socketListener.level <= level) {
        socketListener.socket.emit('log', logObj)
      }
    })

    // Save log to file
    if (level >= this.logLevel) {
      await this.logManager.logToFile(logObj)
    }
  }

  setLogLevel(level) {
    this.logLevel = level
    this.debug(`Set Log Level to ${this.levelString}`)
  }

  trace(...args) {
    if (this.logLevel > LogLevel.TRACE) return
    console.trace(`[${this.timestamp}] TRACE:`, ...args)
    this.handleLog(LogLevel.TRACE, args)
  }

  debug(...args) {
    if (this.logLevel > LogLevel.DEBUG) return
    console.debug(`[${this.timestamp}] DEBUG:`, ...args, `(${this.source})`)
    this.handleLog(LogLevel.DEBUG, args)
  }

  info(...args) {
    if (this.logLevel > LogLevel.INFO) return
    console.info(`[${this.timestamp}] INFO:`, ...args)
    this.handleLog(LogLevel.INFO, args)
  }

  warn(...args) {
    if (this.logLevel > LogLevel.WARN) return
    console.warn(`[${this.timestamp}] WARN:`, ...args, `(${this.source})`)
    this.handleLog(LogLevel.WARN, args)
  }

  error(...args) {
    if (this.logLevel > LogLevel.ERROR) return
    console.error(`[${this.timestamp}] ERROR:`, ...args, `(${this.source})`)
    this.handleLog(LogLevel.ERROR, args)
  }

  /**
   * Fatal errors are ones that exit the process
   * Fatal logs are saved to crash_logs.txt
   * 
   * @param  {...any} args 
   */
  fatal(...args) {
    console.error(`[${this.timestamp}] FATAL:`, ...args, `(${this.source})`)
    return this.handleLog(LogLevel.FATAL, args)
  }

  note(...args) {
    console.log(`[${this.timestamp}] NOTE:`, ...args)
    this.handleLog(LogLevel.NOTE, args)
  }
}
module.exports = new Logger()