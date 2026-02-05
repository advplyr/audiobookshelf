const { Request, Response } = require('express')
const OpenIDClient = require('openid-client')
const axios = require('axios')
const Database = require('../Database')
const Logger = require('../Logger')
const AuthError = require('./AuthError')

/**
 * OpenID Connect authentication strategy (no Passport wrapper)
 */
class OidcAuthStrategy {
  constructor() {
    this.client = null
    // Map of openId sessions indexed by oauth2 state-variable
    this.openIdAuthSession = new Map()
  }

  /**
   * Get the OpenID Connect client
   * @returns {OpenIDClient.Client}
   */
  getClient() {
    if (!this.client) {
      if (!Database.serverSettings.isOpenIDAuthSettingsValid) {
        throw new AuthError('OpenID Connect settings are not valid', 500)
      }

      // Custom req timeout see: https://github.com/panva/node-openid-client/blob/main/docs/README.md#customizing
      OpenIDClient.custom.setHttpOptionsDefaults({ timeout: 10000 })

      const openIdIssuerClient = new OpenIDClient.Issuer({
        issuer: global.ServerSettings.authOpenIDIssuerURL,
        authorization_endpoint: global.ServerSettings.authOpenIDAuthorizationURL,
        token_endpoint: global.ServerSettings.authOpenIDTokenURL,
        userinfo_endpoint: global.ServerSettings.authOpenIDUserInfoURL,
        jwks_uri: global.ServerSettings.authOpenIDJwksURL,
        end_session_endpoint: global.ServerSettings.authOpenIDLogoutURL
      }).Client

      this.client = new openIdIssuerClient({
        client_id: global.ServerSettings.authOpenIDClientID,
        client_secret: global.ServerSettings.authOpenIDClientSecret,
        id_token_signed_response_alg: global.ServerSettings.authOpenIDTokenSigningAlgorithm
      })
    }
    return this.client
  }

  /**
   * Get the scope string for the OpenID Connect request
   * @returns {string}
   */
  getScope() {
    return global.ServerSettings.authOpenIDScopes || 'openid profile email'
  }

  /**
   * Reload the OIDC strategy after settings change (replaces init/unuse)
   */
  reload() {
    this.client = null
    this.openIdAuthSession.clear()
    Logger.info('[OidcAuth] Settings reloaded')
  }

  /**
   * Clean up stale mobile auth sessions older than 10 minutes
   */
  cleanupStaleAuthSessions() {
    const maxAge = 10 * 60 * 1000 // 10 minutes
    const now = Date.now()
    for (const [state, session] of this.openIdAuthSession) {
      if (now - (session.created_at || 0) > maxAge) {
        this.openIdAuthSession.delete(state)
      }
    }
  }

  /**
   * Handle the OIDC callback - exchange auth code for tokens and verify user.
   * Replaces the passport authenticate + verifyCallback flow.
   *
   * @param {Request} req
   * @returns {Promise<import('../models/User')>} authenticated user
   * @throws {AuthError}
   */
  async handleCallback(req) {
    const sessionData = req.session.oidc
    if (!sessionData) {
      throw new AuthError('No OIDC session found', 400)
    }

    const client = this.getClient()

    // If the client sends a code_verifier in query, use it (mobile flow)
    const codeVerifier = req.query.code_verifier || sessionData.code_verifier

    // Exchange auth code for tokens
    const params = client.callbackParams(req)
    const tokenset = await client.callback(sessionData.sso_redirect_uri, params, {
      state: sessionData.state,
      code_verifier: codeVerifier,
      response_type: 'code'
    })

    // Fetch userinfo
    const userinfo = await client.userinfo(tokenset.access_token)

    // Verify and find/create user
    const user = await this.verifyUser(tokenset, userinfo)

    return user
  }

