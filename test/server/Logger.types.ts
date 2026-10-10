import type Logger from '../../server/Logger'
import type LogManager from '../../server/managers/LogManager'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

type LogObject = {
  timestamp: string
  source: string
  message: string
  levelName: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'NOTE'
  level: number
}

// Keep the CommonJS singleton, arbitrary log arguments, and return semantics typed.
export type LoggerContract = [
  Assert<Equal<typeof Logger.logManager, LogManager | null>>,
  Assert<Equal<typeof Logger.logLevel, number>>,
  Assert<Equal<typeof Logger.timestamp, string>>,
  Assert<Equal<typeof Logger.source, string>>,
  Assert<Equal<Parameters<typeof Logger.trace>, unknown[]>>,
  Assert<Equal<Parameters<typeof Logger.debug>, unknown[]>>,
  Assert<Equal<Parameters<typeof Logger.info>, unknown[]>>,
  Assert<Equal<Parameters<typeof Logger.warn>, unknown[]>>,
  Assert<Equal<Parameters<typeof Logger.error>, unknown[]>>,
  Assert<Equal<Parameters<typeof Logger.fatal>, unknown[]>>,
  Assert<Equal<Parameters<typeof Logger.note>, unknown[]>>,
  Assert<Equal<ReturnType<typeof Logger.trace>, void>>,
  Assert<Equal<ReturnType<typeof Logger.debug>, void>>,
  Assert<Equal<ReturnType<typeof Logger.info>, void>>,
  Assert<Equal<ReturnType<typeof Logger.warn>, void>>,
  Assert<Equal<ReturnType<typeof Logger.error>, void>>,
  Assert<Equal<ReturnType<typeof Logger.fatal>, Promise<void> | undefined>>,
  Assert<Equal<ReturnType<typeof Logger.note>, void>>,
  Assert<Equal<Parameters<typeof Logger.setLogLevel>, [level: number]>>,
  Assert<Equal<Parameters<typeof Logger.removeSocketListener>, [socketId: string]>>,
  Assert<Equal<Parameters<typeof Logger.addSocketListener>[0]['id'], string>>,
  Assert<Equal<Parameters<Parameters<typeof Logger.addSocketListener>[0]['emit']>, [event: 'log', log: LogObject]>>
]
