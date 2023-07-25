const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class LibraryFolder extends Model {
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
  }

  LibraryFolder.init({
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

  return LibraryFolder
}