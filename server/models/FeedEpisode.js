const Path = require('path')
const { DataTypes, Model } = require('sequelize')
const uuidv4 = require('uuid').v4
const Logger = require('../Logger')
const date = require('../libs/dateAndTime')

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
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('./PodcastEpisode')} episode
   */
  static getFeedEpisodeObjFromPodcastEpisode(libraryItemExpanded, feed, slug, episode) {
    return {
      title: episode.title,
      author: feed.author,
      description: episode.description,
      siteURL: feed.siteURL,
      enclosureURL: `/feed/${slug}/item/${episode.id}/media${Path.extname(episode.audioFile.metadata.filename)}`,
      enclosureType: episode.audioFile.mimeType,
      enclosureSize: episode.audioFile.metadata.size,
      pubDate: episode.pubDate,
      season: episode.season,
      episode: episode.episode,
      episodeType: episode.episodeType,
      duration: episode.audioFile.duration,
      filePath: episode.audioFile.metadata.path,
      explicit: libraryItemExpanded.media.explicit,
      feedId: feed.id
    }
  }

  /**
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('sequelize').Transaction} transaction
   * @returns {Promise<FeedEpisode[]>}
   */
  static async createFromPodcastEpisodes(libraryItemExpanded, feed, slug, transaction) {
    const feedEpisodeObjs = []

    // Sort podcastEpisodes by pubDate. episodic is newest to oldest. serial is oldest to newest.
    if (feed.podcastType === 'episodic') {
      libraryItemExpanded.media.podcastEpisodes.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    } else {
      libraryItemExpanded.media.podcastEpisodes.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate))
    }

    for (const episode of libraryItemExpanded.media.podcastEpisodes) {
      feedEpisodeObjs.push(this.getFeedEpisodeObjFromPodcastEpisode(libraryItemExpanded, feed, slug, episode))
    }
    Logger.info(`[FeedEpisode] Creating ${feedEpisodeObjs.length} episodes for feed ${feed.id}`)
    return this.bulkCreate(feedEpisodeObjs, { transaction })
  }

  /**
   * If chapters for an audiobook match the audio tracks then use chapter titles instead of audio file names
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @returns {boolean}
   */
  static checkUseChapterTitlesForEpisodes(libraryItemExpanded) {
    const tracks = libraryItemExpanded.media.trackList || []
    const chapters = libraryItemExpanded.media.chapters || []
    if (tracks.length !== chapters.length) return false
    for (let i = 0; i < tracks.length; i++) {
      if (Math.abs(chapters[i].start - tracks[i].startOffset) >= 1) {
        return false
      }
    }
    return true
  }

  /**
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('./Book').AudioFileObject} audioTrack
   * @param {boolean} useChapterTitles
   * @param {string} [pubDateOverride]
   */
  static getFeedEpisodeObjFromAudiobookTrack(libraryItemExpanded, feed, slug, audioTrack, useChapterTitles, pubDateOverride = null) {
    // Example: <pubDate>Fri, 04 Feb 2015 00:00:00 GMT</pubDate>
    let timeOffset = isNaN(audioTrack.index) ? 0 : Number(audioTrack.index) * 1000 // Offset pubdate to ensure correct order
    let episodeId = uuidv4()

    // e.g. Track 1 will have a pub date before Track 2
    const audiobookPubDate = pubDateOverride || date.format(new Date(libraryItemExpanded.createdAt.valueOf() + timeOffset), 'ddd, DD MMM YYYY HH:mm:ss [GMT]')

    const contentUrl = `/feed/${slug}/item/${episodeId}/media${Path.extname(audioTrack.metadata.filename)}`
    const media = libraryItemExpanded.media

    let title = audioTrack.title
    if (media.trackList.length == 1) {
      // If audiobook is a single file, use book title instead of chapter/file title
      title = media.title
    } else {
      if (useChapterTitles) {
        // If audio track start and chapter start are within 1 seconds of eachother then use the chapter title
        const matchingChapter = media.chapters.find((ch) => Math.abs(ch.start - audioTrack.startOffset) < 1)
        if (matchingChapter?.title) title = matchingChapter.title
      }
    }

    return {
      id: episodeId,
      title,
      author: feed.author,
      description: media.description || '',
      siteURL: feed.siteURL,
      enclosureURL: contentUrl,
      enclosureType: audioTrack.mimeType,
      enclosureSize: audioTrack.metadata.size,
      pubDate: audiobookPubDate,
      duration: audioTrack.duration,
      filePath: audioTrack.metadata.path,
      explicit: media.explicit,
      feedId: feed.id
    }
  }

  /**
   *
   * @param {import('./LibraryItem').LibraryItemExpanded} libraryItemExpanded
   * @param {import('./Feed')} feed
   * @param {string} slug
   * @param {import('sequelize').Transaction} transaction
   * @returns {Promise<FeedEpisode[]>}
   */
  static async createFromAudiobookTracks(libraryItemExpanded, feed, slug, transaction) {
    const useChapterTitles = this.checkUseChapterTitlesForEpisodes(libraryItemExpanded)

    const feedEpisodeObjs = []
    for (const track of libraryItemExpanded.media.trackList) {
      feedEpisodeObjs.push(this.getFeedEpisodeObjFromAudiobookTrack(libraryItemExpanded, feed, slug, track, useChapterTitles))
    }
    Logger.info(`[FeedEpisode] Creating ${feedEpisodeObjs.length} episodes for feed ${feed.id}`)
    return this.bulkCreate(feedEpisodeObjs, { transaction })
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

module.exports = FeedEpisode
