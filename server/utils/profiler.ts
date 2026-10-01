import { performance, createHistogram } from 'perf_hooks'
import type { RecordableHistogram } from 'perf_hooks'
import util from 'util'
import Logger from '../Logger'

type ProfileHistogram = RecordableHistogram & { values: number[] }
type FindOptions = {
  logging?: boolean | ((query: string, time?: number) => void)
  benchmark?: boolean
}

const histograms = new Map<string, ProfileHistogram>()

function profile<Args extends [object, ...unknown[]], Result>(asyncFunc: (...args: Args) => Result, isFindQuery?: true, funcName?: string): (...args: Args) => Promise<Awaited<Result>>
function profile<Args extends unknown[], Result>(asyncFunc: (...args: Args) => Result, isFindQuery: false, funcName?: string): (...args: Args) => Promise<Awaited<Result>>
function profile<Args extends [object, ...unknown[]], Result>(asyncFunc: (...args: Args) => Result, isFindQuery: boolean, funcName?: string): (...args: Args) => Promise<Awaited<Result>>
function profile<Args extends unknown[], Result>(asyncFunc: (...args: Args) => Result, isFindQuery = true, funcName = asyncFunc.name): (...args: Args) => Promise<Awaited<Result>> {
  if (!histograms.has(funcName)) {
    const histogram: ProfileHistogram = Object.assign(createHistogram(), { values: [] })
    histograms.set(funcName, histogram)
  }
  // Every function name has a histogram after initialization above.
  const histogram = histograms.get(funcName)!

  return async (...args: Args): Promise<Awaited<Result>> => {
    if (isFindQuery) {
      // Query-mode overloads require a mutable options object as the first argument.
      const findOptions = args[0] as FindOptions
      Logger.info(`[${funcName}] findOptions:`, util.inspect(findOptions, { depth: null }))
      findOptions.logging = (query, time) => Logger.info(`[${funcName}] ${query} Elapsed time: ${time}ms`)
      findOptions.benchmark = true
    }
    const start = performance.now()
    try {
      const result = await asyncFunc(...args)
      return result
    } catch (error) {
      Logger.error(`[${funcName}] failed`)
      throw error
    } finally {
      const end = performance.now()
      const duration = Math.round(end - start)
      histogram.record(duration)
      histogram.values.push(duration)
      Logger.info(`[${funcName}] duration: ${duration}ms`)
      Logger.info(`[${funcName}] histogram values:`, histogram.values)
      Logger.info(`[${funcName}] histogram:`, histogram)
    }
  }
}

export = { profile }
