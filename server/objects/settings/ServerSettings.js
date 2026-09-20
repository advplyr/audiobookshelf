const Path = require('path')
const packageJson = require('../../../package.json')
const { BookshelfView } = require('../../utils/constants')
const Logger = require('../../Logger')
const User = require('../../models/User')
const { sanitize } = require('../../utils/htmlSanitizer')

const OPENID_ENV_SETTINGS = {
  AUTH_OPENID_ISSUER_URL: 'authOpenIDIssuerURL',
  AUTH_OPENID_AUTHORIZATION_URL: 'authOpenIDAuthorizationURL',
  AUTH_OPENID_TOKEN_URL: 'authOpenIDTokenURL',
  AUTH_OPENID_USERINFO_URL: 'authOpenIDUserInfoURL',
  AUTH_OPENID_JWKS_URL: 'authOpenIDJwksURL',
  AUTH_OPENID_LOGOUT_URL: 'authOpenIDLogoutURL',
  AUTH_OPENID_CLIENT_ID: 'authOpenIDClientID',
  AUTH_OPENID_CLIENT_SECRET: 'authOpenIDClientSecret',
  AUTH_OPENID_TOKEN_SIGNING_ALGORITHM: 'authOpenIDTokenSigningAlgorithm',
  AUTH_OPENID_BUTTON_TEXT: 'authOpenIDButtonText',
  AUTH_OPENID_AUTO_LAUNCH: 'authOpenIDAutoLaunch',
  AUTH_OPENID_AUTO_REGISTER: 'authOpenIDAutoRegister',
  AUTH_OPENID_MATCH_EXISTING_BY: 'authOpenIDMatchExistingBy',
  AUTH_OPENID_MOBILE_REDIRECT_URIS: 'authOpenIDMobileRedirectURIs',
  AUTH_OPENID_GROUP_CLAIM: 'authOpenIDGroupClaim',
  AUTH_OPENID_ADVANCED_PERMS_CLAIM: 'authOpenIDAdvancedPermsClaim',
  AUTH_OPENID_SUBFOLDER_FOR_REDIRECT_URLS: 'authOpenIDSubfolderForRedirectURLs'
}
const OPENID_ENV_KEYS = Object.keys(OPENID_ENV_SETTINGS)
const OPENID_SETTINGS_KEYS = Object.values(OPENID_ENV_SETTINGS)
const REQUIRED_OPENID_ENV_KEYS = [
  'AUTH_OPENID_ISSUER_URL',
  'AUTH_OPENID_AUTHORIZATION_URL',
  'AUTH_OPENID_TOKEN_URL',
  'AUTH_OPENID_USERINFO_URL',
  'AUTH_OPENID_JWKS_URL',
  'AUTH_OPENID_CLIENT_ID',
  'AUTH_OPENID_CLIENT_SECRET'
]
const OPENID_REDIRECT_URI_PATTERN = /^\w+:\/\/[\w.-]+(\/[\w./-]*)*$/i
const OPENID_CLAIM_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/

const PATCHABLE_SETTINGS_KEYS = new Set([
  'scannerParseSubtitle',
  'scannerFindCovers',
  'scannerCoverProvider',
  'scannerPreferMatchedMetadata',
  'scannerDisableWatcher',
  'storeCoverWithItem',
  'storeMetadataWithItem',
  'allowIframe',
  'allowedOrigins',
  'backupSchedule',
  'backupsToKeep',
  'maxBackupSize',
  'logLevel',
  'homeBookshelfView',
  'bookshelfView',
  'dateFormat',
  'timeFormat',
  'language',
  'chromecastEnabled',
  'sortingIgnorePrefix'
])

