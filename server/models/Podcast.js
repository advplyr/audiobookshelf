const { DataTypes, Model } = require('sequelize')

/**
 * @typedef PodcastExpandedProperties
 * @property {import('./PodcastEpisode')[]} podcastEpisodes
 *
 * @typedef {Podcast & PodcastExpandedProperties} PodcastExpanded
 */

class Podcast extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {string} */
    this.id
    /** @type {string} */
    this.title
    /** @type {string} */
    this.titleIgnorePrefix
    /** @type {string} */
    this.author
    /** @type {string} */
    this.releaseDate
    /** @type {string} */
    this.feedURL
    /** @type {string} */
    this.imageURL
    /** @type {string} */
    this.description
    /** @type {string} */
    this.itunesPageURL
    /** @type {string} */
    this.itunesId
    /** @type {string} */
    this.itunesArtistId
    /** @type {string} */
    this.language
    /** @type {string} */
    this.podcastType
    /** @type {boolean} */
    this.explicit
    /** @type {boolean} */
    this.autoDownloadEpisodes
    /** @type {string} */
    this.autoDownloadSchedule
    /** @type {Date} */
    this.lastEpisodeCheck
    /** @type {number} */
    this.maxEpisodesToKeep
    /** @type {string} */
    this.coverPath
    /** @type {string[]} */
    this.tags
    /** @type {string[]} */
    this.genres
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
  }

  static getOldPodcast(libraryItemExpanded) {
    const podcastExpanded = libraryItemExpanded.media
    const podcastEpisodes = podcastExpanded.podcastEpisodes?.map((ep) => ep.getOldPodcastEpisode(libraryItemExpanded.id).toJSON()).sort((a, b) => a.index - b.index)
    return {
      id: podcastExpanded.id,
      libraryItemId: libraryItemExpanded.id,
      metadata: {
        title: podcastExpanded.title,
        author: podcastExpanded.author,
        description: podcastExpanded.description,
        releaseDate: podcastExpanded.releaseDate,
        genres: podcastExpanded.genres,
        feedUrl: podcastExpanded.feedURL,
        imageUrl: podcastExpanded.imageURL,
        itunesPageUrl: podcastExpanded.itunesPageURL,
        itunesId: podcastExpanded.itunesId,
        itunesArtistId: podcastExpanded.itunesArtistId,
        explicit: podcastExpanded.explicit,
        language: podcastExpanded.language,
        type: podcastExpanded.podcastType
      },
      coverPath: podcastExpanded.coverPath,
      tags: podcastExpanded.tags,
      episodes: podcastEpisodes || [],
      autoDownloadEpisodes: podcastExpanded.autoDownloadEpisodes,
      autoDownloadSchedule: podcastExpanded.autoDownloadSchedule,
      lastEpisodeCheck: podcastExpanded.lastEpisodeCheck?.valueOf() || null,
      maxEpisodesToKeep: podcastExpanded.maxEpisodesToKeep,
      maxNewEpisodesToDownload: podcastExpanded.maxNewEpisodesToDownload
    }
  }

  static getFromOld(oldPodcast) {
    const oldPodcastMetadata = oldPodcast.metadata
    return {
      id: oldPodcast.id,
      title: oldPodcastMetadata.title,
      titleIgnorePrefix: oldPodcastMetadata.titleIgnorePrefix,
      author: oldPodcastMetadata.author,
      releaseDate: oldPodcastMetadata.releaseDate,
      feedURL: oldPodcastMetadata.feedUrl,
      imageURL: oldPodcastMetadata.imageUrl,
      description: oldPodcastMetadata.description,
      itunesPageURL: oldPodcastMetadata.itunesPageUrl,
      itunesId: oldPodcastMetadata.itunesId,
      itunesArtistId: oldPodcastMetadata.itunesArtistId,
      language: oldPodcastMetadata.language,
      podcastType: oldPodcastMetadata.type,
      explicit: !!oldPodcastMetadata.explicit,
      autoDownloadEpisodes: !!oldPodcast.autoDownloadEpisodes,
      autoDownloadSchedule: oldPodcast.autoDownloadSchedule,
      lastEpisodeCheck: oldPodcast.lastEpisodeCheck,
      maxEpisodesToKeep: oldPodcast.maxEpisodesToKeep,
      maxNewEpisodesToDownload: oldPodcast.maxNewEpisodesToDownload,
      coverPath: oldPodcast.coverPath,
      tags: oldPodcast.tags,
      genres: oldPodcastMetadata.genres
    }
  }

  getAbsMetadataJson() {
    return {
      tags: this.tags || [],
      title: this.title,
      author: this.author,
      description: this.description,
      releaseDate: this.releaseDate,
      genres: this.genres || [],
      feedURL: this.feedURL,
      imageURL: this.imageURL,
      itunesPageURL: this.itunesPageURL,
      itunesId: this.itunesId,
      itunesArtistId: this.itunesArtistId,
      language: this.language,
      explicit: !!this.explicit,
      podcastType: this.podcastType
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
        titleIgnorePrefix: DataTypes.STRING,
        author: DataTypes.STRING,
        releaseDate: DataTypes.STRING,
        feedURL: DataTypes.STRING,
        imageURL: DataTypes.STRING,
        description: DataTypes.TEXT,
        itunesPageURL: DataTypes.STRING,
        itunesId: DataTypes.STRING,
        itunesArtistId: DataTypes.STRING,
        language: DataTypes.STRING,
        podcastType: DataTypes.STRING,
        explicit: DataTypes.BOOLEAN,

        autoDownloadEpisodes: DataTypes.BOOLEAN,
        autoDownloadSchedule: DataTypes.STRING,
        lastEpisodeCheck: DataTypes.DATE,
        maxEpisodesToKeep: DataTypes.INTEGER,
        maxNewEpisodesToDownload: DataTypes.INTEGER,
        coverPath: DataTypes.STRING,
        tags: DataTypes.JSON,
        genres: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'podcast'
      }
    )
  }
}

module.exports = Podcast
