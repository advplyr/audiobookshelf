const { Request, Response } = require('express')
const passport = require('passport')
const OpenIDClient = require('openid-client')
const axios = require('axios')
const Database = require('../Database')
const Logger = require('../Logger')

/**
 * OpenID Connect authentication strategy
 */
class OidcAuthStrategy {
  constructor() {
    this.name = 'openid-client'
    this.strategy = null
    this.client = null
    // Map of openId sessions indexed by oauth2 state-variable
    this.openIdAuthSession = new Map()
  }

  /**
   * Get the passport strategy instance
   * @returns {OpenIDClient.Strategy}
   */
  getStrategy() {
    if (!this.strategy) {
      this.strategy = new OpenIDClient.Strategy(
        {
          client: this.getClient(),
          params: {
            redirect_uri: `${global.ServerSettings.authOpenIDSubfolderForRedirectURLs}/auth/openid/callback`,
            scope: this.getScope()
          }
        },
        this.verifyCallback.bind(this)
      )
    }
    return this.strategy
  }

  /**
   * Get the OpenID Connect client
   * @returns {OpenIDClient.Client}
   */
  getClient() {
    if (!this.client) {
      if (!Database.serverSettings.isOpenIDAuthSettingsValid) {
        throw new Error('OpenID Connect settings are not valid')
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
    let scope = 'openid profile email'
    if (global.ServerSettings.authOpenIDGroupClaim) {
      scope += ' ' + global.ServerSettings.authOpenIDGroupClaim
    }
    if (global.ServerSettings.authOpenIDAdvancedPermsClaim) {
      scope += ' ' + global.ServerSettings.authOpenIDAdvancedPermsClaim
    }
    return scope
  }

  /**
   * Initialize the strategy with passport
   */
  init() {
    if (!Database.serverSettings.isOpenIDAuthSettingsValid) {
      Logger.error(`[OidcAuth] Cannot init openid auth strategy - invalid settings`)
      return
    }
    passport.use(this.name, this.getStrategy())
  }

  /**
   * Remove the strategy from passport
   */
  unuse() {
    passport.unuse(this.name)
    this.strategy = null
    this.client = null
  }

  /**
   * Verify callback for OpenID Connect authentication
   * @param {Object} tokenset
   * @param {Object} userinfo
   * @param {Function} done - Passport callback
   */
  async verifyCallback(tokenset, userinfo, done) {
    let isNewUser = false
    let user = null
    try {
      Logger.debug(`[OidcAuth] openid callback userinfo=`, JSON.stringify(userinfo, null, 2))

      if (!userinfo.sub) {
        throw new Error('Invalid userinfo, no sub')
      }

      if (!this.validateGroupClaim(userinfo)) {
        throw new Error(`Group claim ${Database.serverSettings.authOpenIDGroupClaim} not found or empty in userinfo`)
      }

      user = await Database.userModel.findUserFromOpenIdUserInfo(userinfo)

      if (user?.error) {
        throw new Error('Invalid userinfo or already linked')
      }

      if (!user) {
        // If no existing user was matched, auto-register if configured
        if (global.ServerSettings.authOpenIDAutoRegister) {
          Logger.info(`[User] openid: Auto-registering user with sub "${userinfo.sub}"`, userinfo)
          user = await Database.userModel.createUserFromOpenIdUserInfo(userinfo)
          isNewUser = true
        } else {
          Logger.warn(`[User] openid: User not found and auto-register is disabled`)
        }
      }

      if (!user.isActive) {
        throw new Error('User not active or not found')
      }

      await this.setUserGroup(user, userinfo)
      await this.updateUserPermissions(user, userinfo)

      // We also have to save the id_token for later (used for logout) because we cannot set cookies here
      user.openid_id_token = tokenset.id_token

      return done(null, user)
    } catch (error) {
      Logger.error(`[OidcAuth] openid callback error: ${error?.message}\n${error?.stack}`)
      // Remove new user if an error occurs
      if (isNewUser && user) {
        await user.destroy()
      }
      return done(null, null, 'Unauthorized')
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
   * @param {import('../models/User')} user
   * @param {Object} userinfo
   */
  async setUserGroup(user, userinfo) {
    const groupClaimName = Database.serverSettings.authOpenIDGroupClaim
    if (!groupClaimName)
      // No group claim configured, don't set anything
      return

    if (!userinfo[groupClaimName]) throw new Error(`Group claim ${groupClaimName} not found in userinfo`)

    const groupsList = userinfo[groupClaimName].map((group) => group.toLowerCase())
    const rolesInOrderOfPriority = ['admin', 'user', 'guest']

    let userType = rolesInOrderOfPriority.find((role) => groupsList.includes(role))
    if (userType) {
      if (user.type === 'root') {
        // Check OpenID Group
        if (userType !== 'admin') {
          throw new Error(`Root user "${user.username}" cannot be downgraded to ${userType}. Denying login.`)
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
      throw new Error(`No valid group found in userinfo: ${JSON.stringify(userinfo[groupClaimName], null, 2)}`)
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
    if (!absPermissions) throw new Error(`Advanced permissions claim ${absPermissionsClaim} not found in userinfo`)

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
    return Database.serverSettings.authOpenIDMobileRedirectURIs.includes(uri) || (Database.serverSettings.authOpenIDMobileRedirectURIs.length === 1 && Database.serverSettings.authOpenIDMobileRedirectURIs[0] === '*')
  }

  /**
   * Get the authorization URL for OpenID Connect
   * Calls client manually because the strategy does not support forwarding the code challenge for the mobile flow
   * @param {Request} req
   * @returns {{ authorizationUrl: string }|{status: number, error: string}}
   */
  getAuthorizationUrl(req) {
    const client = this.getClient()
    const strategy = this.getStrategy()
    const sessionKey = strategy._key

    try {
      const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
      const hostUrl = new URL(`${protocol}://${req.get('host')}`)
      const isMobileFlow = req.query.response_type === 'code' || req.query.redirect_uri || req.query.code_challenge

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
        // If it is in the whitelist, we will save into this.openIdAuthSession and set the redirect uri to /auth/openid/mobile-redirect
        //    where we will handle the redirect to it
        if (!req.query.redirect_uri || !this.isValidRedirectUri(req.query.redirect_uri)) {
          Logger.debug(`[OidcAuth] Invalid redirect_uri=${req.query.redirect_uri}`)
          return {
            status: 400,
            error: 'Invalid redirect_uri'
          }
        }
        // We cannot save the supplied redirect_uri in the session, because it the mobile client uses browser instead of the API
        //   for the request to mobile-redirect and as such the session is not shared
        this.openIdAuthSession.set(state, { mobile_redirect_uri: req.query.redirect_uri })

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

      // Update the strategy's redirect_uri for this request
      strategy._params.redirect_uri = redirectUri
      Logger.debug(`[OidcAuth] OIDC redirect_uri=${redirectUri}`)

      const pkceData = this.generatePkce(req, isMobileFlow)
      if (pkceData.error) {
        return {
          status: 400,
          error: pkceData.error
        }
      }

      req.session[sessionKey] = {
        ...req.session[sessionKey],
        state: state,
        max_age: strategy._params.max_age,
        response_type: 'code',
        code_verifier: pkceData.code_verifier, // not null if web flow
        mobile: req.query.redirect_uri, // Used in the abs callback later, set mobile if redirect_uri is filled out
        sso_redirect_uri: redirectUri // Save the redirect_uri (for the SSO Provider) for the callback
      }

      const authorizationUrl = client.authorizationUrl({
        ...strategy._params,
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
        // TODO: ABS does currently not support subfolders for installation
        // If we want to support it we need to include a config for the serverurl
        postLogoutRedirectUri = `${protocol}://${host}${global.RouterBasePath}/login`
      }
      // else for openid-mobile we keep postLogoutRedirectUri on null
      //  nice would be to redirect to the app here, but for example Authentik does not implement
      //  the post_logout_redirect_uri parameter at all and for other providers
      //  we would also need again to implement (and even before get to know somehow for 3rd party apps)
      //  the correct app link like audiobookshelf://login (and maybe also provide a redirect like mobile-redirect).
      //   Instead because its null (and this way the parameter will be omitted completly), the client/app can simply append something like
      //  &post_logout_redirect_uri=audiobookshelf://login to the received logout url by itself which is the simplest solution
      //   (The URL needs to be whitelisted in the config of the SSO/ID provider)

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
