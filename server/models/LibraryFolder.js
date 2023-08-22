const { DataTypes, Model } = require('sequelize')

class LibraryFolder extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.path
    /** @type {UUIDV4} */
    this.libraryId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * Gets all library folder path strings
   * @returns {Promise<string[]>} array of library folder paths
   */
  static async getAllLibraryFolderPaths() {
    const libraryFolders = await this.findAll({
      attributes: ['path']
    })
    return libraryFolders.map(l => l.path)
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
      path: DataTypes.STRING
    }, {
      sequelize,
      modelName: 'libraryFolder'
    })

    const { library } = sequelize.models
    library.hasMany(LibraryFolder, {
      onDelete: 'CASCADE'
    })
    LibraryFolder.belongsTo(library)
  }
}

module.exports = LibraryFolder