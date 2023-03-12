const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class EBookFile extends Model { }

  EBookFile.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'EBookFile'
  })

  const { FileMetadata } = sequelize.models

  FileMetadata.hasOne(EBookFile)
  EBookFile.belongsTo(FileMetadata)

  return EBookFile
}