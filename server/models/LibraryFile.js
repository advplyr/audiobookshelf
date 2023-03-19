const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class LibraryFile extends Model { }

  LibraryFile.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'libraryFile'
  })

  const { libraryItem, fileMetadata } = sequelize.models
  libraryItem.hasMany(LibraryFile)
  LibraryFile.belongsTo(libraryItem)

  fileMetadata.hasOne(LibraryFile, { foreignKey: 'fileMetadataId' })
  LibraryFile.belongsTo(fileMetadata, { as: 'fileMetadata', foreignKey: 'fileMetadataId' })

  return LibraryFile
}