const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class LibrarySetting extends Model { }

  LibrarySetting.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: DataTypes.STRING,
    value: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'LibrarySetting'
  })

  const { Library } = sequelize.models

  Library.hasMany(LibrarySetting)
  LibrarySetting.belongsTo(Library)

  return LibrarySetting
}