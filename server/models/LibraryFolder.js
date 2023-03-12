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
    modelName: 'LibraryFolder'
  })

  const { Library } = sequelize.models
  Library.hasMany(LibraryFolder)
  LibraryFolder.belongsTo(Library)

  return LibraryFolder
}