class ServerSettings {
  static patchableSettingsKeys = PATCHABLE_SETTINGS_KEYS
  static OPENID_ENV_KEYS = OPENID_ENV_KEYS
  constructor(settings) {
    this.id = 'server-settings'
    /** @type {string} JWT secret key ONLY used when JWT_SECRET_KEY is not set in ENV */
    this.tokenSecret = null

    // Scanner
    this.scannerParseSubtitle = false
    this.scannerFindCovers = false
    this.scannerCoverProvider = 'google'
    this.scannerPreferMatchedMetadata = false
    this.scannerDisableWatcher = false

    // Metadata - choose to store inside users library item folder
    this.storeCoverWithItem = false
    this.storeMetadataWithItem = false
    this.metadataFileFormat = 'json'

    // Security/Rate limits
    this.rateLimitLoginRequests = 10
    this.rateLimitLoginWindow = 10 * 60 * 1000 // 10 Minutes
    this.allowIframe = false

    // Backups
    this.backupPath = Path.join(global.MetadataPath, 'backups')
    this.backupSchedule = false // If false then auto-backups are disabled
    this.backupsToKeep = 2
    this.maxBackupSize = 1

    // Logger
    this.loggerDailyLogsToKeep = 7
    this.loggerScannerLogsToKeep = 2

    // Bookshelf Display
    this.homeBookshelfView = BookshelfView.DETAIL
    this.bookshelfView = BookshelfView.DETAIL

    // Podcasts
    this.podcastEpisodeSchedule = '0 * * * *' // Every hour

    // Sorting
    this.sortingIgnorePrefix = false
    this.sortingPrefixes = ['the', 'a']

    // Misc Flags
    this.chromecastEnabled = false
    this.dateFormat = 'MM/dd/yyyy'
    this.timeFormat = 'HH:mm'
    this.language = 'en-us'
    this.allowedOrigins = []

    this.logLevel = Logger.logLevel

    this.version = packageJson.version
    this.buildNumber = packageJson.buildNumber

    // Auth settings
    this.authLoginCustomMessage = null
    this.authActiveAuthMethods = ['local']

    // openid settings
    this.authOpenIDIssuerURL = null
    this.authOpenIDAuthorizationURL = null
    this.authOpenIDTokenURL = null
    this.authOpenIDUserInfoURL = null
    this.authOpenIDJwksURL = null
    this.authOpenIDLogoutURL = null
    this.authOpenIDClientID = null
    this.authOpenIDClientSecret = null
    this.authOpenIDTokenSigningAlgorithm = 'RS256'
    this.authOpenIDButtonText = 'Login with OpenId'
    this.authOpenIDAutoLaunch = false
    this.authOpenIDAutoRegister = false
    this.authOpenIDMatchExistingBy = null
    this.authOpenIDMobileRedirectURIs = ['audiobookshelf://oauth']
    this.authOpenIDGroupClaim = ''
    this.authOpenIDAdvancedPermsClaim = ''
    this.authOpenIDSubfolderForRedirectURLs = undefined

    if (settings) {
      this.construct(settings)
    }

    this.logOpenIDEnvironmentStatus()
  }

