const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class LibraryFolder extends Model { }

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