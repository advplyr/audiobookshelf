const { createRemoteJWKSet, jwtVerify } = require('jose')
const Logger = require('../Logger')
const Database = require('../Database')
const SocketAuthority = require('../SocketAuthority')

class BackchannelLogoutHandler {
  /** Maximum number of jti entries to keep (bounded by rate limiter: 40 req/10min) */
  static MAX_JTI_CACHE_SIZE = 500

  constructor() {
    /** @type {import('jose').GetKeyFunction|null} */
    this._jwks = null
    /** @type {Map<string, number>} jti -> expiry timestamp for replay protection */
    this._usedJtis = new Map()
  }

  /** Reset cached JWKS and jti cache (called when OIDC settings change) */
  reset() {
    this._jwks = null
    this._usedJtis.clear()
  }

  /**
   * Check if a jti has already been used (replay protection)
   * @param {string} jti
   * @returns {boolean} true if the jti is a replay
   */
  _isReplayedJti(jti) {
    const now = Date.now()

    // Prune expired entries periodically (every check, cheap since Map is small)
    for (const [key, expiry] of this._usedJtis) {
      if (expiry < now) this._usedJtis.delete(key)
    }

    if (this._usedJtis.has(jti)) return true

    // Enforce upper bound to prevent unbounded growth
    if (this._usedJtis.size >= BackchannelLogoutHandler.MAX_JTI_CACHE_SIZE) {
      // Drop the oldest entry (first inserted in Map iteration order)
      const oldestKey = this._usedJtis.keys().next().value
      this._usedJtis.delete(oldestKey)
    }

    // Store with 5-minute TTL (matches maxTokenAge)
    this._usedJtis.set(jti, now + 5 * 60 * 1000)
    return false
  }

  /**
   * Get or create the JWKS key function for JWT verification
   * @returns {import('jose').GetKeyFunction}
   */
  _getJwks() {
    if (!this._jwks) {
      const jwksUrl = global.ServerSettings.authOpenIDJwksURL
      if (!jwksUrl) throw new Error('JWKS URL not configured')
      this._jwks = createRemoteJWKSet(new URL(jwksUrl))
    }
    return this._jwks
  }

  /**
   * Validate and process a backchannel logout token
   * @see https://openid.net/specs/openid-connect-backchannel-1_0.html#Validation
   * @param {string} logoutToken - the raw JWT logout_token from the IdP
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async processLogoutToken(logoutToken) {
    try {
      // Verify JWT signature, issuer, audience, and max age
      const { payload } = await jwtVerify(logoutToken, this._getJwks(), {
        issuer: global.ServerSettings.authOpenIDIssuerURL,
        audience: global.ServerSettings.authOpenIDClientID,
        maxTokenAge: '5m'
      })

      // Check that the events claim contains the backchannel logout event
      const events = payload.events
      if (!events || typeof events !== 'object' || !('http://schemas.openid.net/event/backchannel-logout' in events)) {
        Logger.warn('[BackchannelLogout] Missing or invalid events claim')
        return { success: false, error: 'invalid_request' }
      }

      // Spec: logout token MUST contain a jti claim
      if (!payload.jti) {
        Logger.warn('[BackchannelLogout] Missing jti claim')
        return { success: false, error: 'invalid_request' }
      }

      // Replay protection: reject tokens with previously seen jti
      if (this._isReplayedJti(payload.jti)) {
        Logger.warn(`[BackchannelLogout] Replayed jti=${payload.jti}`)
        return { success: false, error: 'invalid_request' }
      }

      // Spec: logout token MUST NOT contain a nonce claim
      if (payload.nonce !== undefined) {
        Logger.warn('[BackchannelLogout] Token contains nonce claim (not allowed)')
        return { success: false, error: 'invalid_request' }
      }

      const sub = payload.sub
      const sid = payload.sid

      // Spec: token MUST contain sub, sid, or both
      if (!sub && !sid) {
        Logger.warn('[BackchannelLogout] Token contains neither sub nor sid')
        return { success: false, error: 'invalid_request' }
      }

      // Destroy sessions and notify clients
      if (sid) {
        // Session-level logout: destroy sessions matching the OIDC session ID
        const destroyedCount = await Database.sessionModel.destroy({ where: { oidcSessionId: sid } })
        if (destroyedCount === 0) {
          Logger.warn(`[BackchannelLogout] No sessions found for sid=${sid} (session may predate oidcSessionId migration)`)
        } else {
          Logger.info(`[BackchannelLogout] Destroyed ${destroyedCount} session(s) for sid=${sid}`)
        }
      }

      if (sub) {
        const user = await Database.userModel.getUserByOpenIDSub(sub)
        if (user) {
          if (!sid) {
            // User-level logout (no sid): destroy all sessions for this user
            const destroyedCount = await Database.sessionModel.destroy({ where: { userId: user.id } })
            Logger.info(`[BackchannelLogout] Destroyed ${destroyedCount} session(s) for user=${user.username} (sub=${sub})`)
          }

          // Notify connected clients to redirect to login
          SocketAuthority.clientEmitter(user.id, 'backchannel_logout', {})
        } else {
          // Per spec, unknown sub is not an error — the user may have been deleted
          Logger.warn(`[BackchannelLogout] No user found for sub=${sub}`)
        }
      }

      return { success: true }
    } catch (error) {
      Logger.error(`[BackchannelLogout] Token validation failed: ${error.message}`)
      return { success: false, error: 'invalid_request' }
    }
  }
}

module.exports = BackchannelLogoutHandler