  construct(settings) {
    this.tokenSecret = settings.tokenSecret
    this.scannerFindCovers = !!settings.scannerFindCovers
    this.scannerCoverProvider = settings.scannerCoverProvider || 'google'
    this.scannerParseSubtitle = settings.scannerParseSubtitle
    this.scannerPreferMatchedMetadata = !!settings.scannerPreferMatchedMetadata
    this.scannerDisableWatcher = !!settings.scannerDisableWatcher

    this.storeCoverWithItem = !!settings.storeCoverWithItem
    this.storeMetadataWithItem = !!settings.storeMetadataWithItem
    this.metadataFileFormat = settings.metadataFileFormat || 'json'

    this.rateLimitLoginRequests = !isNaN(settings.rateLimitLoginRequests) ? Number(settings.rateLimitLoginRequests) : 10
    this.rateLimitLoginWindow = !isNaN(settings.rateLimitLoginWindow) ? Number(settings.rateLimitLoginWindow) : 10 * 60 * 1000 // 10 Minutes
    this.allowIframe = !!settings.allowIframe

    this.backupPath = settings.backupPath || Path.join(global.MetadataPath, 'backups')
    this.backupSchedule = settings.backupSchedule || false
    this.backupsToKeep = settings.backupsToKeep || 2
    this.maxBackupSize = settings.maxBackupSize === 0 ? 0 : settings.maxBackupSize || 1

    this.loggerDailyLogsToKeep = settings.loggerDailyLogsToKeep || 7
    this.loggerScannerLogsToKeep = settings.loggerScannerLogsToKeep || 2

    this.homeBookshelfView = settings.homeBookshelfView || BookshelfView.STANDARD
    this.bookshelfView = settings.bookshelfView || BookshelfView.STANDARD

    this.sortingIgnorePrefix = !!settings.sortingIgnorePrefix
    this.sortingPrefixes = settings.sortingPrefixes || ['the']
    this.chromecastEnabled = !!settings.chromecastEnabled
    this.dateFormat = settings.dateFormat || 'MM/dd/yyyy'
    this.timeFormat = settings.timeFormat || 'HH:mm'
    this.language = settings.language || 'en-us'
    this.allowedOrigins = settings.allowedOrigins || []
    this.logLevel = settings.logLevel || Logger.logLevel
    this.version = settings.version || null
    this.buildNumber = settings.buildNumber || 0 // Added v2.4.5

    this.authLoginCustomMessage = sanitize(settings.authLoginCustomMessage) || null // Added v2.8.0
    this.authActiveAuthMethods = settings.authActiveAuthMethods || ['local']

    this.authOpenIDIssuerURL = settings.authOpenIDIssuerURL || null
    this.authOpenIDAuthorizationURL = settings.authOpenIDAuthorizationURL || null
    this.authOpenIDTokenURL = settings.authOpenIDTokenURL || null
    this.authOpenIDUserInfoURL = settings.authOpenIDUserInfoURL || null
    this.authOpenIDJwksURL = settings.authOpenIDJwksURL || null
    this.authOpenIDLogoutURL = settings.authOpenIDLogoutURL || null
    this.authOpenIDClientID = settings.authOpenIDClientID || null
    this.authOpenIDClientSecret = settings.authOpenIDClientSecret || null
    this.authOpenIDTokenSigningAlgorithm = settings.authOpenIDTokenSigningAlgorithm || 'RS256'
    this.authOpenIDButtonText = settings.authOpenIDButtonText || 'Login with OpenId'
    this.authOpenIDAutoLaunch = !!settings.authOpenIDAutoLaunch
    this.authOpenIDAutoRegister = !!settings.authOpenIDAutoRegister
    this.authOpenIDMatchExistingBy = settings.authOpenIDMatchExistingBy || null
    this.authOpenIDMobileRedirectURIs = settings.authOpenIDMobileRedirectURIs || ['audiobookshelf://oauth']
    this.authOpenIDGroupClaim = settings.authOpenIDGroupClaim || ''
    this.authOpenIDAdvancedPermsClaim = settings.authOpenIDAdvancedPermsClaim || ''
    this.authOpenIDSubfolderForRedirectURLs = settings.authOpenIDSubfolderForRedirectURLs

    if (!Array.isArray(this.authActiveAuthMethods)) {
      this.authActiveAuthMethods = ['local']
    }

    // remove uninitialized methods
    // OpenID
    if (this.authActiveAuthMethods.includes('openid') && !this.isOpenIDAuthSettingsValid) {
      this.authActiveAuthMethods.splice(this.authActiveAuthMethods.indexOf('openid', 0), 1)
    }

    // fallback to local
    if (!Array.isArray(this.authActiveAuthMethods) || this.authActiveAuthMethods.length == 0) {
      this.authActiveAuthMethods = ['local']
    }

    // Migrations
    if (settings.storeCoverWithBook != undefined) {
      // storeCoverWithBook was renamed to storeCoverWithItem in 2.0.0
      this.storeCoverWithItem = !!settings.storeCoverWithBook
    }
    if (settings.storeMetadataWithBook != undefined) {
      // storeMetadataWithBook was renamed to storeMetadataWithItem in 2.0.0
      this.storeMetadataWithItem = !!settings.storeMetadataWithBook
    }
    if (settings.homeBookshelfView == undefined) {
      // homeBookshelfView was added in 2.1.3
      this.homeBookshelfView = settings.bookshelfView
    }
    if (settings.metadataFileFormat == undefined) {
      // metadataFileFormat was added in 2.2.21
      // All users using old settings will stay abs until changed
      this.metadataFileFormat = 'abs'
    }

    // As of v2.4.5 only json is supported
    if (this.metadataFileFormat !== 'json') {
      Logger.warn(`[ServerSettings] Invalid metadataFileFormat ${this.metadataFileFormat} (as of v2.4.5 only json is supported)`)
      this.metadataFileFormat = 'json'
    }

    if (this.logLevel !== Logger.logLevel) {
      Logger.setLogLevel(this.logLevel)
    }

    if (process.env.BACKUP_PATH && this.backupPath !== process.env.BACKUP_PATH) {
      Logger.info(`[ServerSettings] Using backup path from environment variable ${process.env.BACKUP_PATH}`)
      this.backupPath = process.env.BACKUP_PATH
    }

    if (process.env.ALLOW_IFRAME === '1' && !this.allowIframe) {
      Logger.info(`[ServerSettings] Using allowIframe from environment variable`)
      this.allowIframe = true
    }
  }

