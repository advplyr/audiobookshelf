const { DataTypes, Model } = require('sequelize')

class FeedEpisode extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.title
    /** @type {string} */
    this.description
    /** @type {string} */
    this.siteURL
    /** @type {string} */
    this.enclosureURL
    /** @type {string} */
    this.enclosureType
    /** @type {BigInt} */
    this.enclosureSize
    /** @type {string} */
    this.pubDate
    /** @type {string} */
    this.season
    /** @type {string} */
    this.episode
    /** @type {string} */
    this.episodeType
    /** @type {number} */
    this.duration
    /** @type {string} */
    this.filePath
    /** @type {boolean} */
    this.explicit
    /** @type {UUIDV4} */
    this.feedId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

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

  /**
   * Create feed episode from old model
   *
   * @param {string} feedId
   * @param {Object} oldFeedEpisode
   * @returns {Promise<FeedEpisode>}
   */
  static createFromOld(feedId, oldFeedEpisode) {
    const newEpisode = this.getFromOld(oldFeedEpisode)
    newEpisode.feedId = feedId
    return this.create(newEpisode)
  }

  static getFromOld(oldFeedEpisode) {
    return {
      id: oldFeedEpisode.id,
      title: oldFeedEpisode.title,
      author: oldFeedEpisode.author,
      description: oldFeedEpisode.description,
      siteURL: oldFeedEpisode.link,
      enclosureURL: oldFeedEpisode.enclosure?.url || null,
      enclosureType: oldFeedEpisode.enclosure?.type || null,
      enclosureSize: oldFeedEpisode.enclosure?.size || null,
      pubDate: oldFeedEpisode.pubDate,
      season: oldFeedEpisode.season || null,
      episode: oldFeedEpisode.episode || null,
      episodeType: oldFeedEpisode.episodeType || null,
      duration: oldFeedEpisode.duration,
      filePath: oldFeedEpisode.fullPath,
      explicit: !!oldFeedEpisode.explicit
    }
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize) {
    super.init(
      {
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
      },
      {
        sequelize,
        modelName: 'feedEpisode'
      }
    )

    const { feed } = sequelize.models

    feed.hasMany(FeedEpisode, {
      onDelete: 'CASCADE'
    })
    FeedEpisode.belongsTo(feed)
  }
}

module.exports = FeedEpisode