  /**
   * Verify user from OIDC token set and userinfo.
   * Returns user directly or throws AuthError.
   *
   * @param {Object} tokenset
   * @param {Object} userinfo
   * @returns {Promise<import('../models/User')>}
   * @throws {AuthError}
   */
  async verifyUser(tokenset, userinfo) {
    let isNewUser = false
    let user = null
    try {
      Logger.debug(`[OidcAuth] openid callback userinfo=`, JSON.stringify(userinfo, null, 2))

      if (!userinfo.sub) {
        throw new AuthError('Invalid userinfo, no sub', 401)
      }

      if (!this.validateGroupClaim(userinfo)) {
        throw new AuthError(`Group claim ${Database.serverSettings.authOpenIDGroupClaim} not found or empty in userinfo`, 401)
      }

      // Enforce email_verified check on every login if configured
      if (global.ServerSettings.authOpenIDRequireVerifiedEmail && userinfo.email_verified === false) {
        throw new AuthError('Email is not verified', 401)
      }

      user = await Database.userModel.findUserFromOpenIdUserInfo(userinfo)

      if (user?.error) {
        throw new AuthError('Invalid userinfo or already linked', 401)
      }

      if (!user) {
        // If no existing user was matched, auto-register if configured
        if (global.ServerSettings.authOpenIDAutoRegister) {
          Logger.info(`[User] openid: Auto-registering user with sub "${userinfo.sub}"`, userinfo)
          user = await Database.userModel.createUserFromOpenIdUserInfo(userinfo)
          isNewUser = true
        } else {
          Logger.warn(`[User] openid: User not found and auto-register is disabled`)
          throw new AuthError('User not found and auto-register is disabled', 401)
        }
      }

      if (!user.isActive) {
        throw new AuthError('User not active or not found', 401)
      }

      await this.setUserGroup(user, userinfo)
      await this.updateUserPermissions(user, userinfo)

      // Save the id_token for later (used for logout via DB session)
      user.openid_id_token = tokenset.id_token

      return user
    } catch (error) {
      Logger.error(`[OidcAuth] openid callback error: ${error?.message}\n${error?.stack}`)
      // Remove new user if an error occurs
      if (isNewUser && user) {
        await user.destroy()
      }
      if (error instanceof AuthError) {
        throw error
      }
      throw new AuthError(error.message || 'Unauthorized', 401)
    }
  }

  /**
   * Validates the presence and content of the group claim in userinfo.
   * @param {Object} userinfo
   * @returns {boolean}
   */
  validateGroupClaim(userinfo) {
    const groupClaimName = Database.serverSettings.authOpenIDGroupClaim
    if (!groupClaimName)
      // Allow no group claim when configured like this
      return true

    // If configured it must exist in userinfo
    if (!userinfo[groupClaimName]) {
      return false
    }
    return true
  }

  /**
   * Sets the user group based on group claim in userinfo.
   * Supports explicit group mapping via authOpenIDGroupMap or legacy direct name match.
   *
   * @param {import('../models/User')} user
   * @param {Object} userinfo
   */
  async setUserGroup(user, userinfo) {
    const groupClaimName = Database.serverSettings.authOpenIDGroupClaim
    if (!groupClaimName)
      // No group claim configured, don't set anything
      return

    if (!userinfo[groupClaimName]) throw new AuthError(`Group claim ${groupClaimName} not found in userinfo`, 401)

    const groupsList = userinfo[groupClaimName].map((group) => group.toLowerCase())
    const rolesInOrderOfPriority = ['admin', 'user', 'guest']
    const groupMap = global.ServerSettings.authOpenIDGroupMap || {}

    let userType = null

    if (Object.keys(groupMap).length > 0) {
      // Explicit group mapping: iterate roles in priority order, check if any mapped group names match
      for (const role of rolesInOrderOfPriority) {
        const mappedGroups = Object.entries(groupMap)
          .filter(([, v]) => v === role)
          .map(([k]) => k.toLowerCase())
        if (mappedGroups.some((g) => groupsList.includes(g))) {
          userType = role
          break
        }
      }
    } else {
      // Legacy direct name match
      userType = rolesInOrderOfPriority.find((role) => groupsList.includes(role))
    }

    if (userType) {
      if (user.type === 'root') {
        // Check OpenID Group
        if (userType !== 'admin') {
          throw new AuthError(`Root user "${user.username}" cannot be downgraded to ${userType}. Denying login.`, 403)
        } else {
          // If root user is logging in via OpenID, we will not change the type
          return
        }
      }

      if (user.type !== userType) {
        Logger.info(`[OidcAuth] openid callback: Updating user "${user.username}" type to "${userType}" from "${user.type}"`)
        user.type = userType
        await user.save()
      }
    } else {
      throw new AuthError(`No valid group found in userinfo: ${JSON.stringify(userinfo[groupClaimName], null, 2)}`, 401)
    }
  }

