import date from './libs/dateAndTime'
import { LogLevel } from './utils/constants'
import util from 'util'
import type LogManager from './managers/LogManager'

type LogLevelName = keyof typeof LogLevel
type ConsoleMethod = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'log'

type LogObject = {
  timestamp: string
  source: string
  message: string
  levelName: LogLevelName
  level: number
}

type LogSocket = {
  id: string
  emit(event: 'log', log: LogObject): unknown
}

type SocketListener = {
  id: string
  socket: LogSocket
  level: number
}

class Logger {
  logManager: LogManager | null
  isDev: boolean
  logLevel: number
  socketListeners: SocketListener[]

  constructor() {
    this.logManager = null

    this.isDev = process.env.NODE_ENV !== 'production'

    this.logLevel = !this.isDev ? LogLevel.INFO : LogLevel.TRACE
    this.socketListeners = []
  }

  get timestamp(): string {
    return date.format(new Date(), 'YYYY-MM-DD HH:mm:ss.SSS')
  }

  get levelString(): string {
    return this.getLogLevelString(this.logLevel)
  }

  get source(): string {
    const regex = global.isWin ? /^.*\\([^\\:]*:[0-9]*):[0-9]*\)*/ : /^.*\/([^/:]*:[0-9]*):[0-9]*\)*/
    // Node's default V8 stack is a string. Preserve the existing failure if a custom stack formatter removes it.
    return Error().stack!.split('\n')[3].replace(regex, '$1')
  }

  getLogLevelString(level: number): string {
    for (const key in LogLevel) {
      // The loop enumerates the names in the log level table.
      if (LogLevel[key as LogLevelName] === level) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  addSocketListener(socket: LogSocket, level: number): void {
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

  removeSocketListener(socketId: string): void {
    this.socketListeners = this.socketListeners.filter((s) => s.id !== socketId)
  }

  async #logToFileAndListeners(level: number, levelName: LogLevelName, args: unknown[], src: string): Promise<void> {
    const expandedArgs = args.map((arg) => (typeof arg !== 'string' ? util.inspect(arg) : arg))
    const logObj: LogObject = {
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

  setLogLevel(level: number): void {
    this.logLevel = level
    this.debug(`Set Log Level to ${this.levelString}`)
  }

  static ConsoleMethods: Record<LogLevelName, ConsoleMethod> = {
    TRACE: 'trace',
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'error',
    NOTE: 'log'
  }

  #log(levelName: LogLevelName, source: string, ...args: unknown[]): Promise<void> | undefined {
    const level = LogLevel[levelName]
    if (level < LogLevel.FATAL && level < this.logLevel) return
    const consoleMethod = Logger.ConsoleMethods[levelName]
    console[consoleMethod](`[${this.timestamp}] ${levelName}:`, ...args)
    return this.#logToFileAndListeners(level, levelName, args, source)
  }

  trace(...args: unknown[]): void {
    void this.#log('TRACE', this.source, ...args)
  }

  debug(...args: unknown[]): void {
    void this.#log('DEBUG', this.source, ...args)
  }

  info(...args: unknown[]): void {
    void this.#log('INFO', this.source, ...args)
  }

  warn(...args: unknown[]): void {
    void this.#log('WARN', this.source, ...args)
  }

  error(...args: unknown[]): void {
    void this.#log('ERROR', this.source, ...args)
  }

  fatal(...args: unknown[]): Promise<void> | undefined {
    return this.#log('FATAL', this.source, ...args)
  }

  note(...args: unknown[]): void {
    void this.#log('NOTE', this.source, ...args)
  }
}

const logger = new Logger()
export = logger
