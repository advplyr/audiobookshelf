const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class EBookFile extends Model { }

  EBookFile.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    format: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'eBookFile'
  })

  const { fileMetadata } = sequelize.models

  fileMetadata.hasOne(EBookFile, { foreignKey: 'fileMetadataId' })
  EBookFile.belongsTo(fileMetadata, { as: 'fileMetadata', foreignKey: 'fileMetadataId' })

  return EBookFile
}