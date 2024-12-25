const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')

/**
 * @typedef LibrarySettingsObject
 * @property {number} coverAspectRatio BookCoverAspectRatio
 * @property {boolean} disableWatcher
 * @property {boolean} skipMatchingMediaWithAsin
 * @property {boolean} skipMatchingMediaWithIsbn
 * @property {string} autoScanCronExpression
 * @property {boolean} audiobooksOnly
 * @property {boolean} hideSingleBookSeries Do not show series that only have 1 book
 * @property {boolean} onlyShowLaterBooksInContinueSeries Skip showing books that are earlier than the max sequence read
 * @property {string[]} metadataPrecedence
 * @property {number} markAsFinishedTimeRemaining Time remaining in seconds to mark as finished. (defaults to 10s)
 * @property {number} markAsFinishedPercentComplete Percent complete to mark as finished (0-100). If this is set it will be used over markAsFinishedTimeRemaining.
 */

class Library extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {number} */
    this.displayOrder
    /** @type {string} */
    this.icon
    /** @type {string} */
    this.mediaType
    /** @type {string} */
    this.provider
    /** @type {Date} */
    this.lastScan
    /** @type {string} */
    this.lastScanVersion
    /** @type {LibrarySettingsObject} */
    this.settings
    /** @type {Object} */
    this.extraData
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
    /** @type {import('./LibraryFolder')[]|undefined} */
    this.libraryFolders
  }

  /**
   *
   * @param {string} mediaType
   * @returns
   */
  static getDefaultLibrarySettingsForMediaType(mediaType) {
    if (mediaType === 'podcast') {
      return {
        coverAspectRatio: 1, // Square
        disableWatcher: false,
        autoScanCronExpression: null,
        podcastSearchRegion: 'us',
        markAsFinishedPercentComplete: null,
        markAsFinishedTimeRemaining: 10
      }
    } else {
      return {
        coverAspectRatio: 1, // Square
        disableWatcher: false,
        autoScanCronExpression: null,
        skipMatchingMediaWithAsin: false,
        skipMatchingMediaWithIsbn: false,
        audiobooksOnly: false,
        epubsAllowScriptedContent: false,
        hideSingleBookSeries: false,
        onlyShowLaterBooksInContinueSeries: false,
        metadataPrecedence: this.defaultMetadataPrecedence,
        markAsFinishedPercentComplete: null,
        markAsFinishedTimeRemaining: 10
      }
    }
  }

  static get defaultMetadataPrecedence() {
    return ['folderStructure', 'audioMetatags', 'nfoFile', 'txtFiles', 'opfFile', 'absMetadata']
  }

  /**
   *
   * @returns {Promise<Library[]>}
   */
  static getAllWithFolders() {
    return this.findAll({
      include: this.sequelize.models.libraryFolder,
      order: [['displayOrder', 'ASC']]
    })
  }

  /**
   *
   * @param {string} libraryId
   * @returns {Promise<Library>}
   */
  static findByIdWithFolders(libraryId) {
    return this.findByPk(libraryId, {
      include: this.sequelize.models.libraryFolder
    })
  }

  /**
   * Get all library ids
   * @returns {Promise<string[]>} array of library ids
   */
  static async getAllLibraryIds() {
    const libraries = await this.findAll({
      attributes: ['id', 'displayOrder'],
      order: [['displayOrder', 'ASC']]
    })
    return libraries.map((l) => l.id)
  }

  /**
   * Get the largest value in the displayOrder column
   * Used for setting a new libraries display order
   * @returns {Promise<number>}
   */
  static getMaxDisplayOrder() {
    return this.max('displayOrder') || 0
  }

  /**
   * Updates displayOrder to be sequential
   * Used after removing a library
   */
  static async resetDisplayOrder() {
    const libraries = await this.findAll({
      order: [['displayOrder', 'ASC']]
    })
    for (let i = 0; i < libraries.length; i++) {
      const library = libraries[i]
      if (library.displayOrder !== i + 1) {
        Logger.debug(`[Library] Updating display order of library from ${library.displayOrder} to ${i + 1}`)
        await library.update({ displayOrder: i + 1 }).catch((error) => {
          Logger.error(`[Library] Failed to update library display order to ${i + 1}`, error)
        })
      }
    }
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        displayOrder: DataTypes.INTEGER,
        icon: DataTypes.STRING,
        mediaType: DataTypes.STRING,
        provider: DataTypes.STRING,
        lastScan: DataTypes.DATE,
        lastScanVersion: DataTypes.STRING,
        settings: DataTypes.JSON,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'library'
      }
    )
  }

  get isPodcast() {
    return this.mediaType === 'podcast'
  }
  get isBook() {
    return this.mediaType === 'book'
  }
  /**
   * @returns {string[]}
   */
  get lastScanMetadataPrecedence() {
    return this.extraData?.lastScanMetadataPrecedence || []
  }

  /**
   * @returns {LibrarySettingsObject}
   */
  get librarySettings() {
    return this.settings || Library.getDefaultLibrarySettingsForMediaType(this.mediaType)
  }

  /**
   * TODO: Update to use new model
   */
  toOldJSON() {
    return {
      id: this.id,
      name: this.name,
      folders: (this.libraryFolders || []).map((f) => f.toOldJSON()),
      displayOrder: this.displayOrder,
      icon: this.icon,
      mediaType: this.mediaType,
      provider: this.provider,
      settings: {
        ...this.settings
      },
      lastScan: this.lastScan?.valueOf() || null,
      lastScanVersion: this.lastScanVersion,
      createdAt: this.createdAt.valueOf(),
      lastUpdate: this.updatedAt.valueOf()
    }
  }
}

module.exports = Library
