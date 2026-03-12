const { LRUCache } = require('lru-cache')
const Logger = require('../Logger')
const Database = require('../Database')

class ApiCacheManager {
  defaultCacheOptions = { max: 1000, maxSize: 10 * 1000 * 1000, sizeCalculation: (item) => item.body.length + JSON.stringify(item.headers).length }
  defaultTtlOptions = { ttl: 30 * 60 * 1000 }
  highChurnModels = new Set(['session', 'mediaProgress', 'playbackSession', 'device'])
  modelsInvalidatingPersonalized = new Set(['mediaProgress'])
  modelsInvalidatingMe = new Set(['session', 'mediaProgress', 'playbackSession', 'device'])

  constructor(cache = new LRUCache(this.defaultCacheOptions), ttlOptions = this.defaultTtlOptions) {
    this.cache = cache
    this.ttlOptions = ttlOptions
  }

  init(database = Database) {
    let hooks = ['afterCreate', 'afterUpdate', 'afterDestroy', 'afterBulkCreate', 'afterBulkUpdate', 'afterBulkDestroy', 'afterUpsert']
    hooks.forEach((hook) => database.sequelize.addHook(hook, (model) => this.clear(model, hook)))
  }

  getModelName(model) {
    if (typeof model?.name === 'string') return model.name
    if (typeof model?.model?.name === 'string') return model.model.name
    if (typeof model?.constructor?.name === 'string' && model.constructor.name !== 'Object') return model.constructor.name
    return 'unknown'
  }

  clearByUrlPattern(urlPattern) {
    let removed = 0
    for (const key of this.cache.keys()) {
      try {
        const parsed = JSON.parse(key)
        if (typeof parsed?.url === 'string' && urlPattern.test(parsed.url)) {
          if (this.cache.delete(key)) removed++
        }
      } catch {
        if (this.cache.delete(key)) removed++
      }
    }
    return removed
  }

  clearUserProgressSlices(modelName, hook) {
    const removedPersonalized = this.modelsInvalidatingPersonalized.has(modelName) ? this.clearByUrlPattern(/^\/libraries\/[^/]+\/personalized/) : 0
    const removedMe = this.modelsInvalidatingMe.has(modelName) ? this.clearByUrlPattern(/^\/me(\/|\?|$)/) : 0
    Logger.debug(
      `[ApiCacheManager] ${modelName}.${hook}: cleared user-progress cache slices (personalized=${removedPersonalized}, me=${removedMe})`
    )
  }

  clear(model, hook) {
    const modelName = this.getModelName(model)
    if (this.highChurnModels.has(modelName)) {
      this.clearUserProgressSlices(modelName, hook)
      return
    }

    Logger.debug(`[ApiCacheManager] ${modelName}.${hook}: Clearing cache`)
    this.cache.clear()
  }

  /**
   * Reset hooks and clear cache. Used when applying backups
   */
  reset() {
    Logger.info(`[ApiCacheManager] Resetting cache`)

    this.init()
    this.cache.clear()
  }

  get middleware() {
    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @param {import('express').NextFunction} next
     */
    return (req, res, next) => {
      if (req.query.sort === 'random') {
        Logger.debug(`[ApiCacheManager] Skipping cache for random sort`)
        return next()
      }

      const key = { user: req.user.username, url: req.url }
      const stringifiedKey = JSON.stringify(key)
      Logger.debug(`[ApiCacheManager] count: ${this.cache.size} size: ${this.cache.calculatedSize}`)
      const cached = this.cache.get(stringifiedKey)
      if (cached) {
        Logger.debug(`[ApiCacheManager] Cache hit: ${stringifiedKey}`)
        res.set(cached.headers)
        res.status(cached.statusCode)
        res.send(cached.body)
        return
      }
      res.originalSend = res.send
      res.send = (body) => {
        Logger.debug(`[ApiCacheManager] Cache miss: ${stringifiedKey}`)
        const cached = { body, headers: res.getHeaders(), statusCode: res.statusCode }
        if (key.url.search(/^\/libraries\/.*?\/personalized/) !== -1) {
          Logger.debug(`[ApiCacheManager] Caching with ${this.ttlOptions.ttl} ms TTL`)
          this.cache.set(stringifiedKey, cached, this.ttlOptions)
        } else {
          this.cache.set(stringifiedKey, cached)
        }
        res.originalSend(body)
      }
      next()
    }
  }
}
module.exports = ApiCacheManager
