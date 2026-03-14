const { performance, createHistogram } = require('perf_hooks')
const util = require('util')
const Logger = require('../Logger')

const histograms = new Map()

function callTimingHook(requestTiming, hookName, ...args) {
  if (!requestTiming || typeof requestTiming[hookName] !== 'function') return
  requestTiming[hookName](...args)
}

function createRequestScopedLogging(funcName, logging, requestTiming) {
  const logger = (...args) => {
    Logger.info(`[${funcName}] ${args[0]} Elapsed time: ${args[1]}ms`)
    if (typeof logging === 'function') {
      logging(...args)
    }
    callTimingHook(requestTiming, 'onQuery', ...args)
  }

  return logger
}

function createRequestScopedFindOptions(findOptions, funcName) {
  if (!findOptions || typeof findOptions !== 'object' || Array.isArray(findOptions)) {
    return {
      findOptions,
      requestTiming: null
    }
  }

  const requestTiming = findOptions.requestTiming || null

  return {
    requestTiming,
    findOptions: {
      ...findOptions,
      logging: createRequestScopedLogging(funcName, findOptions.logging, requestTiming),
      benchmark: true
    }
  }
}

function profile(asyncFunc, isFindQuery = true, funcName = asyncFunc.name) {
  if (!histograms.has(funcName)) {
    const histogram = createHistogram()
    histogram.values = []
    histograms.set(funcName, histogram)
  }
  const histogram = histograms.get(funcName)

  return async (...args) => {
    const requestScoped = isFindQuery ? createRequestScopedFindOptions(args[0], funcName) : { findOptions: args[0], requestTiming: null }
    const requestArgs = isFindQuery ? [requestScoped.findOptions, ...args.slice(1)] : args

    if (isFindQuery) {
      const findOptions = requestArgs[0]
      Logger.info(`[${funcName}] findOptions:`, util.inspect(findOptions, { depth: null }))
    }
    const start = performance.now()
    callTimingHook(requestScoped.requestTiming, 'onStart', requestArgs[0])
    try {
      const result = await asyncFunc(...requestArgs)
      callTimingHook(requestScoped.requestTiming, 'onFinish', result)
      return result
    } catch (error) {
      Logger.error(`[${funcName}] failed`)
      callTimingHook(requestScoped.requestTiming, 'onError', error)
      throw error
    } finally {
      const end = performance.now()
      const duration = Math.max(1, Math.round(end - start))
      histogram.record(duration)
      histogram.values.push(duration)
      Logger.info(`[${funcName}] duration: ${duration}ms`)
      Logger.info(`[${funcName}] histogram values:`, histogram.values)
      Logger.info(`[${funcName}] histogram:`, histogram)
    }
  }
}

module.exports = { profile }
