const { performance, createHistogram } = require('perf_hooks')
const util = require('util')
const Logger = require('../Logger')

const histograms = new Map()

function profile(asyncFunc, isFindQuery = true, funcName = asyncFunc.name) {
  if (!histograms.has(funcName)) {
    const histogram = createHistogram()
    histogram.values = []
    histograms.set(funcName, histogram)
  }
  const histogram = histograms.get(funcName)

  return async (...args) => {
    if (isFindQuery) {
      const findOptions = args[0]
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

module.exports = { profile }
