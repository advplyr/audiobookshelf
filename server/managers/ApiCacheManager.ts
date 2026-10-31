import { LRUCache } from 'lru-cache'
import type { Request, Response, NextFunction } from 'express'
import type { OutgoingHttpHeaders } from 'http'
import Logger from '../Logger'
import Database from '../Database'

type CachedResponse = { body: unknown; headers: OutgoingHttpHeaders; statusCode: number }
// The original send wrapper returns undefined after invoking the saved Express send.
type CacheResponse = Omit<Response, 'send'> & {
  send: (body?: unknown) => unknown
  originalSend?: (body?: unknown) => unknown
}
type AuthRequest = Request & { user?: { username: string } }
type HookModel = { name?: unknown; model?: { name?: unknown }; constructor?: { name?: unknown } } | null | undefined

class ApiCacheManager {
  declare cache: LRUCache<string, CachedResponse>
  declare ttlOptions: { ttl: number }
  // Preserve the existing size assumption and its failure for bodies without length.
  defaultCacheOptions = { max: 1000, maxSize: 10 * 1000 * 1000, sizeCalculation: (item: CachedResponse) => (item.body as { length: number }).length + JSON.stringify(item.headers).length }
  defaultTtlOptions = { ttl: 30 * 60 * 1000 }
  highChurnModels = new Set(['session', 'mediaProgress', 'playbackSession', 'device'])
  modelsInvalidatingPersonalized = new Set(['mediaProgress'])
  modelsInvalidatingMe = new Set(['session', 'mediaProgress', 'playbackSession', 'device'])

  constructor(cache = new LRUCache<string, CachedResponse>(this.defaultCacheOptions), ttlOptions = this.defaultTtlOptions) {
    this.cache = cache
    this.ttlOptions = ttlOptions
  }

  init(database: Pick<typeof Database, 'sequelize'> = Database) {
    let hooks = ['afterCreate', 'afterUpdate', 'afterDestroy', 'afterBulkCreate', 'afterBulkUpdate', 'afterBulkDestroy', 'afterUpsert'] as const
    hooks.forEach((hook) => database.sequelize!.addHook(hook, (model: unknown) => this.clear(model, hook)))
  }

  getModelName(value: unknown) {
    // Sequelize hook payloads vary; these are property views, with the existing string guards retained.
    const model = value as HookModel
    if (typeof model?.name === 'string') return model.name
    if (typeof model?.model?.name === 'string') return model.model.name
    if (typeof model?.constructor?.name === 'string' && model.constructor.name !== 'Object') return model.constructor.name
    return 'unknown'
  }

  clearByUrlPattern(urlPattern: RegExp) {
    let removed = 0
    for (const key of this.cache.keys()) {
      try {
        const parsed = JSON.parse(key) as { url?: unknown } | null | undefined
        if (typeof parsed?.url === 'string' && urlPattern.test(parsed.url)) {
          if (this.cache.delete(key)) removed++
        }
      } catch {
        if (this.cache.delete(key)) removed++
      }
    }
    return removed
  }

  clearUserProgressSlices(modelName: string, hook: string) {
    let removedPersonalized = 0
    let removedRecentEpisodes = 0
    if (this.modelsInvalidatingPersonalized.has(modelName)) {
      removedPersonalized = this.clearByUrlPattern(/^\/libraries\/[^/]+\/personalized/)
      removedRecentEpisodes = this.clearByUrlPattern(/^\/libraries\/[^/]+\/recent-episodes/)
    }
    const removedMe = this.modelsInvalidatingMe.has(modelName) ? this.clearByUrlPattern(/^\/me(\/|\?|$)/) : 0
    Logger.debug(`[ApiCacheManager] ${modelName}.${hook}: cleared user-progress cache slices (personalized=${removedPersonalized}, recentEpisodes=${removedRecentEpisodes}, me=${removedMe})`)
  }

  clear(model: unknown, hook: string) {
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
    return (req: AuthRequest, res: CacheResponse, next: NextFunction) => {
      if (req.query.sort === 'random') {
        Logger.debug(`[ApiCacheManager] Skipping cache for random sort`)
        return next()
      }

      const key = { user: req.user!.username, url: req.url }
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
      res.send = (body: unknown) => {
        Logger.debug(`[ApiCacheManager] Cache miss: ${stringifiedKey}`)
        const cached = { body, headers: res.getHeaders(), statusCode: res.statusCode }
        if (key.url.search(/^\/libraries\/.*?\/personalized/) !== -1) {
          Logger.debug(`[ApiCacheManager] Caching with ${this.ttlOptions.ttl} ms TTL`)
          this.cache.set(stringifiedKey, cached, this.ttlOptions)
        } else {
          this.cache.set(stringifiedKey, cached)
        }
        res.originalSend!(body)
      }
      next()
    }
  }
}
export = ApiCacheManager
