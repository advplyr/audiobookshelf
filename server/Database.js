const Path = require('path')
const { Sequelize } = require('sequelize')

const packageJson = require('../package.json')
const fs = require('./libs/fsExtra')
const Logger = require('./Logger')

const dbMigration = require('./utils/migrations/dbMigration')
const Auth = require('./Auth')

class Database {
  constructor() {
    this.sequelize = null
    this.dbPath = null
    this.isNew = false // New absdatabase.sqlite created
    this.hasRootUser = false // Used to show initialization page in web ui

    // Temporarily using format of old DB
    // TODO: below data should be loaded from the DB as needed
    this.libraryItems = []
    this.settings = []
    this.authors = []
    this.series = []

    // Cached library filter data
    this.libraryFilterData = {}

    this.serverSettings = null
    this.notificationSettings = null
    this.emailSettings = null
  }

  get models() {
    return this.sequelize?.models || {}
  }

  /** @type {typeof import('./models/Author')} */
  get authorModel() {
    return this.models.author
  }

  /** @type {typeof import('./models/Series')} */
  get seriesModel() {
    return this.models.series
  }

  /** @type {typeof import('./models/Book')} */
  get bookModel() {
    return this.models.book
  }

  /** @type {typeof import('./models/Podcast')} */
  get podcastModel() {
    return this.models.podcast
  }

  /** @type {typeof import('./models/LibraryItem')} */
  get libraryItemModel() {
    return this.models.libraryItem
  }

  /** @type {typeof import('./models/PodcastEpisode')} */
  get podcastEpisodeModel() {
    return this.models.podcastEpisode
  }

  /** @type {typeof import('./models/MediaProgress')} */
  get mediaProgressModel() {
    return this.models.mediaProgress
  }

  /**
   * Check if db file exists
   * @returns {boolean}
   */
  async checkHasDb() {
    if (!await fs.pathExists(this.dbPath)) {
      Logger.info(`[Database] absdatabase.sqlite not found at ${this.dbPath}`)
      return false
    }
    return true
  }

  /**
   * Connect to db, build models and run migrations
   * @param {boolean} [force=false] Used for testing, drops & re-creates all tables
   */
  async init(force = false) {
    this.dbPath = Path.join(global.ConfigPath, 'absdatabase.sqlite')

    // First check if this is a new database
    this.isNew = !(await this.checkHasDb()) || force

    if (!await this.connect()) {
      throw new Error('Database connection failed')
    }

    await this.buildModels(force)
    Logger.info(`[Database] Db initialized with models:`, Object.keys(this.sequelize.models).join(', '))

    await this.loadData()
  }