  /**
   * Updates user permissions based on the advanced permissions claim.
   * @param {import('../models/User')} user
   * @param {Object} userinfo
   */
  async updateUserPermissions(user, userinfo) {
    const absPermissionsClaim = Database.serverSettings.authOpenIDAdvancedPermsClaim
    if (!absPermissionsClaim)
      // No advanced permissions claim configured, don't set anything
      return

    if (user.type === 'admin' || user.type === 'root') return

    const absPermissions = userinfo[absPermissionsClaim]
    if (!absPermissions) throw new AuthError(`Advanced permissions claim ${absPermissionsClaim} not found in userinfo`, 401)

    if (await user.updatePermissionsFromExternalJSON(absPermissions)) {
      Logger.info(`[OidcAuth] openid callback: Updating advanced perms for user "${user.username}" using "${JSON.stringify(absPermissions)}"`)
    }
  }

  /**
   * Generate PKCE parameters for the authorization request
   * @param {Request} req
   * @param {boolean} isMobileFlow
   * @returns {Object|{error: string}}
   */
  generatePkce(req, isMobileFlow) {
    if (isMobileFlow) {
      if (!req.query.code_challenge) {
        return {
          error: 'code_challenge required for mobile flow (PKCE)'
        }
      }
      if (req.query.code_challenge_method && req.query.code_challenge_method !== 'S256') {
        return {
          error: 'Only S256 code_challenge_method method supported'
        }
      }
      return {
        code_challenge: req.query.code_challenge,
        code_challenge_method: req.query.code_challenge_method || 'S256'
      }
    } else {
      const code_verifier = OpenIDClient.generators.codeVerifier()
      const code_challenge = OpenIDClient.generators.codeChallenge(code_verifier)
      return { code_challenge, code_challenge_method: 'S256', code_verifier }
    }
  }

  /**
   * Check if a redirect URI is valid
   * @param {string} uri
   * @returns {boolean}
   */
  isValidRedirectUri(uri) {
    // Check if the redirect_uri is in the whitelist
    return Database.serverSettings.authOpenIDMobileRedirectURIs.includes(uri)
  }

