const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class MediaFile extends Model { }

  MediaFile.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    formatName: DataTypes.STRING,
    formatNameLong: DataTypes.STRING,
    duration: DataTypes.FLOAT,
    bitrate: DataTypes.INTEGER,
    size: DataTypes.BIGINT,
    tags: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'MediaFile'
  })

  const { FileMetadata } = sequelize.models

  FileMetadata.hasOne(MediaFile, { foreignKey: 'FileMetadataId' })
  MediaFile.belongsTo(FileMetadata, { as: 'FileMetadata', foreignKey: 'FileMetadataId' })

  return MediaFile
}