  /**
   * Connect to db
   * @returns {boolean}
   */
  async connect() {
    Logger.info(`[Database] Initializing db at "${this.dbPath}"`)
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: this.dbPath,
      logging: false,
      transactionType: 'IMMEDIATE'
    })

    // Helper function
    this.sequelize.uppercaseFirst = str => str ? `${str[0].toUpperCase()}${str.substr(1)}` : ''

    try {
      await this.sequelize.authenticate()
      Logger.info(`[Database] Db connection was successful`)
      return true
    } catch (error) {
      Logger.error(`[Database] Failed to connect to db`, error)
      return false
    }
  }

  /**
   * Disconnect from db
   */
  async disconnect() {
    Logger.info(`[Database] Disconnecting sqlite db`)
    await this.sequelize.close()
    this.sequelize = null
  }

  /**
   * Reconnect to db and init
   */
  async reconnect() {
    Logger.info(`[Database] Reconnecting sqlite db`)
    await this.init()
  }

  buildModels(force = false) {
    require('./models/User').init(this.sequelize)
    require('./models/Library').init(this.sequelize)
    require('./models/LibraryFolder').init(this.sequelize)
    require('./models/Book').init(this.sequelize)
    require('./models/Podcast').init(this.sequelize)
    require('./models/PodcastEpisode').init(this.sequelize)
    require('./models/LibraryItem').init(this.sequelize)
    require('./models/MediaProgress').init(this.sequelize)
    require('./models/Series').init(this.sequelize)
    require('./models/BookSeries').init(this.sequelize)
    require('./models/Author').init(this.sequelize)
    require('./models/BookAuthor').init(this.sequelize)
    require('./models/Collection').init(this.sequelize)
    require('./models/CollectionBook').init(this.sequelize)
    require('./models/Playlist').init(this.sequelize)
    require('./models/PlaylistMediaItem').init(this.sequelize)
    require('./models/Device').init(this.sequelize)
    require('./models/PlaybackSession').init(this.sequelize)
    require('./models/Feed').init(this.sequelize)
    require('./models/FeedEpisode').init(this.sequelize)
    require('./models/Setting').init(this.sequelize)

    return this.sequelize.sync({ force, alter: false })
  }

  /**
   * Compare two server versions
   * @param {string} v1 
   * @param {string} v2 
   * @returns {-1|0|1} 1 if v1 > v2
   */
  compareVersions(v1, v2) {
    if (!v1 || !v2) return 0
    return v1.localeCompare(v2, undefined, { numeric: true, sensitivity: "case", caseFirst: "upper" })
  }

  /**
   * Checks if migration to sqlite db is necessary & runs migration.
   * 
   * Check if version was upgraded and run any version specific migrations.
   * 
   * Loads most of the data from the database. This is a temporary solution.
   */
  async loadData() {
    if (this.isNew && await dbMigration.checkShouldMigrate()) {
      Logger.info(`[Database] New database was created and old database was detected - migrating old to new`)
      await dbMigration.migrate(this.models)
    }

    const startTime = Date.now()

    const settingsData = await this.models.setting.getOldSettings()
    this.settings = settingsData.settings
    this.emailSettings = settingsData.emailSettings
    this.serverSettings = settingsData.serverSettings
    this.notificationSettings = settingsData.notificationSettings
    global.ServerSettings = this.serverSettings.toJSON()

    // Version specific migrations
    if (this.serverSettings.version === '2.3.0' && this.compareVersions(packageJson.version, '2.3.0') == 1) {
      await dbMigration.migrationPatch(this)
    }
    if (['2.3.0', '2.3.1', '2.3.2', '2.3.3'].includes(this.serverSettings.version) && this.compareVersions(packageJson.version, '2.3.3') >= 0) {
      await dbMigration.migrationPatch2(this)
    }

    Logger.info(`[Database] Loading db data...`)

    this.libraryItems = await this.models.libraryItem.loadAllLibraryItems()
    Logger.info(`[Database] Loaded ${this.libraryItems.length} library items`)

    this.authors = await this.models.author.getOldAuthors()
    Logger.info(`[Database] Loaded ${this.authors.length} authors`)

    this.series = await this.models.series.getAllOldSeries()
    Logger.info(`[Database] Loaded ${this.series.length} series`)

    // Set if root user has been created
    this.hasRootUser = await this.models.user.getHasRootUser()

    Logger.info(`[Database] Db data loaded in ${((Date.now() - startTime) / 1000).toFixed(2)}s`)

    if (packageJson.version !== this.serverSettings.version) {
      Logger.info(`[Database] Server upgrade detected from ${this.serverSettings.version} to ${packageJson.version}`)
      this.serverSettings.version = packageJson.version
      await this.updateServerSettings()
    }
  }

  /**
   * Create root user
   * @param {string} username 
   * @param {string} pash 
   * @param {Auth} auth 
   * @returns {boolean} true if created
   */
  async createRootUser(username, pash, auth) {
    if (!this.sequelize) return false
    await this.models.user.createRootUser(username, pash, auth)
    this.hasRootUser = true
    return true
  }

  updateServerSettings() {
    if (!this.sequelize) return false
    global.ServerSettings = this.serverSettings.toJSON()
    return this.updateSetting(this.serverSettings)
  }

  updateSetting(settings) {
    if (!this.sequelize) return false
    return this.models.setting.updateSettingObj(settings.toJSON())
  }

  async createUser(oldUser) {
    if (!this.sequelize) return false
    await this.models.user.createFromOld(oldUser)
    return true
  }

  updateUser(oldUser) {
    if (!this.sequelize) return false
    return this.models.user.updateFromOld(oldUser)
  }

  updateBulkUsers(oldUsers) {
    if (!this.sequelize) return false
    return Promise.all(oldUsers.map(u => this.updateUser(u)))
  }

  async removeUser(userId) {
    if (!this.sequelize) return false
    await this.models.user.removeById(userId)
  }

  upsertMediaProgress(oldMediaProgress) {
    if (!this.sequelize) return false
    return this.models.mediaProgress.upsertFromOld(oldMediaProgress)
  }

  removeMediaProgress(mediaProgressId) {
    if (!this.sequelize) return false
    return this.models.mediaProgress.removeById(mediaProgressId)
  }

  updateBulkBooks(oldBooks) {
    if (!this.sequelize) return false
    return Promise.all(oldBooks.map(oldBook => this.models.book.saveFromOld(oldBook)))
  }

  async createLibrary(oldLibrary) {
    if (!this.sequelize) return false
    await this.models.library.createFromOld(oldLibrary)
  }

  updateLibrary(oldLibrary) {
    if (!this.sequelize) return false
    return this.models.library.updateFromOld(oldLibrary)
  }

  async removeLibrary(libraryId) {
    if (!this.sequelize) return false
    await this.models.library.removeById(libraryId)
  }

  createBulkCollectionBooks(collectionBooks) {
    if (!this.sequelize) return false
    return this.models.collectionBook.bulkCreate(collectionBooks)
  }

  createPlaylistMediaItem(playlistMediaItem) {
    if (!this.sequelize) return false
    return this.models.playlistMediaItem.create(playlistMediaItem)
  }

  createBulkPlaylistMediaItems(playlistMediaItems) {
    if (!this.sequelize) return false
    return this.models.playlistMediaItem.bulkCreate(playlistMediaItems)
  }

  getLibraryItem(libraryItemId) {
    if (!this.sequelize || !libraryItemId) return false

    // Temp support for old library item ids from mobile
    if (libraryItemId.startsWith('li_')) return this.libraryItems.find(li => li.oldLibraryItemId === libraryItemId)

    return this.libraryItems.find(li => li.id === libraryItemId)
  }

  async createLibraryItem(oldLibraryItem) {
    if (!this.sequelize) return false
    await oldLibraryItem.saveMetadata()
    await this.models.libraryItem.fullCreateFromOld(oldLibraryItem)
    this.libraryItems.push(oldLibraryItem)
  }

  async updateLibraryItem(oldLibraryItem) {
    if (!this.sequelize) return false
    await oldLibraryItem.saveMetadata()
    return this.models.libraryItem.fullUpdateFromOld(oldLibraryItem)
  }

  async updateBulkLibraryItems(oldLibraryItems) {
    if (!this.sequelize) return false
    let updatesMade = 0
    for (const oldLibraryItem of oldLibraryItems) {
      await oldLibraryItem.saveMetadata()
      const hasUpdates = await this.models.libraryItem.fullUpdateFromOld(oldLibraryItem)
      if (hasUpdates) {
        updatesMade++
      }
    }
    return updatesMade
  }

  async createBulkLibraryItems(oldLibraryItems) {
    if (!this.sequelize) return false
    for (const oldLibraryItem of oldLibraryItems) {
      await oldLibraryItem.saveMetadata()
      await this.models.libraryItem.fullCreateFromOld(oldLibraryItem)
      this.libraryItems.push(oldLibraryItem)
    }
  }

  async removeLibraryItem(libraryItemId) {
    if (!this.sequelize) return false
    await this.models.libraryItem.removeById(libraryItemId)
    this.libraryItems = this.libraryItems.filter(li => li.id !== libraryItemId)
  }

  async createFeed(oldFeed) {
    if (!this.sequelize) return false
    await this.models.feed.fullCreateFromOld(oldFeed)
  }

  updateFeed(oldFeed) {
    if (!this.sequelize) return false
    return this.models.feed.fullUpdateFromOld(oldFeed)
  }

  async removeFeed(feedId) {
    if (!this.sequelize) return false
    await this.models.feed.removeById(feedId)
  }

  updateSeries(oldSeries) {
    if (!this.sequelize) return false
    return this.models.series.updateFromOld(oldSeries)
  }

  async createSeries(oldSeries) {
    if (!this.sequelize) return false
    await this.models.series.createFromOld(oldSeries)
    this.series.push(oldSeries)
  }

  async createBulkSeries(oldSeriesObjs) {
    if (!this.sequelize) return false
    await this.models.series.createBulkFromOld(oldSeriesObjs)
    this.series.push(...oldSeriesObjs)
  }

  async removeSeries(seriesId) {
    if (!this.sequelize) return false
    await this.models.series.removeById(seriesId)
    this.series = this.series.filter(se => se.id !== seriesId)
  }

  async createAuthor(oldAuthor) {
    if (!this.sequelize) return false
    await this.models.author.createFromOld(oldAuthor)
    this.authors.push(oldAuthor)
  }

  async createBulkAuthors(oldAuthors) {
    if (!this.sequelize) return false
    await this.models.author.createBulkFromOld(oldAuthors)
    this.authors.push(...oldAuthors)
  }

  updateAuthor(oldAuthor) {
    if (!this.sequelize) return false
    return this.models.author.updateFromOld(oldAuthor)
  }

  async removeAuthor(authorId) {
    if (!this.sequelize) return false
    await this.models.author.removeById(authorId)
    this.authors = this.authors.filter(au => au.id !== authorId)
  }

  async createBulkBookAuthors(bookAuthors) {
    if (!this.sequelize) return false
    await this.models.bookAuthor.bulkCreate(bookAuthors)
    this.authors.push(...bookAuthors)
  }

  async removeBulkBookAuthors(authorId = null, bookId = null) {
    if (!this.sequelize) return false
    if (!authorId && !bookId) return
    await this.models.bookAuthor.removeByIds(authorId, bookId)
    this.authors = this.authors.filter(au => {
      if (authorId && au.authorId !== authorId) return true
      if (bookId && au.bookId !== bookId) return true
      return false
    })
  }

  getPlaybackSessions(where = null) {
    if (!this.sequelize) return false
    return this.models.playbackSession.getOldPlaybackSessions(where)
  }

  getPlaybackSession(sessionId) {
    if (!this.sequelize) return false
    return this.models.playbackSession.getById(sessionId)
  }

  createPlaybackSession(oldSession) {
    if (!this.sequelize) return false
    return this.models.playbackSession.createFromOld(oldSession)
  }

  updatePlaybackSession(oldSession) {
    if (!this.sequelize) return false
    return this.models.playbackSession.updateFromOld(oldSession)
  }

  removePlaybackSession(sessionId) {
    if (!this.sequelize) return false
    return this.models.playbackSession.removeById(sessionId)
  }

  getDeviceByDeviceId(deviceId) {
    if (!this.sequelize) return false
    return this.models.device.getOldDeviceByDeviceId(deviceId)
  }

  updateDevice(oldDevice) {
    if (!this.sequelize) return false
    return this.models.device.updateFromOld(oldDevice)
  }

  createDevice(oldDevice) {
    if (!this.sequelize) return false
    return this.models.device.createFromOld(oldDevice)
  }

  removeTagFromFilterData(tag) {
    for (const libraryId in this.libraryFilterData) {
      this.libraryFilterData[libraryId].tags = this.libraryFilterData[libraryId].tags.filter(t => t !== tag)
    }
  }

  addTagToFilterData(tag) {
    for (const libraryId in this.libraryFilterData) {
      if (!this.libraryFilterData[libraryId].tags.includes(tag)) {
        this.libraryFilterData[libraryId].tags.push(tag)
      }
    }
  }

  removeGenreFromFilterData(genre) {
    for (const libraryId in this.libraryFilterData) {
      this.libraryFilterData[libraryId].genres = this.libraryFilterData[libraryId].genres.filter(g => g !== genre)
    }
  }

  addGenreToFilterData(genre) {
    for (const libraryId in this.libraryFilterData) {
      if (!this.libraryFilterData[libraryId].genres.includes(genre)) {
        this.libraryFilterData[libraryId].genres.push(genre)
      }
    }
  }

  removeNarratorFromFilterData(narrator) {
    for (const libraryId in this.libraryFilterData) {
      this.libraryFilterData[libraryId].narrators = this.libraryFilterData[libraryId].narrators.filter(n => n !== narrator)
    }
  }

  addNarratorToFilterData(narrator) {
    for (const libraryId in this.libraryFilterData) {
      if (!this.libraryFilterData[libraryId].narrators.includes(narrator)) {
        this.libraryFilterData[libraryId].narrators.push(narrator)
      }
    }
  }

  removeSeriesFromFilterData(libraryId, seriesId) {
    if (!this.libraryFilterData[libraryId]) return
    this.libraryFilterData[libraryId].series = this.libraryFilterData[libraryId].series.filter(se => se.id !== seriesId)
  }

  addSeriesToFilterData(libraryId, seriesName, seriesId) {
    if (!this.libraryFilterData[libraryId]) return
    // Check if series is already added
    if (this.libraryFilterData[libraryId].series.some(se => se.id === seriesId)) return
    this.libraryFilterData[libraryId].series.push({
      id: seriesId,
      name: seriesName
    })
  }

  removeAuthorFromFilterData(libraryId, authorId) {
    if (!this.libraryFilterData[libraryId]) return
    this.libraryFilterData[libraryId].authors = this.libraryFilterData[libraryId].authors.filter(au => au.id !== authorId)
  }

  addAuthorToFilterData(libraryId, authorName, authorId) {
    if (!this.libraryFilterData[libraryId]) return
    // Check if author is already added
    if (this.libraryFilterData[libraryId].authors.some(au => au.id === authorId)) return
    this.libraryFilterData[libraryId].authors.push({
      id: authorId,
      name: authorName
    })
  }

  /**
   * Used when updating items to make sure author id exists
   * If library filter data is set then use that for check
   * otherwise lookup in db
   * @param {string} libraryId 
   * @param {string} authorId 
   * @returns {Promise<boolean>}
   */
  async checkAuthorExists(libraryId, authorId) {
    if (!this.libraryFilterData[libraryId]) {
      return this.authorModel.checkExistsById(authorId)
    }
    return this.libraryFilterData[libraryId].authors.some(au => au.id === authorId)
  }

  /**
   * Used when updating items to make sure series id exists
   * If library filter data is set then use that for check
   * otherwise lookup in db
   * @param {string} libraryId 
   * @param {string} seriesId 
   * @returns {Promise<boolean>}
   */
  async checkSeriesExists(libraryId, seriesId) {
    if (!this.libraryFilterData[libraryId]) {
      return this.seriesModel.checkExistsById(seriesId)
    }
    return this.libraryFilterData[libraryId].series.some(se => se.id === seriesId)
  }

  /**
   * Reset numIssues for library
   * @param {string} libraryId 
   */
  async resetLibraryIssuesFilterData(libraryId) {
    if (!this.libraryFilterData[libraryId]) return // Do nothing if filter data is not set

    this.libraryFilterData[libraryId].numIssues = await this.libraryItemModel.count({
      where: {
        libraryId,
        [Sequelize.Op.or]: [
          {
            isMissing: true
          },
          {
            isInvalid: true
          }
        ]
      }
    })
  }
}

module.exports = new Database()