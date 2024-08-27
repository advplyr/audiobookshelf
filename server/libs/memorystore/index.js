/*!
 * memorystore
 * Copyright(c) 2020 Rocco Musolino <@roccomuso>
 * MIT Licensed
 */
//
// modified for audiobookshelf (update to lru-cache 10)
// SOURCE: https://github.com/roccomuso/memorystore
//

const debug = require('debug')('memorystore')
const { LRUCache } = require('lru-cache')
const { Store } = require('express-session')

/**
 * An alternative memory store implementation for express session that prunes stale entries.
 *
 * @param {number} checkPeriod stale entry pruning frequency in ms
 * @param {number} ttl entry time to live in ms
 * @param {number} max LRU cache max entries
 */
module.exports = class MemoryStore extends Store {
  constructor(checkPeriod, ttl, max) {
    if (typeof checkPeriod !== 'number' || typeof ttl !== 'number' || typeof max !== 'number') {
      throw Error('All arguments must be provided')
    }
    super()
    this.store = new LRUCache({ ttl, max })
    let prune = () => {
      let sizeBefore = this.store.size
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
  get(sid, fn) {
    let err = null
    let res = null
    const data = this.store.get(sid)
    debug('GET %s: %s', sid, data)
    if (data) {
      try {
        res = JSON.parse(data)
      } catch (e) {
        err = e
      }
    }
    fn && setImmediate(fn, err, res)
  }

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */
  set(sid, sess, fn) {
    let err = null
    try {
      let jsess = JSON.stringify(sess)
      debug('SET %s: %s', sid, jsess)
      this.store.set(sid, jsess)
    } catch (e) {
      err = e
    }
    fn && setImmediate(fn, err)
  }

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */
  destroy(sid, fn) {
    debug('DESTROY %s', sid)
    let err = null
    try {
      this.store.delete(sid)
    } catch (e) {
      err = e
    }
    fn && setImmediate(fn, err)
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

  touch(sid, sess, fn) {
    debug('TOUCH %s', sid)
    let err = null
    try {
      this.store.has(sid, { updateAgeOnHas: true })
    } catch (e) {
      err = e
    }
    fn && setImmediate(fn, err)
  }
}
