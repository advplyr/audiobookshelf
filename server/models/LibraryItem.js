const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class LibraryItem extends Model { }

  LibraryItem.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ino: DataTypes.STRING,
    path: DataTypes.STRING,
    relPath: DataTypes.STRING,
    mediaType: DataTypes.STRING,
    isFile: DataTypes.BOOLEAN,
    isMissing: DataTypes.BOOLEAN,
    isInvalid: DataTypes.BOOLEAN,
    mtime: DataTypes.DATE(6),
    ctime: DataTypes.DATE(6),
    birthtime: DataTypes.DATE(6),
    lastScan: DataTypes.DATE,
    lastScanVersion: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'LibraryItem'
  })

  const { LibraryFolder } = sequelize.models
  LibraryFolder.hasMany(LibraryItem)
  LibraryItem.belongsTo(LibraryFolder)

  return LibraryItem
}