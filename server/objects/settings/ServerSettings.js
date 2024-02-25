const packageJson = require('../../../package.json')
const { BookshelfView } = require('../../utils/constants')
const Logger = require('../../Logger')

/**
 * @openapi
 * components:
 *   schemas:
 *     serverSettings:
 *       type: object
 *       properties:
 *         id:
 *           description: The ID of the server settings.
 *           type: string
 *           example: server-settings
 *         scannerFindCovers:
 *           description: Whether the scanner will attempt to find a cover if your audiobook does not have an embedded cover or a cover image inside the folder. Note that This will extend scan time.
 *           type: boolean
 *           example: false
 *         scannerCoverProvider:
 *           description: If scannerFindCovers is true, which metadata provider to use. See Metadata Providers for options.
 *           type: string
 *           example: google
 *         scannerParseSubtitle:
 *           description: Whether to extract subtitles from audiobook folder names. Subtitles must be separated by -, i.e. /audiobooks/Book Title - A Subtitle Here/ has the subtitle A Subtitle Here.
 *           type: boolean
 *           example: false
 *         scannerPreferAudioMetadata:
 *           description: Whether to use audio file ID3 meta tags instead of folder names for book details.
 *           type: boolean
 *           example: false
 *         scannerPreferOpfMetadata:
 *           description: Whether to use OPF file metadata instead of folder names for book details.
 *           type: boolean
 *           example: false
 *         scannerPreferMatchedMetadata:
 *           description: Whether matched data will override item details when using Quick Match. By default, Quick Match will only fill in missing details.
 *           type: boolean
 *           example: false
 *         scannerDisableWatcher:
 *           description: Whether to disable the automatic adding/updating of items when file changes are detected. Requires server restart for changes to take effect.
 *           type: boolean
 *           example: true
 *         scannerPreferOverdriveMediaMarker:
 *           description: Whether to use the custom metadata in MP3 files from Overdrive for chapter timings automatically.
 *           type: boolean
 *           example: false
 *         scannerUseTone:
 *           description: Should use tone to extract metadata
 *           type: boolean
 *           example: false
 *         storeCoverWithItem:
 *           description: Whether to store covers in the library item's folder. By default, covers are stored in /metadata/items. Only one file named cover will be kept.
 *           type: boolean
 *           example: false
 *         storeMetadataWithItem:
 *           description: Whether to store metadata files in the library item's folder. By default, metadata files are stored in /metadata/items. Uses the .abs file extension.
 *           type: boolean
 *           example: false
 *         metadataFileFormat:
 *           description: Must be either json or abs
 *           type: string
 *           example: json
 *         rateLimitLoginRequests:
 *           description: The maximum number of login requests per rateLimitLoginWindow.
 *           type: integer
 *           example: 10
 *         rateLimitLoginWindow:
 *           description: The length (in ms) of each login rate limit window.
 *           type: integer
 *           example: 600000
 *         backupSchedule:
 *           description: The cron expression for when to do automatic backups.
 *           type: string
 *           example: 30 1 * * *
 *         backupsToKeep:
 *           description: The number of backups to keep.
 *           type: integer
 *           example: 2
 *         maxBackupSize:
 *           description: The maximum backup size (in GB) before they fail, a safeguard against misconfiguration.
 *           type: integer
 *           example: 1
 *         backupMetadataCovers:
 *           description: Whether backups should include library item covers and author images located in metadata.
 *           type: boolean
 *           example: true
 *         loggerDailyLogsToKeep:
 *           description: The number of daily logs to keep.
 *           type: integer
 *           example: 7
 *         loggerScannerLogsToKeep:
 *           description: The number of scanner logs to keep.
 *           type: integer
 *           example: 2
 *         homeBookshelfView:
 *           description: Whether the home page should use a skeuomorphic design with wooden shelves.
 *           type: integer
 *           example: 1
 *         bookshelfView:
 *           description: Whether other bookshelf pages should use a skeuomorphic design with wooden shelves.
 *           type: integer
 *           example: 1
 *         sortingIgnorePrefix:
 *           description: Whether to ignore prefixes when sorting. For example, for the prefix the, the book title The Book Title would sort as Book Title, The.
 *           type: boolean
 *           example: false
 *         sortingPrefixes:
 *           description: If sortingIgnorePrefix is true, what prefixes to ignore.
 *           type: array
 *           items:
 *             type: string
 *             example: the
 *               - a
 *         chromecastEnabled:
 *           description: Whether to enable streaming to Chromecast devices.
 *           type: boolean
 *           example: false
 *         dateFormat:
 *           description: What date format to use. Options are MM/dd/yyyy, dd/MM/yyyy, dd.MM.yyyy, yyyy-MM-dd, MMM do, yyyy, MMMM do, yyyy, dd MMM yyyy, or dd MMMM yyyy.
 *           type: string
 *           example: MM/dd/yyyy
 *         timeFormat:
 *           description: What time format to use. Options are HH:mm (24-hour) and h:mma (am/pm).
 *           type: string
 *           example: HH:mm
 *         language:
 *           description: The default server language.
 *           type: string
 *           example: en-us
 *         logLevel:
 *           description: What log level the server should use when logging. 1 for debug, 2 for info, or 3 for warnings.
 *           type: integer
 *           example: 2
 *         version:
 *           description: The server's version.
 *           type: string
 *           example: 2.2.5
 */
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
    this.authOpenIDButtonText = 'Login with OpenId'
    this.authOpenIDAutoLaunch = false
    this.authOpenIDAutoRegister = false
    this.authOpenIDMatchExistingBy = null
    this.authOpenIDMobileRedirectURIs = ['audiobookshelf://oauth']

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

    this.authLoginCustomMessage = settings.authLoginCustomMessage || null // Added v2.7.3
    this.authActiveAuthMethods = settings.authActiveAuthMethods || ['local']

    this.authOpenIDIssuerURL = settings.authOpenIDIssuerURL || null
    this.authOpenIDAuthorizationURL = settings.authOpenIDAuthorizationURL || null
    this.authOpenIDTokenURL = settings.authOpenIDTokenURL || null
    this.authOpenIDUserInfoURL = settings.authOpenIDUserInfoURL || null
    this.authOpenIDJwksURL = settings.authOpenIDJwksURL || null
    this.authOpenIDLogoutURL = settings.authOpenIDLogoutURL || null
    this.authOpenIDClientID = settings.authOpenIDClientID || null
    this.authOpenIDClientSecret = settings.authOpenIDClientSecret || null
    this.authOpenIDButtonText = settings.authOpenIDButtonText || 'Login with OpenId'
    this.authOpenIDAutoLaunch = !!settings.authOpenIDAutoLaunch
    this.authOpenIDAutoRegister = !!settings.authOpenIDAutoRegister
    this.authOpenIDMatchExistingBy = settings.authOpenIDMatchExistingBy || null
    this.authOpenIDMobileRedirectURIs = settings.authOpenIDMobileRedirectURIs || ['audiobookshelf://oauth']

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
      authLoginCustomMessage: this.authLoginCustomMessage,
      authActiveAuthMethods: this.authActiveAuthMethods,
      authOpenIDIssuerURL: this.authOpenIDIssuerURL,
      authOpenIDAuthorizationURL: this.authOpenIDAuthorizationURL,
      authOpenIDTokenURL: this.authOpenIDTokenURL,
      authOpenIDUserInfoURL: this.authOpenIDUserInfoURL,
      authOpenIDJwksURL: this.authOpenIDJwksURL,
      authOpenIDLogoutURL: this.authOpenIDLogoutURL,
      authOpenIDClientID: this.authOpenIDClientID, // Do not return to client
      authOpenIDClientSecret: this.authOpenIDClientSecret, // Do not return to client
      authOpenIDButtonText: this.authOpenIDButtonText,
      authOpenIDAutoLaunch: this.authOpenIDAutoLaunch,
      authOpenIDAutoRegister: this.authOpenIDAutoRegister,
      authOpenIDMatchExistingBy: this.authOpenIDMatchExistingBy,
      authOpenIDMobileRedirectURIs: this.authOpenIDMobileRedirectURIs // Do not return to client
    }
  }

  toJSONForBrowser() {
    const json = this.toJSON()
    delete json.tokenSecret
    delete json.authOpenIDClientID
    delete json.authOpenIDClientSecret
    delete json.authOpenIDMobileRedirectURIs
    return json
  }

  get supportedAuthMethods() {
    return ['local', 'openid']
  }

  /**
   * Auth settings required for openid to be valid
   */
  get isOpenIDAuthSettingsValid() {
    return this.authOpenIDIssuerURL &&
      this.authOpenIDAuthorizationURL &&
      this.authOpenIDTokenURL &&
      this.authOpenIDUserInfoURL &&
      this.authOpenIDJwksURL &&
      this.authOpenIDClientID &&
      this.authOpenIDClientSecret
  }

  get authenticationSettings() {
    return {
      authLoginCustomMessage: this.authLoginCustomMessage,
      authActiveAuthMethods: this.authActiveAuthMethods,
      authOpenIDIssuerURL: this.authOpenIDIssuerURL,
      authOpenIDAuthorizationURL: this.authOpenIDAuthorizationURL,
      authOpenIDTokenURL: this.authOpenIDTokenURL,
      authOpenIDUserInfoURL: this.authOpenIDUserInfoURL,
      authOpenIDJwksURL: this.authOpenIDJwksURL,
      authOpenIDLogoutURL: this.authOpenIDLogoutURL,
      authOpenIDClientID: this.authOpenIDClientID, // Do not return to client
      authOpenIDClientSecret: this.authOpenIDClientSecret, // Do not return to client
      authOpenIDButtonText: this.authOpenIDButtonText,
      authOpenIDAutoLaunch: this.authOpenIDAutoLaunch,
      authOpenIDAutoRegister: this.authOpenIDAutoRegister,
      authOpenIDMatchExistingBy: this.authOpenIDMatchExistingBy,
      authOpenIDMobileRedirectURIs: this.authOpenIDMobileRedirectURIs // Do not return to client
    }
  }

  get authFormData() {
    const clientFormData = {
      authLoginCustomMessage: this.authLoginCustomMessage
    }
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
