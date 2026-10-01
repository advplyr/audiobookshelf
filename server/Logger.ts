const date = require('./libs/dateAndTime')
const { LogLevel } = require('./utils/constants')
const util = require('util')

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
    return this.getLogLevelString(this.logLevel)
  }

  /**
   * @returns {string}
   */
  get source() {
    const regex = global.isWin ? /^.*\\([^\\:]*:[0-9]*):[0-9]*\)*/ : /^.*\/([^/:]*:[0-9]*):[0-9]*\)*/
    return Error().stack.split('\n')[3].replace(regex, '$1')
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
    var index = this.socketListeners.findIndex((s) => s.id === socket.id)
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
    this.socketListeners = this.socketListeners.filter((s) => s.id !== socketId)
  }

  /**
   *
   * @param {number} level
   * @param {string} levelName
   * @param {string[]} args
   * @param {string} src
   */
  async #logToFileAndListeners(level, levelName, args, src) {
    const expandedArgs = args.map((arg) => (typeof arg !== 'string' ? util.inspect(arg) : arg))
    const logObj = {
      timestamp: this.timestamp,
      source: src,
      message: expandedArgs.join(' '),
      levelName,
      level
    }

    // Emit log to sockets that are listening to log events
    this.socketListeners.forEach((socketListener) => {
      if (level >= LogLevel.FATAL || level >= socketListener.level) {
        socketListener.socket.emit('log', logObj)
      }
    })

    // Save log to file
    if (level >= LogLevel.FATAL || level >= this.logLevel) {
      await this.logManager?.logToFile(logObj)
    }
  }

  setLogLevel(level) {
    this.logLevel = level
    this.debug(`Set Log Level to ${this.levelString}`)
  }

  static ConsoleMethods = {
    TRACE: 'trace',
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'error',
    NOTE: 'log'
  }

  #log(levelName, source, ...args) {
    const level = LogLevel[levelName]
    if (level < LogLevel.FATAL && level < this.logLevel) return
    const consoleMethod = Logger.ConsoleMethods[levelName]
    console[consoleMethod](`[${this.timestamp}] ${levelName}:`, ...args)
    return this.#logToFileAndListeners(level, levelName, args, source)
  }

  trace(...args) {
    this.#log('TRACE', this.source, ...args)
  }

  debug(...args) {
    this.#log('DEBUG', this.source, ...args)
  }

  info(...args) {
    this.#log('INFO', this.source, ...args)
  }

  warn(...args) {
    this.#log('WARN', this.source, ...args)
  }

  error(...args) {
    this.#log('ERROR', this.source, ...args)
  }

  fatal(...args) {
    return this.#log('FATAL', this.source, ...args)
  }

  note(...args) {
    this.#log('NOTE', this.source, ...args)
  }
}
module.exports = new Logger()
