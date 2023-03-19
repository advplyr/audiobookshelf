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
    modelName: 'librarySetting'
  })

  const { library } = sequelize.models

  library.hasMany(LibrarySetting)
  LibrarySetting.belongsTo(library)

  return LibrarySetting
}