const { performance, createHistogram } = require('perf_hooks')
const util = require('util')
const Logger = require('../Logger')

const histograms = new Map()
const MAX_RECENT_VALUES = 100
const MAX_LOG_STRING_LENGTH = 1800

function pushBoundedValue(values, value) {
  values.push(value)
  if (values.length > MAX_RECENT_VALUES) {
    values.shift()
  }
}

function formatFindOptionsForLog(findOptions) {
  const serialized = util.inspect(findOptions, {
    depth: 4,
    maxArrayLength: 20,
    maxStringLength: 200,
    breakLength: 120
  })

  if (serialized.length <= MAX_LOG_STRING_LENGTH) {
    return serialized
  }

  return `${serialized.slice(0, MAX_LOG_STRING_LENGTH - 3)}...`
}

function getPercentile(histogram, percentile) {
  if (!histogram || typeof histogram.percentile !== 'function' || !histogram.count) {
    return 0
  }

  return Math.round(histogram.percentile(percentile))
}

function getHistogramSummary(histogram) {
  return {
    count: histogram.count || 0,
    min: histogram.count ? histogram.min : 0,
    max: histogram.count ? histogram.max : 0,
    mean: histogram.count ? Math.round(histogram.mean) : 0,
    p50: getPercentile(histogram, 50),
    p95: getPercentile(histogram, 95),
    recentValues: Array.isArray(histogram.values) ? [...histogram.values] : []
  }
}

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
      Logger.info(`[${funcName}] findOptions:`, formatFindOptionsForLog(findOptions))
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
      pushBoundedValue(histogram.values, duration)
      Logger.info(`[${funcName}] duration: ${duration}ms`)
      Logger.info(`[${funcName}] histogram summary:`, getHistogramSummary(histogram))
    }
  }
}

module.exports = { profile }
