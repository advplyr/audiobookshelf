const { DataTypes, Model } = require('sequelize')
const { getTitlePrefixAtEnd, getTitleIgnorePrefix } = require('../utils')
const Logger = require('../Logger')

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
    /** @type {number} */
    this.maxNewEpisodesToDownload
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

    /** @type {import('./PodcastEpisode')[]} */
    this.podcastEpisodes
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

  get hasMediaFiles() {
    return !!this.podcastEpisodes?.length
  }

  get hasAudioTracks() {
    return this.hasMediaFiles
  }

  get size() {
    if (!this.podcastEpisodes?.length) return 0
    return this.podcastEpisodes.reduce((total, episode) => total + episode.size, 0)
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
   *
   * @param {Object} payload - Old podcast object
   * @returns {Promise<boolean>}
   */
  async updateFromRequest(payload) {
    if (!payload) return false

    let hasUpdates = false

    if (payload.metadata) {
      const stringKeys = ['title', 'author', 'releaseDate', 'feedUrl', 'imageUrl', 'description', 'itunesPageUrl', 'itunesId', 'itunesArtistId', 'language', 'type']
      stringKeys.forEach((key) => {
        let newKey = key
        if (key === 'type') {
          newKey = 'podcastType'
        } else if (key === 'feedUrl') {
          newKey = 'feedURL'
        } else if (key === 'imageUrl') {
          newKey = 'imageURL'
        } else if (key === 'itunesPageUrl') {
          newKey = 'itunesPageURL'
        }
        if (typeof payload.metadata[key] === 'string' && payload.metadata[key] !== this[newKey]) {
          this[newKey] = payload.metadata[key]
          if (key === 'title') {
            this.titleIgnorePrefix = getTitleIgnorePrefix(this.title)
          }

          hasUpdates = true
        }
      })

      if (payload.metadata.explicit !== undefined && payload.metadata.explicit !== this.explicit) {
        this.explicit = !!payload.metadata.explicit
        hasUpdates = true
      }

      if (Array.isArray(payload.metadata.genres) && !payload.metadata.genres.some((item) => typeof item !== 'string') && JSON.stringify(this.genres) !== JSON.stringify(payload.metadata.genres)) {
        this.genres = payload.metadata.genres
        this.changed('genres', true)
        hasUpdates = true
      }
    }

    if (Array.isArray(payload.tags) && !payload.tags.some((item) => typeof item !== 'string') && JSON.stringify(this.tags) !== JSON.stringify(payload.tags)) {
      this.tags = payload.tags
      this.changed('tags', true)
      hasUpdates = true
    }

    if (payload.autoDownloadEpisodes !== undefined && payload.autoDownloadEpisodes !== this.autoDownloadEpisodes) {
      this.autoDownloadEpisodes = !!payload.autoDownloadEpisodes
      hasUpdates = true
    }
    if (typeof payload.autoDownloadSchedule === 'string' && payload.autoDownloadSchedule !== this.autoDownloadSchedule) {
      this.autoDownloadSchedule = payload.autoDownloadSchedule
      hasUpdates = true
    }
    if (typeof payload.lastEpisodeCheck === 'number' && payload.lastEpisodeCheck !== this.lastEpisodeCheck?.valueOf()) {
      this.lastEpisodeCheck = payload.lastEpisodeCheck
      hasUpdates = true
    }

    const numberKeys = ['maxEpisodesToKeep', 'maxNewEpisodesToDownload']
    numberKeys.forEach((key) => {
      if (typeof payload[key] === 'number' && payload[key] !== this[key]) {
        this[key] = payload[key]
        hasUpdates = true
      }
    })

    if (hasUpdates) {
      Logger.debug(`[Podcast] changed keys:`, this.changed())
      await this.save()
    }

    return hasUpdates
  }

  checkCanDirectPlay(supportedMimeTypes, episodeId) {
    if (!Array.isArray(supportedMimeTypes)) {
      Logger.error(`[Podcast] checkCanDirectPlay: supportedMimeTypes is not an array`, supportedMimeTypes)
      return false
    }
    const episode = this.podcastEpisodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] checkCanDirectPlay: episode not found`, episodeId)
      return false
    }
    return supportedMimeTypes.includes(episode.audioFile.mimeType)
  }

  /**
   * Get the track list to be used in client audio players
   * AudioTrack is the AudioFile with startOffset and contentUrl
   * Podcast episodes only have one track
   *
   * @param {string} libraryItemId
   * @param {string} episodeId
   * @returns {import('./Book').AudioTrack[]}
   */
  getTracklist(libraryItemId, episodeId) {
    const episode = this.podcastEpisodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] getTracklist: episode not found`, episodeId)
      return []
    }

    const audioTrack = episode.getAudioTrack(libraryItemId)
    return [audioTrack]
  }

  /**
   *
   * @param {string} episodeId
   * @returns {import('./PodcastEpisode').ChapterObject[]}
   */
  getChapters(episodeId) {
    const episode = this.podcastEpisodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] getChapters: episode not found`, episodeId)
      return []
    }

    return structuredClone(episode.chapters) || []
  }

  getPlaybackTitle(episodeId) {
    const episode = this.podcastEpisodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] getPlaybackTitle: episode not found`, episodeId)
      return ''
    }

    return episode.title
  }

  getPlaybackAuthor() {
    return this.author
  }

  getPlaybackDuration(episodeId) {
    const episode = this.podcastEpisodes.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] getPlaybackDuration: episode not found`, episodeId)
      return 0
    }

    return episode.duration
  }

  /**
   *
   * @returns {number} - Unix timestamp
   */
  getLatestEpisodePublishedAt() {
    return this.podcastEpisodes.reduce((latest, episode) => {
      if (episode.publishedAt?.valueOf() > latest) {
        return episode.publishedAt.valueOf()
      }
      return latest
    }, 0)
  }

  /**
   * Used for checking if an rss feed episode is already in the podcast
   *
   * @param {Object} feedEpisode - object from rss feed
   * @returns {boolean}
   */
  checkHasEpisodeByFeedEpisode(feedEpisode) {
    const guid = feedEpisode.guid
    const url = feedEpisode.enclosure.url
    return this.podcastEpisodes.some((ep) => ep.checkMatchesGuidOrEnclosureUrl(guid, url))
  }

  /**
   * Old model kept metadata in a separate object
   */
  oldMetadataToJSON() {
    return {
      title: this.title,
      author: this.author,
      description: this.description,
      releaseDate: this.releaseDate,
      genres: [...(this.genres || [])],
      feedUrl: this.feedURL,
      imageUrl: this.imageURL,
      itunesPageUrl: this.itunesPageURL,
      itunesId: this.itunesId,
      itunesArtistId: this.itunesArtistId,
      explicit: this.explicit,
      language: this.language,
      type: this.podcastType
    }
  }

  oldMetadataToJSONExpanded() {
    const oldMetadataJSON = this.oldMetadataToJSON()
    oldMetadataJSON.titleIgnorePrefix = getTitlePrefixAtEnd(this.title)
    return oldMetadataJSON
  }

  /**
   * The old model stored episodes with the podcast object
   *
   * @param {string} libraryItemId
   */
  toOldJSON(libraryItemId) {
    if (!libraryItemId) {
      throw new Error(`[Podcast] Cannot convert to old JSON because libraryItemId is not provided`)
    }
    if (!this.podcastEpisodes) {
      throw new Error(`[Podcast] Cannot convert to old JSON because episodes are not provided`)
    }

    return {
      id: this.id,
      libraryItemId: libraryItemId,
      metadata: this.oldMetadataToJSON(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      episodes: this.podcastEpisodes.map((episode) => episode.toOldJSON(libraryItemId)),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck?.valueOf() || null,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload
    }
  }

  toOldJSONMinified() {
    return {
      id: this.id,
      // Minified metadata and expanded metadata are the same
      metadata: this.oldMetadataToJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      numEpisodes: this.podcastEpisodes?.length || 0,
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck?.valueOf() || null,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }

  toOldJSONExpanded(libraryItemId) {
    if (!libraryItemId) {
      throw new Error(`[Podcast] Cannot convert to old JSON because libraryItemId is not provided`)
    }
    if (!this.podcastEpisodes) {
      throw new Error(`[Podcast] Cannot convert to old JSON because episodes are not provided`)
    }

    return {
      id: this.id,
      libraryItemId: libraryItemId,
      metadata: this.oldMetadataToJSONExpanded(),
      coverPath: this.coverPath,
      tags: [...(this.tags || [])],
      episodes: this.podcastEpisodes.map((e) => e.toOldJSONExpanded(libraryItemId)),
      autoDownloadEpisodes: this.autoDownloadEpisodes,
      autoDownloadSchedule: this.autoDownloadSchedule,
      lastEpisodeCheck: this.lastEpisodeCheck?.valueOf() || null,
      maxEpisodesToKeep: this.maxEpisodesToKeep,
      maxNewEpisodesToDownload: this.maxNewEpisodesToDownload,
      size: this.size
    }
  }
}

module.exports = Podcast
