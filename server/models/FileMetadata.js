const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class FileMetadata extends Model { }

  FileMetadata.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ino: DataTypes.STRING,
    filename: DataTypes.STRING,
    ext: DataTypes.STRING,
    path: DataTypes.STRING,
    size: DataTypes.BIGINT,
    mtime: DataTypes.DATE(6),
    ctime: DataTypes.DATE(6),
    birthtime: DataTypes.DATE(6)
  }, {
    sequelize,
    freezeTableName: true, // sequelize uses datum as singular of data
    name: {
      singular: 'fileMetadata',
      plural: 'fileMetadata'
    },
    modelName: 'fileMetadata'
  })

  return FileMetadata
}