  /**
   * Get the authorization URL for OpenID Connect
   * Calls client manually because the strategy does not support forwarding the code challenge for the mobile flow
   * @param {Request} req
   * @param {boolean} isMobileFlow - whether this is a mobile client flow (determined by caller)
   * @param {string|undefined} validatedCallback - pre-validated callback URL for web flow
   * @returns {{ authorizationUrl: string, isMobileFlow: boolean }|{status: number, error: string}}
   */
  getAuthorizationUrl(req, isMobileFlow, validatedCallback) {
    const client = this.getClient()

    try {
      const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
      const hostUrl = new URL(`${protocol}://${req.get('host')}`)

      // Only allow code flow (for mobile clients)
      if (req.query.response_type && req.query.response_type !== 'code') {
        Logger.debug(`[OidcAuth] OIDC Invalid response_type=${req.query.response_type}`)
        return {
          status: 400,
          error: 'Invalid response_type, only code supported'
        }
      }

      // Generate a state on web flow or if no state supplied
      const state = !isMobileFlow || !req.query.state ? OpenIDClient.generators.random() : req.query.state

      // Redirect URL for the SSO provider
      let redirectUri
      if (isMobileFlow) {
        // Mobile required redirect uri
        if (!req.query.redirect_uri || !this.isValidRedirectUri(req.query.redirect_uri)) {
          Logger.debug(`[OidcAuth] Invalid redirect_uri=${req.query.redirect_uri}`)
          return {
            status: 400,
            error: 'Invalid redirect_uri'
          }
        }
        // We cannot save the supplied redirect_uri in the session, because the mobile client uses browser instead of the API
        //   for the request to mobile-redirect and as such the session is not shared
        this.cleanupStaleAuthSessions()
        this.openIdAuthSession.set(state, { mobile_redirect_uri: req.query.redirect_uri, created_at: Date.now() })

        redirectUri = new URL(`${global.ServerSettings.authOpenIDSubfolderForRedirectURLs}/auth/openid/mobile-redirect`, hostUrl).toString()
      } else {
        redirectUri = new URL(`${global.ServerSettings.authOpenIDSubfolderForRedirectURLs}/auth/openid/callback`, hostUrl).toString()

        if (req.query.state) {
          Logger.debug(`[OidcAuth] Invalid state - not allowed on web openid flow`)
          return {
            status: 400,
            error: 'Invalid state, not allowed on web flow'
          }
        }
      }

      Logger.debug(`[OidcAuth] OIDC redirect_uri=${redirectUri}`)

      const pkceData = this.generatePkce(req, isMobileFlow)
      if (pkceData.error) {
        return {
          status: 400,
          error: pkceData.error
        }
      }

      // Store OIDC session data using fixed key 'oidc'
      req.session.oidc = {
        state: state,
        response_type: 'code',
        code_verifier: pkceData.code_verifier, // not null if web flow
        isMobile: !!isMobileFlow,
        sso_redirect_uri: redirectUri, // Save the redirect_uri (for the SSO Provider) for the callback
        callbackUrl: !isMobileFlow ? validatedCallback : undefined // web: pre-validated callback URL
      }

      const authorizationUrl = client.authorizationUrl({
        redirect_uri: redirectUri,
        state: state,
        response_type: 'code',
        scope: this.getScope(),
        code_challenge: pkceData.code_challenge,
        code_challenge_method: pkceData.code_challenge_method
      })

      return {
        authorizationUrl,
        isMobileFlow
      }
    } catch (error) {
      Logger.error(`[OidcAuth] Error generating authorization URL: ${error}\n${error?.stack}`)
      return {
        status: 500,
        error: error.message || 'Unknown error'
      }
    }
  }

  /**
   * Get the end session URL for logout
   * @param {Request} req
   * @param {string} idToken
   * @param {string} authMethod
   * @returns {string|null}
   */
  getEndSessionUrl(req, idToken, authMethod) {
    const client = this.getClient()

    if (client.issuer.end_session_endpoint && client.issuer.end_session_endpoint.length > 0) {
      let postLogoutRedirectUri = null

      if (authMethod === 'openid') {
        const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
        const host = req.get('host')
        postLogoutRedirectUri = `${protocol}://${host}${global.RouterBasePath}/login`
      }
      // else for openid-mobile we keep postLogoutRedirectUri on null
      //  The client/app can simply append something like
      //  &post_logout_redirect_uri=audiobookshelf://login to the received logout url

      return client.endSessionUrl({
        id_token_hint: idToken,
        post_logout_redirect_uri: postLogoutRedirectUri
      })
    }

    return null
  }

  /**
   * @typedef {Object} OpenIdIssuerConfig
   * @property {string} issuer
   * @property {string} authorization_endpoint
   * @property {string} token_endpoint
   * @property {string} userinfo_endpoint
   * @property {string} end_session_endpoint
   * @property {string} jwks_uri
   * @property {string} id_token_signing_alg_values_supported
   *
   * Get OpenID Connect configuration from an issuer URL
   * @param {string} issuerUrl
   * @returns {Promise<OpenIdIssuerConfig|{status: number, error: string}>}
   */
  async getIssuerConfig(issuerUrl) {
    // Strip trailing slash
    if (issuerUrl.endsWith('/')) issuerUrl = issuerUrl.slice(0, -1)

    // Append config pathname and validate URL
    let configUrl = null
    try {
      configUrl = new URL(`${issuerUrl}/.well-known/openid-configuration`)
      if (!configUrl.pathname.endsWith('/.well-known/openid-configuration')) {
        throw new Error('Invalid pathname')
      }
    } catch (error) {
      Logger.error(`[OidcAuth] Failed to get openid configuration. Invalid URL "${configUrl}"`, error)
      return {
        status: 400,
        error: "Invalid request. Query param 'issuer' is invalid"
      }
    }

    try {
      const { data } = await axios.get(configUrl.toString())
      return {
        issuer: data.issuer,
        authorization_endpoint: data.authorization_endpoint,
        token_endpoint: data.token_endpoint,
        userinfo_endpoint: data.userinfo_endpoint,
        end_session_endpoint: data.end_session_endpoint,
        jwks_uri: data.jwks_uri,
        id_token_signing_alg_values_supported: data.id_token_signing_alg_values_supported
      }
    } catch (error) {
      Logger.error(`[OidcAuth] Failed to get openid configuration at "${configUrl}"`, error)
      return {
        status: 400,
        error: 'Failed to get openid configuration'
      }
    }
  }

