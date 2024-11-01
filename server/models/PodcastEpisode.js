const { DataTypes, Model } = require('sequelize')
const oldPodcastEpisode = require('../objects/entities/PodcastEpisode')

/**
 * @typedef ChapterObject
 * @property {number} id
 * @property {number} start
 * @property {number} end
 * @property {string} title
 */

class PodcastEpisode extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {number} */
    this.index
    /** @type {string} */
    this.season
    /** @type {string} */
    this.episode
    /** @type {string} */
    this.episodeType
    /** @type {string} */
    this.title
    /** @type {string} */
    this.subtitle
    /** @type {string} */
    this.description
    /** @type {string} */
    this.pubDate
    /** @type {string} */
    this.enclosureURL
    /** @type {BigInt} */
    this.enclosureSize
    /** @type {string} */
    this.enclosureType
    /** @type {Date} */
    this.publishedAt
    /** @type {import('./Book').AudioFileObject} */
    this.audioFile
    /** @type {ChapterObject[]} */
    this.chapters
    /** @type {Object} */
    this.extraData
    /** @type {string} */
    this.podcastId
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  /**
   * @param {string} libraryItemId
   * @returns {oldPodcastEpisode}
   */
  getOldPodcastEpisode(libraryItemId = null) {
    let enclosure = null
    if (this.enclosureURL) {
      enclosure = {
        url: this.enclosureURL,
        type: this.enclosureType,
        length: this.enclosureSize !== null ? String(this.enclosureSize) : null
      }
    }
    return new oldPodcastEpisode({
      libraryItemId: libraryItemId || null,
      podcastId: this.podcastId,
      id: this.id,
      oldEpisodeId: this.extraData?.oldEpisodeId || null,
      index: this.index,
      season: this.season,
      episode: this.episode,
      episodeType: this.episodeType,
      title: this.title,
      subtitle: this.subtitle,
      description: this.description,
      enclosure,
      guid: this.extraData?.guid || null,
      pubDate: this.pubDate,
      chapters: this.chapters,
      audioFile: this.audioFile,
      publishedAt: this.publishedAt?.valueOf() || null,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    })
  }

  static createFromOld(oldEpisode) {
    const podcastEpisode = this.getFromOld(oldEpisode)
    return this.create(podcastEpisode)
  }

  static getFromOld(oldEpisode) {
    const extraData = {}
    if (oldEpisode.oldEpisodeId) {
      extraData.oldEpisodeId = oldEpisode.oldEpisodeId
    }
    if (oldEpisode.guid) {
      extraData.guid = oldEpisode.guid
    }
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
      podcastId: oldEpisode.podcastId,
      audioFile: oldEpisode.audioFile?.toJSON() || null,
      chapters: oldEpisode.chapters,
      extraData
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
        chapters: DataTypes.JSON,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'podcastEpisode',
        indexes: [
          {
            name: 'podcastEpisode_createdAt_podcastId',
            fields: ['createdAt', 'podcastId']
          }
        ]
      }
    )

    const { podcast } = sequelize.models
    podcast.hasMany(PodcastEpisode, {
      onDelete: 'CASCADE'
    })
    PodcastEpisode.belongsTo(podcast)
  }
}

module.exports = PodcastEpisode
