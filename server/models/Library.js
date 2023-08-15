const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')
const oldLibrary = require('../objects/Library')


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
    /** @type {Object} */
    this.settings
    /** @type {Object} */
    this.extraData
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * Get all old libraries
   * @returns {Promise<oldLibrary[]>}
   */
  static async getAllOldLibraries() {
    const libraries = await this.findAll({
      include: this.sequelize.models.libraryFolder,
      order: [['displayOrder', 'ASC']]
    })
    return libraries.map(lib => this.getOldLibrary(lib))
  }

  /**
   * Convert expanded Library to oldLibrary
   * @param {Library} libraryExpanded 
   * @returns {Promise<oldLibrary>}
   */
  static getOldLibrary(libraryExpanded) {
    const folders = libraryExpanded.libraryFolders.map(folder => {
      return {
        id: folder.id,
        fullPath: folder.path,
        libraryId: folder.libraryId,
        addedAt: folder.createdAt.valueOf()
      }
    })
    return new oldLibrary({
      id: libraryExpanded.id,
      oldLibraryId: libraryExpanded.extraData?.oldLibraryId || null,
      name: libraryExpanded.name,
      folders,
      displayOrder: libraryExpanded.displayOrder,
      icon: libraryExpanded.icon,
      mediaType: libraryExpanded.mediaType,
      provider: libraryExpanded.provider,
      settings: libraryExpanded.settings,
      createdAt: libraryExpanded.createdAt.valueOf(),
      lastUpdate: libraryExpanded.updatedAt.valueOf()
    })
  }

  /**
   * @param {object} oldLibrary 
   * @returns {Library|null}
   */
  static async createFromOld(oldLibrary) {
    const library = this.getFromOld(oldLibrary)

    library.libraryFolders = oldLibrary.folders.map(folder => {
      return {
        id: folder.id,
        path: folder.fullPath
      }
    })

    return this.create(library, {
      include: this.sequelize.models.libraryFolder
    }).catch((error) => {
      Logger.error(`[Library] Failed to create library ${library.id}`, error)
      return null
    })
  }

  /**
   * Update library and library folders
   * @param {object} oldLibrary 
   * @returns 
   */
  static async updateFromOld(oldLibrary) {
    const existingLibrary = await this.findByPk(oldLibrary.id, {
      include: this.sequelize.models.libraryFolder
    })
    if (!existingLibrary) {
      Logger.error(`[Library] Failed to update library ${oldLibrary.id} - not found`)
      return null
    }

    const library = this.getFromOld(oldLibrary)

    const libraryFolders = oldLibrary.folders.map(folder => {
      return {
        id: folder.id,
        path: folder.fullPath,
        libraryId: library.id
      }
    })
    for (const libraryFolder of libraryFolders) {
      const existingLibraryFolder = existingLibrary.libraryFolders.find(lf => lf.id === libraryFolder.id)
      if (!existingLibraryFolder) {
        await this.sequelize.models.libraryFolder.create(libraryFolder)
      } else if (existingLibraryFolder.path !== libraryFolder.path) {
        await existingLibraryFolder.update({ path: libraryFolder.path })
      }
    }

    const libraryFoldersRemoved = existingLibrary.libraryFolders.filter(lf => !libraryFolders.some(_lf => _lf.id === lf.id))
    for (const existingLibraryFolder of libraryFoldersRemoved) {
      await existingLibraryFolder.destroy()
    }

    return existingLibrary.update(library)
  }

  static getFromOld(oldLibrary) {
    const extraData = {}
    if (oldLibrary.oldLibraryId) {
      extraData.oldLibraryId = oldLibrary.oldLibraryId
    }
    return {
      id: oldLibrary.id,
      name: oldLibrary.name,
      displayOrder: oldLibrary.displayOrder,
      icon: oldLibrary.icon || null,
      mediaType: oldLibrary.mediaType || null,
      provider: oldLibrary.provider,
      settings: oldLibrary.settings?.toJSON() || {},
      createdAt: oldLibrary.createdAt,
      updatedAt: oldLibrary.lastUpdate,
      extraData
    }
  }

  /**
   * Destroy library by id
   * @param {string} libraryId 
   * @returns 
   */
  static removeById(libraryId) {
    return this.destroy({
      where: {
        id: libraryId
      }
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
    return libraries.map(l => l.id)
  }

  /**
   * Find Library by primary key & return oldLibrary
   * @param {string} libraryId 
   * @returns {Promise<oldLibrary|null>} Returns null if not found
   */
  static async getOldById(libraryId) {
    if (!libraryId) return null
    const library = await this.findByPk(libraryId, {
      include: sequelize.models.libraryFolder
    })
    if (!library) return null
    return this.getOldLibrary(library)
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
        Logger.dev(`[Library] Updating display order of library from ${library.displayOrder} to ${i + 1}`)
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
    super.init({
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
    }, {
      sequelize,
      modelName: 'library'
    })
  }
}

module.exports = Library