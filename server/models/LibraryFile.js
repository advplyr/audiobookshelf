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
    modelName: 'LibraryFile'
  })

  const { LibraryItem, FileMetadata } = sequelize.models
  LibraryItem.hasMany(LibraryFile)
  LibraryFile.belongsTo(LibraryItem)

  FileMetadata.hasOne(LibraryFile, { foreignKey: 'FileMetadataId' })
  LibraryFile.belongsTo(FileMetadata, { as: 'FileMetadata', foreignKey: 'FileMetadataId' })

  return LibraryFile
}