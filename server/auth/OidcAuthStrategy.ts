import { LRUCache } from 'lru-cache'
import type { Request, Response } from 'express'
import passport from 'passport'
import * as OpenIDClient from 'openid-client'
import type { AuthorizationParameters, Client, TokenSet, UserinfoResponse } from 'openid-client'
import axios from 'axios'
import { z } from 'zod'
import Database from '../Database'
import Logger from '../Logger'
import { getRequestOrigin } from '../utils/requestUtils'
import type ServerSettings from '../objects/settings/ServerSettings'
import type User from '../models/User'

declare global {
  var RouterBasePath: string
}

type SettingsJson = ReturnType<ServerSettings['toJSON']>
type OidcUser = User & { openid_id_token?: string }
type VerifyDone = (err: unknown, user?: User | null, info?: string) => void

type OidcStrategy = OpenIDClient.Strategy<User, Client> & {
  _key: string
  _params: AuthorizationParameters
}

type MobileLogin = { mobile_redirect_uri: string }

type OpenIdSession = {
  state?: unknown
  max_age?: number
  response_type?: string
  code_verifier?: string
  mobile?: unknown
  sso_redirect_uri?: string
}

type SessionRequest = Request & {
  session: Record<string, OpenIdSession | undefined>
}

type PkceResult = { code_challenge: string; code_challenge_method: string; code_verifier?: string } | { error: string }

type AuthorizationResult = { authorizationUrl: string; isMobileFlow: boolean } | { status: number; error: string }

type OpenIdIssuerConfig = {
  issuer: unknown
  authorization_endpoint: unknown
  token_endpoint: unknown
  userinfo_endpoint: unknown
  end_session_endpoint: unknown
  jwks_uri: unknown
  id_token_signing_alg_values_supported: unknown
}

type OpenIdIssuerResult = OpenIdIssuerConfig | { status: number; error: string }

// Loose userinfo: only sub is required for login. Other claims stay on the original object.
const openIdUserInfoSchema = z.looseObject({
  sub: z.custom((value) => !!value)
})

const openIdIssuerConfigSchema = z.looseObject({
  issuer: z.unknown().optional(),
  authorization_endpoint: z.unknown().optional(),
  token_endpoint: z.unknown().optional(),
  userinfo_endpoint: z.unknown().optional(),
  end_session_endpoint: z.unknown().optional(),
  jwks_uri: z.unknown().optional(),
  id_token_signing_alg_values_supported: z.unknown().optional()
})

function settingsJson(): SettingsJson {
  return global.ServerSettings as SettingsJson
}

function requiredSetting(value: string | null | undefined): string {
  if (!value) throw new Error('OpenID Connect settings are not valid')
  return value
}

function queryValue(req: Request, name: string): unknown {
  return req.query[name]
}

function queryText(value: unknown): string {
  return value as string
}

function stringValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || typeof value === 'symbol' || value == null) {
    return String(value)
  }
  return Object.prototype.toString.call(value)
}

function claimsOf(userinfo: object): Record<string, unknown> {
  return userinfo as Record<string, unknown>
}

function isOpenIdLinkError(value: User | { error: string } | null): value is { error: string } {
  if (!value || typeof value !== 'object' || !('error' in value)) return false
  return Boolean(value.error)
}

function errorText(error: unknown): string {
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : String(message)
}

function errorStack(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('stack' in error)) return undefined
  return error.stack
}

/**
 * OpenID Connect authentication strategy
 */
class OidcAuthStrategy {
  name: string
  declare strategy: OidcStrategy | null
  declare client: Client | null
  openIdAuthSession: LRUCache<string, MobileLogin>

  constructor() {
    this.name = 'openid-client'
    this.strategy = null
    this.client = null
    // Map of openId sessions indexed by oauth2 state-variable
    this.openIdAuthSession = new LRUCache<string, MobileLogin>({
      ttl: 10 * 60 * 1000,
      ttlAutopurge: true
    })
  }

