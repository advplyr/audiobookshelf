const Path = require('path')
const { Sequelize, Op } = require('sequelize')

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

    this.settings = []

    // Cached library filter data
    this.libraryFilterData = {}

    /** @type {import('./objects/settings/ServerSettings')} */
    this.serverSettings = null
    /** @type {import('./objects/settings/NotificationSettings')} */
    this.notificationSettings = null
    /** @type {import('./objects/settings/EmailSettings')} */
    this.emailSettings = null
  }

  get models() {
    return this.sequelize?.models || {}
  }

  /** @type {typeof import('./models/User')} */
  get userModel() {
    return this.models.user
  }

  /** @type {typeof import('./models/Library')} */
  get libraryModel() {
    return this.models.library
  }

  /** @type {typeof import('./models/LibraryFolder')} */
  get libraryFolderModel() {
    return this.models.libraryFolder
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

  /** @type {typeof import('./models/BookSeries')} */
  get bookSeriesModel() {
    return this.models.bookSeries
  }

  /** @type {typeof import('./models/BookAuthor')} */
  get bookAuthorModel() {
    return this.models.bookAuthor
  }

  /** @type {typeof import('./models/Podcast')} */
  get podcastModel() {
    return this.models.podcast
  }

  /** @type {typeof import('./models/PodcastEpisode')} */
  get podcastEpisodeModel() {
    return this.models.podcastEpisode
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

  /** @type {typeof import('./models/Collection')} */
  get collectionModel() {
    return this.models.collection
  }

  /** @type {typeof import('./models/CollectionBook')} */
  get collectionBookModel() {
    return this.models.collectionBook
  }

  /** @type {typeof import('./models/Playlist')} */
  get playlistModel() {
    return this.models.playlist
  }

  /** @type {typeof import('./models/PlaylistMediaItem')} */
  get playlistMediaItemModel() {
    return this.models.playlistMediaItem
  }

  /** @type {typeof import('./models/Feed')} */
  get feedModel() {
    return this.models.feed
  }

  /** @type {typeof import('./models/FeedEpisode')} */
  get feedEpisodeModel() {
    return this.models.feedEpisode
  }

  /** @type {typeof import('./models/PlaybackSession')} */
  get playbackSessionModel() {
    return this.models.playbackSession
  }

  /** @type {typeof import('./models/CustomMetadataProvider')} */
  get customMetadataProviderModel() {
    return this.models.customMetadataProvider
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

    let logging = false
    let benchmark = false
    if (process.env.QUERY_LOGGING === "log") {
      // Setting QUERY_LOGGING=log will log all Sequelize queries before they run
      Logger.info(`[Database] Query logging enabled`)
      logging = (query) => Logger.debug(`Running the following query:\n ${query}`)
    } else if (process.env.QUERY_LOGGING === "benchmark") {
      // Setting QUERY_LOGGING=benchmark will log all Sequelize queries and their execution times, after they run
      Logger.info(`[Database] Query benchmarking enabled"`)
      logging = (query, time) => Logger.debug(`Ran the following query in ${time}ms:\n ${query}`)
      benchmark = true
    }

    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: this.dbPath,
      logging: logging,
      benchmark: benchmark,
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
    require('./models/CustomMetadataProvider').init(this.sequelize)

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

    const settingsData = await this.models.setting.getOldSettings()
    this.settings = settingsData.settings
    this.emailSettings = settingsData.emailSettings
    this.serverSettings = settingsData.serverSettings
    this.notificationSettings = settingsData.notificationSettings
    global.ServerSettings = this.serverSettings.toJSON()

    // Version specific migrations
    if (packageJson.version !== this.serverSettings.version) {
      if (this.serverSettings.version === '2.3.0' && this.compareVersions(packageJson.version, '2.3.0') == 1) {
        await dbMigration.migrationPatch(this)
      }
      if (['2.3.0', '2.3.1', '2.3.2', '2.3.3'].includes(this.serverSettings.version) && this.compareVersions(packageJson.version, '2.3.3') >= 0) {
        await dbMigration.migrationPatch2(this)
      }
    }
    // Build migrations
    if (this.serverSettings.buildNumber <= 0) {
      await require('./utils/migrations/absMetadataMigration').migrate(this)
    }

    await this.cleanDatabase()

    // Set if root user has been created
    this.hasRootUser = await this.models.user.getHasRootUser()

    // Update server settings with version/build
    let updateServerSettings = false
    if (packageJson.version !== this.serverSettings.version) {
      Logger.info(`[Database] Server upgrade detected from ${this.serverSettings.version} to ${packageJson.version}`)
      this.serverSettings.version = packageJson.version
      this.serverSettings.buildNumber = packageJson.buildNumber
      updateServerSettings = true
    } else if (packageJson.buildNumber !== this.serverSettings.buildNumber) {
      Logger.info(`[Database] Server v${packageJson.version} build upgraded from ${this.serverSettings.buildNumber} to ${packageJson.buildNumber}`)
      this.serverSettings.buildNumber = packageJson.buildNumber
      updateServerSettings = true
    }
    if (updateServerSettings) {
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

  removeUser(userId) {
    if (!this.sequelize) return false
    return this.models.user.removeById(userId)
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

  createLibrary(oldLibrary) {
    if (!this.sequelize) return false
    return this.models.library.createFromOld(oldLibrary)
  }

  updateLibrary(oldLibrary) {
    if (!this.sequelize) return false
    return this.models.library.updateFromOld(oldLibrary)
  }

  removeLibrary(libraryId) {
    if (!this.sequelize) return false
    return this.models.library.removeById(libraryId)
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

  async createLibraryItem(oldLibraryItem) {
    if (!this.sequelize) return false
    await oldLibraryItem.saveMetadata()
    await this.models.libraryItem.fullCreateFromOld(oldLibraryItem)
  }

  /**
   * Save metadata file and update library item
   * 
   * @param {import('./objects/LibraryItem')} oldLibraryItem 
   * @returns {Promise<boolean>}
   */
  async updateLibraryItem(oldLibraryItem) {
    if (!this.sequelize) return false
    await oldLibraryItem.saveMetadata()
    const updated = await this.models.libraryItem.fullUpdateFromOld(oldLibraryItem)
    // Clear library filter data cache
    if (updated) {
      delete this.libraryFilterData[oldLibraryItem.libraryId]
    }
    return updated
  }

  async removeLibraryItem(libraryItemId) {
    if (!this.sequelize) return false
    await this.models.libraryItem.removeById(libraryItemId)
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
  }

  async createBulkSeries(oldSeriesObjs) {
    if (!this.sequelize) return false
    await this.models.series.createBulkFromOld(oldSeriesObjs)
  }

  async removeSeries(seriesId) {
    if (!this.sequelize) return false
    await this.models.series.removeById(seriesId)
  }

  async createAuthor(oldAuthor) {
    if (!this.sequelize) return false
    await this.models.author.createFromOld(oldAuthor)
  }

  async createBulkAuthors(oldAuthors) {
    if (!this.sequelize) return false
    await this.models.author.createBulkFromOld(oldAuthors)
  }

  updateAuthor(oldAuthor) {
    if (!this.sequelize) return false
    return this.models.author.updateFromOld(oldAuthor)
  }

  async removeAuthor(authorId) {
    if (!this.sequelize) return false
    await this.models.author.removeById(authorId)
  }

  async createBulkBookAuthors(bookAuthors) {
    if (!this.sequelize) return false
    await this.models.bookAuthor.bulkCreate(bookAuthors)
  }

  async removeBulkBookAuthors(authorId = null, bookId = null) {
    if (!this.sequelize) return false
    if (!authorId && !bookId) return
    await this.models.bookAuthor.removeByIds(authorId, bookId)
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

  replaceTagInFilterData(oldTag, newTag) {
    for (const libraryId in this.libraryFilterData) {
      const indexOf = this.libraryFilterData[libraryId].tags.findIndex(n => n === oldTag)
      if (indexOf >= 0) {
        this.libraryFilterData[libraryId].tags.splice(indexOf, 1, newTag)
      }
    }
  }

  removeTagFromFilterData(tag) {
    for (const libraryId in this.libraryFilterData) {
      this.libraryFilterData[libraryId].tags = this.libraryFilterData[libraryId].tags.filter(t => t !== tag)
    }
  }

  addTagsToFilterData(libraryId, tags) {
    if (!this.libraryFilterData[libraryId] || !tags?.length) return
    tags.forEach((t) => {
      if (!this.libraryFilterData[libraryId].tags.includes(t)) {
        this.libraryFilterData[libraryId].tags.push(t)
      }
    })
  }

  replaceGenreInFilterData(oldGenre, newGenre) {
    for (const libraryId in this.libraryFilterData) {
      const indexOf = this.libraryFilterData[libraryId].genres.findIndex(n => n === oldGenre)
      if (indexOf >= 0) {
        this.libraryFilterData[libraryId].genres.splice(indexOf, 1, newGenre)
      }
    }
  }

  removeGenreFromFilterData(genre) {
    for (const libraryId in this.libraryFilterData) {
      this.libraryFilterData[libraryId].genres = this.libraryFilterData[libraryId].genres.filter(g => g !== genre)
    }
  }

  addGenresToFilterData(libraryId, genres) {
    if (!this.libraryFilterData[libraryId] || !genres?.length) return
    genres.forEach((g) => {
      if (!this.libraryFilterData[libraryId].genres.includes(g)) {
        this.libraryFilterData[libraryId].genres.push(g)
      }
    })
  }

  replaceNarratorInFilterData(oldNarrator, newNarrator) {
    for (const libraryId in this.libraryFilterData) {
      const indexOf = this.libraryFilterData[libraryId].narrators.findIndex(n => n === oldNarrator)
      if (indexOf >= 0) {
        this.libraryFilterData[libraryId].narrators.splice(indexOf, 1, newNarrator)
      }
    }
  }

  removeNarratorFromFilterData(narrator) {
    for (const libraryId in this.libraryFilterData) {
      this.libraryFilterData[libraryId].narrators = this.libraryFilterData[libraryId].narrators.filter(n => n !== narrator)
    }
  }

  addNarratorsToFilterData(libraryId, narrators) {
    if (!this.libraryFilterData[libraryId] || !narrators?.length) return
    narrators.forEach((n) => {
      if (!this.libraryFilterData[libraryId].narrators.includes(n)) {
        this.libraryFilterData[libraryId].narrators.push(n)
      }
    })
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

  addPublisherToFilterData(libraryId, publisher) {
    if (!this.libraryFilterData[libraryId] || !publisher || this.libraryFilterData[libraryId].publishers.includes(publisher)) return
    this.libraryFilterData[libraryId].publishers.push(publisher)
  }

  addLanguageToFilterData(libraryId, language) {
    if (!this.libraryFilterData[libraryId] || !language || this.libraryFilterData[libraryId].languages.includes(language)) return
    this.libraryFilterData[libraryId].languages.push(language)
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
   * Get author id for library by name. Uses library filter data if available
   * 
   * @param {string} libraryId 
   * @param {string} authorName 
   * @returns {Promise<string>} author id or null if not found 
   */
  async getAuthorIdByName(libraryId, authorName) {
    if (!this.libraryFilterData[libraryId]) {
      return (await this.authorModel.getOldByNameAndLibrary(authorName, libraryId))?.id || null
    }
    return this.libraryFilterData[libraryId].authors.find(au => au.name === authorName)?.id || null
  }

  /**
   * Get series id for library by name. Uses library filter data if available
   * 
   * @param {string} libraryId 
   * @param {string} seriesName 
   * @returns {Promise<string>} series id or null if not found
   */
  async getSeriesIdByName(libraryId, seriesName) {
    if (!this.libraryFilterData[libraryId]) {
      return (await this.seriesModel.getOldByNameAndLibrary(seriesName, libraryId))?.id || null
    }
    return this.libraryFilterData[libraryId].series.find(se => se.name === seriesName)?.id || null
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

  /**
   * Clean invalid records in database
   * Series should have atleast one Book
   * Book and Podcast must have an associated LibraryItem
   * Remove playback sessions that are 3 seconds or less
   */
  async cleanDatabase() {
    // Remove invalid Podcast records
    const podcastsWithNoLibraryItem = await this.podcastModel.findAll({
      include: {
        model: this.libraryItemModel,
        required: false
      },
      where: { '$libraryItem.id$': null }
    })
    for (const podcast of podcastsWithNoLibraryItem) {
      Logger.warn(`Found podcast "${podcast.title}" with no libraryItem - removing it`)
      await podcast.destroy()
    }

    // Remove invalid Book records
    const booksWithNoLibraryItem = await this.bookModel.findAll({
      include: {
        model: this.libraryItemModel,
        required: false
      },
      where: { '$libraryItem.id$': null }
    })
    for (const book of booksWithNoLibraryItem) {
      Logger.warn(`Found book "${book.title}" with no libraryItem - removing it`)
      await book.destroy()
    }

    // Remove empty series
    const emptySeries = await this.seriesModel.findAll({
      include: {
        model: this.bookSeriesModel,
        required: false
      },
      where: { '$bookSeries.id$': null }
    })
    for (const series of emptySeries) {
      Logger.warn(`Found series "${series.name}" with no books - removing it`)
      await series.destroy()
    }

    // Remove playback sessions that were 3 seconds or less
    const badSessionsRemoved = await this.playbackSessionModel.destroy({
      where: {
        timeListening: {
          [Op.lte]: 3
        }
      }
    })
    if (badSessionsRemoved > 0) {
      Logger.warn(`Removed ${badSessionsRemoved} sessions that were 3 seconds or less`)
    }
  }
}

module.exports = new Database()