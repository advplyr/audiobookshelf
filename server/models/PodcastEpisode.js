const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PodcastEpisode extends Model { }

  PodcastEpisode.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    index: DataTypes.INTEGER,
    season: DataTypes.STRING,
    episode: DataTypes.STRING,
    episodeType: DataTypes.STRING,
    title: DataTypes.STRING,
    subtitle: DataTypes.STRING(1000),
    description: DataTypes.TEXT,
    pubDate: DataTypes.STRING,
    enclosureURL: DataTypes.STRING,
    enclosureSize: DataTypes.BIGINT,
    enclosureType: DataTypes.STRING,
    publishedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'podcastEpisode'
  })

  const { podcast } = sequelize.models
  podcast.hasMany(PodcastEpisode)
  PodcastEpisode.belongsTo(podcast)

  return PodcastEpisode
}