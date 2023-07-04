const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PodcastEpisode extends Model {
    getOldPodcastEpisode(libraryItemId = null) {
      let enclosure = null
      if (this.enclosureURL) {
        enclosure = {
          url: this.enclosureURL,
          type: this.enclosureType,
          length: this.enclosureSize !== null ? String(this.enclosureSize) : null
        }
      }
      return {
        libraryItemId: libraryItemId || null,
        podcastId: this.podcastId,
        id: this.id,
        index: this.index,
        season: this.season,
        episode: this.episode,
        episodeType: this.episodeType,
        title: this.title,
        subtitle: this.subtitle,
        description: this.description,
        enclosure,
        pubDate: this.pubDate,
        chapters: this.chapters,
        audioFile: this.audioFile,
        publishedAt: this.publishedAt?.valueOf() || null,
        addedAt: this.createdAt.valueOf(),
        updatedAt: this.updatedAt.valueOf()
      }
    }

    static createFromOld(oldEpisode) {
      const podcastEpisode = this.getFromOld(oldEpisode)
      return this.create(podcastEpisode)
    }

    static getFromOld(oldEpisode) {
      return {
        id: oldEpisode.id,
        index: oldEpisode.index,
        season: oldEpisode.season,
        episode: oldEpisode.episode,
        episodeType: oldEpisode.episodeType,
        title: oldEpisode.title,
        subtitle: oldEpisode.subtitle,
        description: oldEpisode.description,
        pubDate: oldEpisode.pubDate,
        enclosureURL: oldEpisode.enclosure?.url || null,
        enclosureSize: oldEpisode.enclosure?.length || null,
        enclosureType: oldEpisode.enclosure?.type || null,
        publishedAt: oldEpisode.publishedAt,
        createdAt: oldEpisode.addedAt,
        updatedAt: oldEpisode.updatedAt,
        podcastId: oldEpisode.podcastId,
        audioFile: oldEpisode.audioFile?.toJSON() || null,
        chapters: oldEpisode.chapters
      }
    }
  }

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
    publishedAt: DataTypes.DATE,

    audioFile: DataTypes.JSON,
    chapters: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'podcastEpisode'
  })

  const { podcast } = sequelize.models
  podcast.hasMany(PodcastEpisode)
  PodcastEpisode.belongsTo(podcast)

  return PodcastEpisode
}