/*!
 * memorystore
 * Copyright(c) 2020 Rocco Musolino <@roccomuso>
 * MIT Licensed
 */
//
// modified for audiobookshelf (update to lru-cache 10)
// SOURCE: https://github.com/roccomuso/memorystore
//

import { createRequire } from 'node:module'
import { LRUCache } from 'lru-cache'
import { Store } from 'express-session'

type DebugFactory = (namespace: string) => (format: string, ...values: unknown[]) => void
const debug = (createRequire(__filename)('debug') as DebugFactory)('memorystore')

type SessionCallback = (error: unknown, session?: unknown) => void

/**
 * An alternative memory store implementation for express session that prunes stale entries.
 *
 * @param {number} checkPeriod stale entry pruning frequency in ms
 * @param {number} ttl entry time to live in ms
 * @param {number} max LRU cache max entries
 */
class MemoryStore extends Store {
  store: LRUCache<string, string>

  constructor(checkPeriod: number, ttl: number, max: number) {
    if (typeof checkPeriod !== 'number' || typeof ttl !== 'number' || typeof max !== 'number') {
      throw Error('All arguments must be provided')
    }
    super()
    this.store = new LRUCache<string, string>({ ttl, max })
    const prune = () => {
      const sizeBefore = this.store.size
      this.store.purgeStale()
      debug('PRUNE size changed by %i entries', sizeBefore - this.store.size)
    }
    setInterval(prune, Math.floor(checkPeriod)).unref()
    debug('INIT MemoryStore constructed with checkPeriod "%i", ttl "%i", max "%i"', checkPeriod, ttl, max)
  }

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */
  get(sid: string, fn?: SessionCallback) {
    let err: unknown = null
    let res: unknown = null
    const data = this.store.get(sid)
    debug('GET %s: %s', sid, data)
    if (data) {
      try {
        res = JSON.parse(data)
      } catch (e) {
        err = e
      }
    }
    if (fn) setImmediate(fn, err, res)
  }

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */
  set(sid: string, sess: unknown, fn?: SessionCallback) {
    let err: unknown = null
    try {
      const jsess = JSON.stringify(sess)
      debug('SET %s: %s', sid, jsess)
      this.store.set(sid, jsess)
    } catch (e) {
      err = e
    }
    if (fn) setImmediate(fn, err)
  }

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */
  destroy(sid: string, fn?: SessionCallback) {
    debug('DESTROY %s', sid)
    let err: unknown = null
    try {
      this.store.delete(sid)
    } catch (e) {
      err = e
    }
    if (fn) setImmediate(fn, err)
  }

  /**
   * Refresh the time-to-live for the session with the given `sid` without affecting
   * LRU recency.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  touch(sid: string, _sess: unknown, fn?: SessionCallback) {
    debug('TOUCH %s', sid)
    let err: unknown = null
    try {
      this.store.has(sid, { updateAgeOnHas: true })
    } catch (e) {
      err = e
    }
    if (fn) setImmediate(fn, err)
  }
}

export = MemoryStore
