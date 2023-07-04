const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class FeedEpisode extends Model {
    getOldEpisode() {
      const enclosure = {
        url: this.enclosureURL,
        size: this.enclosureSize,
        type: this.enclosureType
      }
      return {
        id: this.id,
        title: this.title,
        description: this.description,
        enclosure,
        pubDate: this.pubDate,
        link: this.siteURL,
        author: this.author,
        explicit: this.explicit,
        duration: this.duration,
        season: this.season,
        episode: this.episode,
        episodeType: this.episodeType,
        fullPath: this.filePath
      }
    }
  }

  FeedEpisode.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: DataTypes.STRING,
    author: DataTypes.STRING,
    description: DataTypes.TEXT,
    siteURL: DataTypes.STRING,
    enclosureURL: DataTypes.STRING,
    enclosureType: DataTypes.STRING,
    enclosureSize: DataTypes.BIGINT,
    pubDate: DataTypes.STRING,
    season: DataTypes.STRING,
    episode: DataTypes.STRING,
    episodeType: DataTypes.STRING,
    duration: DataTypes.FLOAT,
    filePath: DataTypes.STRING,
    explicit: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'feedEpisode'
  })

  const { feed } = sequelize.models

  feed.hasMany(FeedEpisode)
  FeedEpisode.belongsTo(feed)

  return FeedEpisode
}