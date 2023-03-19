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
    modelName: 'playlist'
  })

  const { library, user } = sequelize.models
  library.hasMany(Playlist)
  Playlist.belongsTo(library)

  user.hasMany(Playlist)
  Playlist.belongsTo(user)

  return Playlist
}