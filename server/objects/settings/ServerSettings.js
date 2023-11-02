const packageJson = require('../../../package.json')
const { BookshelfView } = require('../../utils/constants')
const Logger = require('../../Logger')

class ServerSettings {
  constructor(settings) {
    this.id = 'server-settings'
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

    // Backups
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

    this.logLevel = Logger.logLevel

    this.version = packageJson.version
    this.buildNumber = packageJson.buildNumber

    // Auth settings
    // Active auth methodes
    this.authActiveAuthMethods = ['local']

    // google-oauth20 settings
    this.authGoogleOauth20ClientID = ''
    this.authGoogleOauth20ClientSecret = ''
    this.authGoogleOauth20CallbackURL = ''

    // openid settings
    this.authOpenIDIssuerURL = ''
    this.authOpenIDAuthorizationURL = ''
    this.authOpenIDTokenURL = ''
    this.authOpenIDUserInfoURL = ''
    this.authOpenIDClientID = ''
    this.authOpenIDClientSecret = ''
    this.authOpenIDButtonText = 'Login with OpenId'
    this.authOpenIDAutoLaunch = false

    if (settings) {
      this.construct(settings)
    }
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

    this.backupSchedule = settings.backupSchedule || false
    this.backupsToKeep = settings.backupsToKeep || 2
    this.maxBackupSize = settings.maxBackupSize || 1

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
    this.logLevel = settings.logLevel || Logger.logLevel
    this.version = settings.version || null
    this.buildNumber = settings.buildNumber || 0 // Added v2.4.5

    this.authActiveAuthMethods = settings.authActiveAuthMethods || ['local']
    this.authGoogleOauth20ClientID = settings.authGoogleOauth20ClientID || ''
    this.authGoogleOauth20ClientSecret = settings.authGoogleOauth20ClientSecret || ''
    this.authGoogleOauth20CallbackURL = settings.authGoogleOauth20CallbackURL || ''

    this.authOpenIDIssuerURL = settings.authOpenIDIssuerURL || ''
    this.authOpenIDAuthorizationURL = settings.authOpenIDAuthorizationURL || ''
    this.authOpenIDTokenURL = settings.authOpenIDTokenURL || ''
    this.authOpenIDUserInfoURL = settings.authOpenIDUserInfoURL || ''
    this.authOpenIDClientID = settings.authOpenIDClientID || ''
    this.authOpenIDClientSecret = settings.authOpenIDClientSecret || ''
    this.authOpenIDButtonText = settings.authOpenIDButtonText || 'Login with OpenId'
    this.authOpenIDAutoLaunch = !!settings.authOpenIDAutoLaunch

    if (!Array.isArray(this.authActiveAuthMethods)) {
      this.authActiveAuthMethods = ['local']
    }

    // remove uninitialized methods
    // GoogleOauth20
    if (this.authActiveAuthMethods.includes('google-oauth20') && (
      this.authGoogleOauth20ClientID === '' ||
      this.authGoogleOauth20ClientSecret === '' ||
      this.authGoogleOauth20CallbackURL === ''
    )) {
      this.authActiveAuthMethods.splice(this.authActiveAuthMethods.indexOf('google-oauth20', 0), 1)
    }

    // remove uninitialized methods
    // OpenID
    if (this.authActiveAuthMethods.includes('openid') && (
      this.authOpenIDIssuerURL === '' ||
      this.authOpenIDAuthorizationURL === '' ||
      this.authOpenIDTokenURL === '' ||
      this.authOpenIDUserInfoURL === '' ||
      this.authOpenIDClientID === '' ||
      this.authOpenIDClientSecret === ''
    )) {
      this.authActiveAuthMethods.splice(this.authActiveAuthMethods.indexOf('openid', 0), 1)
    }

    // fallback to local    
    if (!Array.isArray(this.authActiveAuthMethods) || this.authActiveAuthMethods.length == 0) {
      this.authActiveAuthMethods = ['local']
    }

    // Migrations
    if (settings.storeCoverWithBook != undefined) { // storeCoverWithBook was renamed to storeCoverWithItem in 2.0.0
      this.storeCoverWithItem = !!settings.storeCoverWithBook
    }
    if (settings.storeMetadataWithBook != undefined) { // storeMetadataWithBook was renamed to storeMetadataWithItem in 2.0.0
      this.storeMetadataWithItem = !!settings.storeMetadataWithBook
    }
    if (settings.homeBookshelfView == undefined) { // homeBookshelfView was added in 2.1.3
      this.homeBookshelfView = settings.bookshelfView
    }
    if (settings.metadataFileFormat == undefined) { // metadataFileFormat was added in 2.2.21
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
  }

  toJSON() { // Use toJSONForBrowser if sending to client
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
      logLevel: this.logLevel,
      version: this.version,
      buildNumber: this.buildNumber,
      authActiveAuthMethods: this.authActiveAuthMethods,
      authGoogleOauth20ClientID: this.authGoogleOauth20ClientID, // Do not return to client
      authGoogleOauth20ClientSecret: this.authGoogleOauth20ClientSecret, // Do not return to client
      authGoogleOauth20CallbackURL: this.authGoogleOauth20CallbackURL,
      authOpenIDIssuerURL: this.authOpenIDIssuerURL,
      authOpenIDAuthorizationURL: this.authOpenIDAuthorizationURL,
      authOpenIDTokenURL: this.authOpenIDTokenURL,
      authOpenIDUserInfoURL: this.authOpenIDUserInfoURL,
      authOpenIDClientID: this.authOpenIDClientID, // Do not return to client
      authOpenIDClientSecret: this.authOpenIDClientSecret, // Do not return to client
      authOpenIDButtonText: this.authOpenIDButtonText,
      authOpenIDAutoLaunch: this.authOpenIDAutoLaunch
    }
  }

