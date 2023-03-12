const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Playlist extends Model { }

  Playlist.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Playlist'
  })

  const { Library, User } = sequelize.models
  Library.hasMany(Playlist)
  Playlist.belongsTo(Library)

  User.hasMany(Playlist)
  Playlist.belongsTo(User)

  return Playlist
}