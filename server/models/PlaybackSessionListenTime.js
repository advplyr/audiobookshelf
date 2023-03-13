const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PlaybackSessionListenTime extends Model { }

  PlaybackSessionListenTime.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    time: DataTypes.INTEGER,
    date: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'PlaybackSessionListenTime'
  })

  const { PlaybackSession } = sequelize.models

  PlaybackSession.hasMany(PlaybackSessionListenTime)
  PlaybackSessionListenTime.belongsTo(PlaybackSession)

  return PlaybackSessionListenTime
}