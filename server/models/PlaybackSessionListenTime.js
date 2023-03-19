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
    modelName: 'playbackSessionListenTime'
  })

  const { playbackSession } = sequelize.models

  playbackSession.hasMany(PlaybackSessionListenTime)
  PlaybackSessionListenTime.belongsTo(playbackSession)

  return PlaybackSessionListenTime
}