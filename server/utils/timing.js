const { performance } = require('perf_hooks')
const Logger = require('../Logger')

async function measure(tag, func) {
  const start = performance.now()
  const result = await func()
  const end = performance.now()
  Logger.debug(`[${tag}] Time elapsed: ${(end - start) | 0} ms`)
  return result
}

function measureMiddleware(req, res, next) {
  const start = performance.now()
  res.on('finish', () => {
    const end = performance.now()
    if (!req.originalUrl.includes('cover'))
      Logger.debug(`[${req.method} ${req.originalUrl}] Finish: Time elapsed: ${(end - start) | 0} ms`)
  })
  res.on('close', () => {
    const end = performance.now()
    if (!req.originalUrl.includes('cover'))
      Logger.debug(`[${req.method} ${req.originalUrl}] Close: Time elapsed: ${(end - start) | 0} ms`)
  })
  next()
}
module.exports = { measure, measureMiddleware }