  /**
   * Handle mobile redirect for OAuth2 callback
   * @param {Request} req
   * @param {Response} res
   */
  handleMobileRedirect(req, res) {
    try {
      // Extract the state parameter from the request
      const { state, code } = req.query

      // Check if the state provided is in our list
      if (!state || !this.openIdAuthSession.has(state)) {
        Logger.error('[OidcAuth] /auth/openid/mobile-redirect route: State parameter mismatch')
        return res.status(400).send('State parameter mismatch')
      }

      let mobile_redirect_uri = this.openIdAuthSession.get(state).mobile_redirect_uri

      if (!mobile_redirect_uri) {
        Logger.error('[OidcAuth] No redirect URI')
        return res.status(400).send('No redirect URI')
      }

      this.openIdAuthSession.delete(state)

      const redirectUri = `${mobile_redirect_uri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      // Redirect to the overwrite URI saved in the map
      res.redirect(redirectUri)
    } catch (error) {
      Logger.error(`[OidcAuth] Error in /auth/openid/mobile-redirect route: ${error}\n${error?.stack}`)
      res.status(500).send('Internal Server Error')
    }
  }

  /**
   * Validates if a callback URL is safe for redirect (same-origin only)
   * @param {string} callbackUrl - The callback URL to validate
   * @param {Request} req - Express request object to get current host
   * @returns {boolean} - True if the URL is safe (same-origin), false otherwise
   */
  isValidWebCallbackUrl(callbackUrl, req) {
    if (!callbackUrl) return false

    try {
      // Handle relative URLs - these are always safe if they start with router base path
      if (callbackUrl.startsWith('/')) {
        // Only allow relative paths that start with the router base path
        if (callbackUrl.startsWith(global.RouterBasePath + '/')) {
          return true
        }
        Logger.warn(`[OidcAuth] Rejected callback URL outside router base path: ${callbackUrl}`)
        return false
      }

      // For absolute URLs, ensure they point to the same origin
      const callbackUrlObj = new URL(callbackUrl)
      // NPM appends both http and https in x-forwarded-proto sometimes, so we need to check for both
      const xfp = (req.get('x-forwarded-proto') || '').toLowerCase()
      const currentProtocol =
        req.secure ||
        xfp
          .split(',')
          .map((s) => s.trim())
          .includes('https')
          ? 'https'
          : 'http'
      const currentHost = req.get('host')

      // Check if protocol and host match exactly
      if (callbackUrlObj.protocol === currentProtocol + ':' && callbackUrlObj.host === currentHost) {
        // Additional check: ensure path starts with router base path
        if (callbackUrlObj.pathname.startsWith(global.RouterBasePath + '/')) {
          return true
        }
        Logger.warn(`[OidcAuth] Rejected same-origin callback URL outside router base path: ${callbackUrl}`)
        return false
      }

      Logger.warn(`[OidcAuth] Rejected callback URL to different origin: ${callbackUrl} (expected ${currentProtocol}://${currentHost})`)
      return false
    } catch (error) {
      Logger.error(`[OidcAuth] Invalid callback URL format: ${callbackUrl}`, error)
      return false
    }
  }
}

module.exports = OidcAuthStrategy