  /**
   * Get the passport strategy instance
   */
  getStrategy(): OidcStrategy {
    if (!this.strategy) {
      const settings = settingsJson()
      const strategy = new OpenIDClient.Strategy(
        {
          client: this.getClient(),
          params: {
            redirect_uri: `${settings.authOpenIDSubfolderForRedirectURLs}/auth/openid/callback`,
            scope: this.getScope()
          }
        },
        (tokenset: TokenSet, userinfo: UserinfoResponse, done: VerifyDone) => {
          void this.verifyCallback(tokenset, userinfo, done)
        }
      )
      this.strategy = strategy as OidcStrategy
    }
    return this.strategy
  }

  /**
   * Get the OpenID Connect client
   */
  getClient(): Client {
    if (!this.client) {
      if (!Database.serverSettings!.isOpenIDAuthSettingsValid) {
        throw new Error('OpenID Connect settings are not valid')
      }

      const settings = settingsJson()

      // Custom req timeout see: https://github.com/panva/node-openid-client/blob/main/docs/README.md#customizing
      OpenIDClient.custom.setHttpOptionsDefaults({ timeout: 10000 })

      const openIdIssuerClient = new OpenIDClient.Issuer({
        issuer: requiredSetting(settings.authOpenIDIssuerURL),
        authorization_endpoint: requiredSetting(settings.authOpenIDAuthorizationURL),
        token_endpoint: requiredSetting(settings.authOpenIDTokenURL),
        userinfo_endpoint: requiredSetting(settings.authOpenIDUserInfoURL),
        jwks_uri: requiredSetting(settings.authOpenIDJwksURL),
        end_session_endpoint: settings.authOpenIDLogoutURL as string | undefined
      }).Client

      this.client = new openIdIssuerClient({
        client_id: requiredSetting(settings.authOpenIDClientID),
        client_secret: requiredSetting(settings.authOpenIDClientSecret),
        id_token_signed_response_alg: settings.authOpenIDTokenSigningAlgorithm
      })
    }
    return this.client
  }

  /**
   * Get the scope string for the OpenID Connect request
   */
  getScope(): string {
    const settings = settingsJson()
    let scope = 'openid profile email'
    if (settings.authOpenIDGroupClaim) {
      scope += ' ' + settings.authOpenIDGroupClaim
    }
    if (settings.authOpenIDAdvancedPermsClaim) {
      scope += ' ' + settings.authOpenIDAdvancedPermsClaim
    }
    return scope
  }

