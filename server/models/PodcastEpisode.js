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
    enclosureLength: DataTypes.BIGINT,
    enclosureType: DataTypes.STRING,
    publishedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'PodcastEpisode'
  })

  const { Podcast } = sequelize.models
  Podcast.hasMany(PodcastEpisode)
  PodcastEpisode.belongsTo(Podcast)

  return PodcastEpisode
}