  toJSON() {
    // Use toJSONForBrowser if sending to client
    return {
      id: this.id,
      tokenSecret: this.tokenSecret, // Do not return to client
      scannerFindCovers: this.scannerFindCovers,
      scannerCoverProvider: this.scannerCoverProvider,
      scannerParseSubtitle: this.scannerParseSubtitle,
      scannerPreferMatchedMetadata: this.scannerPreferMatchedMetadata,
      scannerDisableWatcher: this.scannerDisableWatcher,
      storeCoverWithItem: this.storeCoverWithItem,
      storeMetadataWithItem: this.storeMetadataWithItem,
      metadataFileFormat: this.metadataFileFormat,
      rateLimitLoginRequests: this.rateLimitLoginRequests,
      rateLimitLoginWindow: this.rateLimitLoginWindow,
      allowIframe: this.allowIframe,
      backupPath: this.backupPath,
      backupSchedule: this.backupSchedule,
      backupsToKeep: this.backupsToKeep,
      maxBackupSize: this.maxBackupSize,
      loggerDailyLogsToKeep: this.loggerDailyLogsToKeep,
      loggerScannerLogsToKeep: this.loggerScannerLogsToKeep,
      homeBookshelfView: this.homeBookshelfView,
      bookshelfView: this.bookshelfView,
      podcastEpisodeSchedule: this.podcastEpisodeSchedule,
      sortingIgnorePrefix: this.sortingIgnorePrefix,
      sortingPrefixes: [...this.sortingPrefixes],
      chromecastEnabled: this.chromecastEnabled,
      dateFormat: this.dateFormat,
      timeFormat: this.timeFormat,
      language: this.language,
      allowedOrigins: this.allowedOrigins,
      logLevel: this.logLevel,
      version: this.version,
      buildNumber: this.buildNumber,
      authLoginCustomMessage: this.authLoginCustomMessage,
      authActiveAuthMethods: [...this.authActiveAuthMethods],
      authOpenIDIssuerURL: this.authOpenIDIssuerURL,
      authOpenIDAuthorizationURL: this.authOpenIDAuthorizationURL,
      authOpenIDTokenURL: this.authOpenIDTokenURL,
      authOpenIDUserInfoURL: this.authOpenIDUserInfoURL,
      authOpenIDJwksURL: this.authOpenIDJwksURL,
      authOpenIDLogoutURL: this.authOpenIDLogoutURL,
      authOpenIDClientID: this.authOpenIDClientID, // Do not return to client
      authOpenIDClientSecret: this.authOpenIDClientSecret, // Do not return to client
      authOpenIDTokenSigningAlgorithm: this.authOpenIDTokenSigningAlgorithm,
      authOpenIDButtonText: this.authOpenIDButtonText,
      authOpenIDAutoLaunch: this.authOpenIDAutoLaunch,
      authOpenIDAutoRegister: this.authOpenIDAutoRegister,
      authOpenIDMatchExistingBy: this.authOpenIDMatchExistingBy,
      authOpenIDMobileRedirectURIs: [...this.authOpenIDMobileRedirectURIs], // Do not return to client
      authOpenIDGroupClaim: this.authOpenIDGroupClaim, // Do not return to client
      authOpenIDAdvancedPermsClaim: this.authOpenIDAdvancedPermsClaim, // Do not return to client
      authOpenIDSubfolderForRedirectURLs: this.authOpenIDSubfolderForRedirectURLs
    }
  }