  /**
   * Initialize the strategy with passport
   */
  init() {
    if (!Database.serverSettings!.isOpenIDAuthSettingsValid) {
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
   */
  async verifyCallback(tokenset: TokenSet, userinfo: UserinfoResponse, done: VerifyDone) {
    let isNewUser = false
    let user: User | null = null
    try {
      Logger.debug(`[OidcAuth] openid callback userinfo=`, JSON.stringify(userinfo, null, 2))

      // Property access preserves the original TypeError when userinfo is missing.
      const subject = (userinfo as { sub?: unknown }).sub
      if (!subject) {
        throw new Error('Invalid userinfo, no sub')
      }
      const parsedUserInfo = openIdUserInfoSchema.safeParse(userinfo)
      if (!parsedUserInfo.success) {
        throw new Error('Invalid userinfo, no sub')
      }

      if (!this.validateGroupClaim(userinfo)) {
        throw new Error(`Group claim ${Database.serverSettings!.authOpenIDGroupClaim} not found or empty in userinfo`)
      }

      const matched = await Database.userModel.findUserFromOpenIdUserInfo(userinfo)

      if (isOpenIdLinkError(matched)) {
        throw new Error('Invalid userinfo or already linked')
      }

      user = matched

      if (!user) {
        // If no existing user was matched, auto-register if configured
        if (settingsJson().authOpenIDAutoRegister) {
          Logger.info(`[User] openid: Auto-registering user with sub "${userinfo.sub}"`, userinfo)
          user = await Database.userModel.createUserFromOpenIdUserInfo(userinfo)
          isNewUser = true
        } else {
          Logger.warn(`[User] openid: User not found and auto-register is disabled`)
        }
      }

      // A missing user still throws on the isActive read, matching the previous callback.
      const activeUser = user as User
      if (!activeUser.isActive) {
        throw new Error('User not active or not found')
      }

      await this.setUserGroup(activeUser, userinfo)
      await this.updateUserPermissions(activeUser, userinfo)

      // We also have to save the id_token for later (used for logout) because we cannot set cookies here
      const oidcUser: OidcUser = activeUser
      oidcUser.openid_id_token = tokenset.id_token

      return done(null, activeUser)
    } catch (error) {
      Logger.error(`[OidcAuth] openid callback error: ${String((error as { message?: unknown })?.message)}\n${String(errorStack(error))}`)
      // Remove new user if an error occurs
      if (isNewUser && user) {
        await user.destroy()
      }
      return done(null, null, 'Unauthorized')
    }
  }

  /**
   * Validates the presence and content of the group claim in userinfo.
   */
  validateGroupClaim(userinfo: UserinfoResponse): boolean {
    const groupClaimName = Database.serverSettings!.authOpenIDGroupClaim
    if (!groupClaimName)
      // Allow no group claim when configured like this
      return true

    // If configured it must exist in userinfo
    if (!claimsOf(userinfo)[groupClaimName]) {
      return false
    }
    return true
  }

  /**
   * Sets the user group based on group claim in userinfo.
   */
  async setUserGroup(user: User, userinfo: UserinfoResponse) {
    const groupClaimName = Database.serverSettings!.authOpenIDGroupClaim
    if (!groupClaimName)
      // No group claim configured, don't set anything
      return

    const groupClaim = claimsOf(userinfo)[groupClaimName]
    if (!groupClaim) throw new Error(`Group claim ${groupClaimName} not found in userinfo`)

    const groups = groupClaim as { toLowerCase(): string }[]
    const groupsList = groups.map((group) => group.toLowerCase())
    const rolesInOrderOfPriority = ['admin', 'user', 'guest']

    const userType = rolesInOrderOfPriority.find((role) => groupsList.includes(role))
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
      throw new Error(`No valid group found in userinfo: ${JSON.stringify(groupClaim, null, 2)}`)
    }
  }

  /**
   * Updates user permissions based on the advanced permissions claim.
   */
  async updateUserPermissions(user: User, userinfo: UserinfoResponse) {
    const absPermissionsClaim = Database.serverSettings!.authOpenIDAdvancedPermsClaim
    if (!absPermissionsClaim)
      // No advanced permissions claim configured, don't set anything
      return

    if (user.type === 'admin' || user.type === 'root') return

    const absPermissions = claimsOf(userinfo)[absPermissionsClaim]
    if (!absPermissions) throw new Error(`Advanced permissions claim ${absPermissionsClaim} not found in userinfo`)

    if (await user.updatePermissionsFromExternalJSON(absPermissions as { [key: string]: unknown; allowedLibraries?: unknown[]; allowedTags?: unknown[] })) {
      Logger.info(`[OidcAuth] openid callback: Updating advanced perms for user "${user.username}" using "${JSON.stringify(absPermissions)}"`)
    }
  }

  /**
   * Generate PKCE parameters for the authorization request
   */
  generatePkce(req: Request, isMobileFlow: boolean): PkceResult {
    if (isMobileFlow) {
      const codeChallenge = queryValue(req, 'code_challenge')
      const challengeMethod = queryValue(req, 'code_challenge_method')
      if (!codeChallenge) {
        return {
          error: 'code_challenge required for mobile flow (PKCE)'
        }
      }
      if (challengeMethod && challengeMethod !== 'S256') {
        return {
          error: 'Only S256 code_challenge_method method supported'
        }
      }
      return {
        code_challenge: queryText(codeChallenge),
        code_challenge_method: queryText(challengeMethod || 'S256')
      }
    } else {
      const code_verifier = OpenIDClient.generators.codeVerifier()
      const code_challenge = OpenIDClient.generators.codeChallenge(code_verifier)
      return { code_challenge, code_challenge_method: 'S256', code_verifier }
    }
  }

  /**
   * Check if a redirect URI is valid
   */
  isValidRedirectUri(uri: string): boolean {
    const redirectUris = Database.serverSettings!.authOpenIDMobileRedirectURIs
    // Check if the redirect_uri is in the whitelist
    return redirectUris.includes(uri) || (redirectUris.length === 1 && redirectUris[0] === '*')
  }

  /**
   * Get the authorization URL for OpenID Connect
   * Calls client manually because the strategy does not support forwarding the code challenge for the mobile flow
   */
  getAuthorizationUrl(req: Request): AuthorizationResult {
    const client = this.getClient()
    const strategy = this.getStrategy()
    const sessionKey = strategy._key
    const sessionRequest = req as SessionRequest

    try {
      const { origin } = getRequestOrigin(req)
      const hostUrl = new URL(origin)
      const responseType = queryValue(req, 'response_type')
      const redirectUriQuery = queryValue(req, 'redirect_uri')
      const stateQuery = queryValue(req, 'state')
      const isMobileFlow = Boolean(responseType === 'code' || redirectUriQuery || queryValue(req, 'code_challenge'))
      const settings = settingsJson()

      // Only allow code flow (for mobile clients)
      if (responseType && responseType !== 'code') {
        Logger.debug(`[OidcAuth] OIDC Invalid response_type=${stringValue(responseType)}`)
        return {
          status: 400,
          error: 'Invalid response_type, only code supported'
        }
      }

      // Generate a state on web flow or if no state supplied
      const state = (!isMobileFlow || !stateQuery ? OpenIDClient.generators.random() : stateQuery) as string

      // Redirect URL for the SSO provider
      let redirectUri: string
      if (isMobileFlow) {
        // Mobile required redirect uri
        // If it is in the whitelist, we will save into this.openIdAuthSession and set the redirect uri to /auth/openid/mobile-redirect
        //    where we will handle the redirect to it
        if (!redirectUriQuery || !this.isValidRedirectUri(queryText(redirectUriQuery))) {
          Logger.debug(`[OidcAuth] Invalid redirect_uri=${String(redirectUriQuery)}`)
          return {
            status: 400,
            error: 'Invalid redirect_uri'
          }
        }
        // We cannot save the supplied redirect_uri in the session, because it the mobile client uses browser instead of the API
        //   for the request to mobile-redirect and as such the session is not shared
        this.openIdAuthSession.set(state, { mobile_redirect_uri: queryText(redirectUriQuery) })

        redirectUri = new URL(`${settings.authOpenIDSubfolderForRedirectURLs}/auth/openid/mobile-redirect`, hostUrl).toString()
      } else {
        redirectUri = new URL(`${settings.authOpenIDSubfolderForRedirectURLs}/auth/openid/callback`, hostUrl).toString()

        if (stateQuery) {
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
      if ('error' in pkceData) {
        return {
          status: 400,
          error: pkceData.error
        }
      }

      sessionRequest.session[sessionKey] = {
        ...sessionRequest.session[sessionKey],
        state: state,
        max_age: strategy._params.max_age,
        response_type: 'code',
        code_verifier: pkceData.code_verifier, // not null if web flow
        mobile: redirectUriQuery, // Used in the abs callback later, set mobile if redirect_uri is filled out
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
      Logger.error(`[OidcAuth] Error generating authorization URL: ${String(error)}\n${String(errorStack(error))}`)
      return {
        status: 500,
        error: errorText(error) || 'Unknown error'
      }
    }
  }

  /**
   * Get the end session URL for logout
   */
  getEndSessionUrl(req: Request, idToken: string | undefined, authMethod: string): string | null {
    const client = this.getClient()
    const endpoint = client.issuer.end_session_endpoint as { length: number } | string | null | undefined

    if (endpoint && endpoint.length > 0) {
      let postLogoutRedirectUri: string | null = null

      if (authMethod === 'openid') {
        const { origin } = getRequestOrigin(req)
        // TODO: ABS does currently not support subfolders for installation
        // If we want to support it we need to include a config for the serverurl
        postLogoutRedirectUri = `${origin}${global.RouterBasePath}/login`
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
      } as OpenIDClient.EndSessionParameters)
    }

    return null
  }

  /**
   * Get OpenID Connect configuration from an issuer URL
   */
  async getIssuerConfig(issuerUrl: string): Promise<OpenIdIssuerResult> {
    // Strip trailing slash
    if (issuerUrl.endsWith('/')) issuerUrl = issuerUrl.slice(0, -1)

    // Append config pathname and validate URL
    let configUrl: URL | null = null
    try {
      configUrl = new URL(`${issuerUrl}/.well-known/openid-configuration`)
      if (!configUrl.pathname.endsWith('/.well-known/openid-configuration')) {
        throw new Error('Invalid pathname')
      }
    } catch (error) {
      Logger.error(`[OidcAuth] Failed to get openid configuration. Invalid URL "${String(configUrl)}"`, error)
      return {
        status: 400,
        error: "Invalid request. Query param 'issuer' is invalid"
      }
    }

    try {
      const { data } = await axios.get<unknown>(configUrl.toString())
      const parsed = openIdIssuerConfigSchema.safeParse(data)
      // Keep the axios payload. Zod only checks that a loose object was returned.
      const config = (parsed.success ? data : data) as OpenIdIssuerConfig
      return {
        issuer: config.issuer,
        authorization_endpoint: config.authorization_endpoint,
        token_endpoint: config.token_endpoint,
        userinfo_endpoint: config.userinfo_endpoint,
        end_session_endpoint: config.end_session_endpoint,
        jwks_uri: config.jwks_uri,
        id_token_signing_alg_values_supported: config.id_token_signing_alg_values_supported
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
   */
  handleMobileRedirect(req: Request, res: Response) {
    try {
      // Extract the state parameter from the request
      const state = queryValue(req, 'state')
      const code = queryValue(req, 'code')

      // Check if the state provided is in our list
      if (!state || !this.openIdAuthSession.has(queryText(state))) {
        Logger.error('[OidcAuth] /auth/openid/mobile-redirect route: State parameter mismatch')
        return res.status(400).send('State parameter mismatch')
      }

      const mobileLogin = this.openIdAuthSession.get(queryText(state))
      const mobile_redirect_uri = mobileLogin!.mobile_redirect_uri

      if (!mobile_redirect_uri) {
        Logger.error('[OidcAuth] No redirect URI')
        return res.status(400).send('No redirect URI')
      }

      this.openIdAuthSession.delete(queryText(state))

      const redirectUri = `${mobile_redirect_uri}?code=${encodeURIComponent(stringValue(code))}&state=${encodeURIComponent(stringValue(state))}`
      // Redirect to the overwrite URI saved in the map
      res.redirect(redirectUri)
    } catch (error) {
      Logger.error(`[OidcAuth] Error in /auth/openid/mobile-redirect route: ${String(error)}\n${String(errorStack(error))}`)
      res.status(500).send('Internal Server Error')
    }
  }

  /**
   * Validates if a callback URL is safe for redirect (same-origin only)
   */
  isValidWebCallbackUrl(callbackUrl: unknown, req: Request): boolean {
    if (!callbackUrl) return false

    const callback = callbackUrl as string

    try {
      // Reject protocol-relative (//host) and backslash-prefixed (/\host) values,
      // which browsers resolve to a cross-origin absolute URL.
      if (callback.startsWith('//') || callback.startsWith('/\\')) {
        Logger.warn(`[OidcAuth] Rejected protocol-relative callback URL: ${callback}`)
        return false
      }

      const { origin: serverOrigin } = getRequestOrigin(req)
      const resolvedUrl = callback.startsWith('/') ? new URL(callback, serverOrigin) : new URL(callback)

      if (resolvedUrl.origin !== serverOrigin) {
        Logger.warn(`[OidcAuth] Rejected callback URL to different origin: ${callback} (expected ${serverOrigin})`)
        return false
      }

      const pathname = decodeURIComponent(resolvedUrl.pathname)
      if (pathname.startsWith('//') || pathname.startsWith('/\\')) {
        Logger.warn(`[OidcAuth] Rejected protocol-relative callback URL path: ${callback}`)
        return false
      }

      if (!resolvedUrl.pathname.startsWith(global.RouterBasePath + '/')) {
        Logger.warn(`[OidcAuth] Rejected callback URL outside router base path: ${callback}`)
        return false
      }

      return true
    } catch (error) {
      Logger.error(`[OidcAuth] Invalid callback URL format: ${stringValue(callbackUrl)}`, error)
      return false
    }
  }
}

export = OidcAuthStrategy