  toJSONForBrowser() {
    const json = this.toJSON()
    delete json.tokenSecret
    delete json.authGoogleOauth20ClientID
    delete json.authGoogleOauth20ClientSecret
    delete json.authOpenIDClientID
    delete json.authOpenIDClientSecret
    return json
  }

  get authenticationSettings() {
    return {
      authActiveAuthMethods: this.authActiveAuthMethods,
      authGoogleOauth20ClientID: this.authGoogleOauth20ClientID, // Do not return to client
      authGoogleOauth20ClientSecret: this.authGoogleOauth20ClientSecret, // Do not return to client
      authGoogleOauth20CallbackURL: this.authGoogleOauth20CallbackURL,
      authOpenIDIssuerURL: this.authOpenIDIssuerURL,
      authOpenIDAuthorizationURL: this.authOpenIDAuthorizationURL,
      authOpenIDTokenURL: this.authOpenIDTokenURL,
      authOpenIDUserInfoURL: this.authOpenIDUserInfoURL,
      authOpenIDClientID: this.authOpenIDClientID, // Do not return to client
      authOpenIDClientSecret: this.authOpenIDClientSecret, // Do not return to client
      authOpenIDButtonText: this.authOpenIDButtonText,
      authOpenIDAutoLaunch: this.authOpenIDAutoLaunch
    }
  }

  get authFormData() {
    const clientFormData = {}
    if (this.authActiveAuthMethods.includes('openid')) {
      clientFormData.authOpenIDButtonText = this.authOpenIDButtonText
      clientFormData.authOpenIDAutoLaunch = this.authOpenIDAutoLaunch
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
      if (key === 'sortingPrefixes') {
        // Sorting prefixes are updated with the /api/sorting-prefixes endpoint
        continue
      } else if (key === 'authActiveAuthMethods') {
        if (!payload[key]?.length) {
          Logger.error(`[ServerSettings] Invalid authActiveAuthMethods`, payload[key])
          continue
        }
        this.authActiveAuthMethods.sort()
        payload[key].sort()
        if (payload[key].join() !== this.authActiveAuthMethods.join()) {
          this.authActiveAuthMethods = payload[key]
          hasUpdates = true
        }
      } else if (this[key] !== payload[key]) {
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