  /**
   * Host timezone used by cron schedulers (not persisted in settings)
   * @returns {string} IANA timezone name, e.g. "America/New_York"
   */
  static getHostTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  }

  toJSONForBrowser() {
    const json = this.getEffectiveServerSettings()
    delete json.tokenSecret
    delete json.authOpenIDClientID
    delete json.authOpenIDClientSecret
    delete json.authOpenIDMobileRedirectURIs
    delete json.authOpenIDGroupClaim
    delete json.authOpenIDAdvancedPermsClaim
    json.timeZone = ServerSettings.getHostTimeZone()
    return json
  }

  get supportedAuthMethods() {
    return ['local', 'openid']
  }

  /**
   * Auth settings required for openid to be valid
   */
  static isOpenIDAuthSettingsValid(settings) {
    return !!(settings.authOpenIDIssuerURL && settings.authOpenIDAuthorizationURL && settings.authOpenIDTokenURL && settings.authOpenIDUserInfoURL && settings.authOpenIDJwksURL && settings.authOpenIDClientID && settings.authOpenIDClientSecret && settings.authOpenIDTokenSigningAlgorithm)
  }

  get isOpenIDAuthSettingsValid() {
    return ServerSettings.isOpenIDAuthSettingsValid(this)
  }

  get authOpenIDEnvSet() {
    return OPENID_ENV_KEYS.some((key) => process.env[key] !== undefined)
  }

  getOpenIDSettingsFromEnv() {
    const envValue = (key, defaultValue = null) => (process.env[key] === undefined ? defaultValue : process.env[key])
    const mobileRedirectURIs =
      process.env.AUTH_OPENID_MOBILE_REDIRECT_URIS === undefined
        ? ['audiobookshelf://oauth']
        : process.env.AUTH_OPENID_MOBILE_REDIRECT_URIS.split(',')
            .map((uri) => uri.trim())
            .filter((uri) => uri)

    const settings = {
      authOpenIDIssuerURL: envValue('AUTH_OPENID_ISSUER_URL'),
      authOpenIDAuthorizationURL: envValue('AUTH_OPENID_AUTHORIZATION_URL'),
      authOpenIDTokenURL: envValue('AUTH_OPENID_TOKEN_URL'),
      authOpenIDUserInfoURL: envValue('AUTH_OPENID_USERINFO_URL'),
      authOpenIDJwksURL: envValue('AUTH_OPENID_JWKS_URL'),
      authOpenIDLogoutURL: process.env.AUTH_OPENID_LOGOUT_URL || null,
      authOpenIDClientID: envValue('AUTH_OPENID_CLIENT_ID'),
      authOpenIDClientSecret: envValue('AUTH_OPENID_CLIENT_SECRET'),
      authOpenIDTokenSigningAlgorithm: envValue('AUTH_OPENID_TOKEN_SIGNING_ALGORITHM', 'RS256'),
      authOpenIDButtonText: envValue('AUTH_OPENID_BUTTON_TEXT', 'Login with OpenId'),
      authOpenIDAutoLaunch: process.env.AUTH_OPENID_AUTO_LAUNCH === '1',
      authOpenIDAutoRegister: process.env.AUTH_OPENID_AUTO_REGISTER === '1',
      authOpenIDMatchExistingBy: process.env.AUTH_OPENID_MATCH_EXISTING_BY || null,
      authOpenIDMobileRedirectURIs: mobileRedirectURIs,
      authOpenIDGroupClaim: envValue('AUTH_OPENID_GROUP_CLAIM', ''),
      authOpenIDAdvancedPermsClaim: envValue('AUTH_OPENID_ADVANCED_PERMS_CLAIM', ''),
      authOpenIDSubfolderForRedirectURLs:
        process.env.AUTH_OPENID_SUBFOLDER_FOR_REDIRECT_URLS === undefined ? global.RouterBasePath || '' : process.env.AUTH_OPENID_SUBFOLDER_FOR_REDIRECT_URLS
    }

    const missingRequiredVariables = REQUIRED_OPENID_ENV_KEYS.filter((key) => !process.env[key])
    const invalidVariables = []

    if (!settings.authOpenIDTokenSigningAlgorithm) {
      invalidVariables.push('AUTH_OPENID_TOKEN_SIGNING_ALGORITHM')
    }
    if (mobileRedirectURIs.includes('*') && mobileRedirectURIs.length > 1) {
      invalidVariables.push('AUTH_OPENID_MOBILE_REDIRECT_URIS')
    } else if (mobileRedirectURIs.some((uri) => uri !== '*' && !OPENID_REDIRECT_URI_PATTERN.test(uri))) {
      invalidVariables.push('AUTH_OPENID_MOBILE_REDIRECT_URIS')
    }
    if (settings.authOpenIDGroupClaim && !OPENID_CLAIM_PATTERN.test(settings.authOpenIDGroupClaim)) {
      invalidVariables.push('AUTH_OPENID_GROUP_CLAIM')
    }
    if (settings.authOpenIDAdvancedPermsClaim && !OPENID_CLAIM_PATTERN.test(settings.authOpenIDAdvancedPermsClaim)) {
      invalidVariables.push('AUTH_OPENID_ADVANCED_PERMS_CLAIM')
    }
    if (settings.authOpenIDMatchExistingBy && !['email', 'username'].includes(settings.authOpenIDMatchExistingBy)) {
      invalidVariables.push('AUTH_OPENID_MATCH_EXISTING_BY')
    }

    return {
      ...settings,
      isValid: missingRequiredVariables.length === 0 && invalidVariables.length === 0 && ServerSettings.isOpenIDAuthSettingsValid(settings),
      missingRequiredVariables,
      invalidVariables,
      errors: [...missingRequiredVariables, ...invalidVariables]
    }
  }

  logOpenIDEnvironmentStatus() {
    if (!this.authOpenIDEnvSet) return
    const envSettings = this.getOpenIDSettingsFromEnv()
    if (envSettings.isValid) {
      Logger.info('[ServerSettings] Using OpenID Connect settings from environment variables')
    } else {
      const issues = []
      if (envSettings.missingRequiredVariables.length) issues.push(`Missing required variables: ${envSettings.missingRequiredVariables.join(', ')}`)
      if (envSettings.invalidVariables.length) issues.push(`Invalid variables: ${envSettings.invalidVariables.join(', ')}`)
      Logger.error(`[ServerSettings] Invalid OpenID Connect environment configuration. ${issues.join('. ')}`)
    }
  }

  getEffectiveServerSettings() {
    const settings = this.toJSON()
    if (!this.authOpenIDEnvSet) return settings

    const envSettings = this.getOpenIDSettingsFromEnv()
    for (const key of OPENID_SETTINGS_KEYS) {
      settings[key] = envSettings[key]
    }

    const effectiveAuthMethods = settings.authActiveAuthMethods.filter((method) => method !== 'openid')
    if (envSettings.isValid) effectiveAuthMethods.push('openid')
    if (!effectiveAuthMethods.some((method) => this.supportedAuthMethods.includes(method))) effectiveAuthMethods.push('local')
    settings.authActiveAuthMethods = [...new Set(effectiveAuthMethods)]
    return settings
  }

  get authenticationSettings() {
    return this.getAuthenticationSettings(this.toJSON())
  }

  get effectiveAuthenticationSettings() {
    return {
      ...this.getAuthenticationSettings(this.getEffectiveServerSettings()),
      authOpenIDEnvSet: this.authOpenIDEnvSet
    }
  }

  getAuthenticationSettings(settings) {
    return {
      authLoginCustomMessage: settings.authLoginCustomMessage,
      authActiveAuthMethods: settings.authActiveAuthMethods,
      ...Object.fromEntries(OPENID_SETTINGS_KEYS.map((key) => [key, settings[key]])),
      authOpenIDSamplePermissions: User.getSampleAbsPermissions()
    }
  }

  get authFormData() {
    return this.getAuthFormData(this.toJSON())
  }

  get effectiveAuthFormData() {
    return this.getAuthFormData(this.getEffectiveServerSettings())
  }

  getAuthFormData(settings) {
    const clientFormData = {
      authLoginCustomMessage: sanitize(settings.authLoginCustomMessage)
    }
    if (settings.authActiveAuthMethods.includes('openid')) {
      clientFormData.authOpenIDButtonText = settings.authOpenIDButtonText
      clientFormData.authOpenIDAutoLaunch = settings.authOpenIDAutoLaunch
    }
    return clientFormData
  }

  /**
   * Update server settings
   *
   * @param {Object} payload
   * @returns {boolean} true if updates were made
   */
  update(payload) {
    let hasUpdates = false
    for (const key in payload) {
      if (!PATCHABLE_SETTINGS_KEYS.has(key)) continue

      if (this[key] !== payload[key]) {
        if (key === 'logLevel') {
          Logger.setLogLevel(payload[key])
        }
        this[key] = payload[key]
        hasUpdates = true
      }
    }
    return hasUpdates
  }
}
module.exports = ServerSettings
