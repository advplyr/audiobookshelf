const { DataTypes, Model } = require('sequelize')
const libraryItemsPodcastFilters = require('../utils/queries/libraryItemsPodcastFilters')
const Logger = require('../Logger')
const { logger } = require('sequelize/lib/utils/logger')
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
   *
   * @param {import('../utils/podcastUtils').RssPodcastEpisode} rssPodcastEpisode
   * @param {string} podcastId
   * @param {import('../objects/files/AudioFile')} audioFile
   */
  static async createFromRssPodcastEpisode(rssPodcastEpisode, podcastId, audioFile) {
    const podcastEpisode = {
      index: null,
      season: rssPodcastEpisode.season,
      episode: rssPodcastEpisode.episode,
      episodeType: rssPodcastEpisode.episodeType,
      title: rssPodcastEpisode.title,
      subtitle: rssPodcastEpisode.subtitle,
      description: rssPodcastEpisode.description,
      pubDate: rssPodcastEpisode.pubDate,
      enclosureURL: rssPodcastEpisode.enclosure?.url || null,
      enclosureSize: rssPodcastEpisode.enclosure?.length || null,
      enclosureType: rssPodcastEpisode.enclosure?.type || null,
      publishedAt: rssPodcastEpisode.publishedAt,
      podcastId,
      audioFile: audioFile.toJSON(),
      chapters: [],
      extraData: {}
    }
    if (rssPodcastEpisode.guid) {
      podcastEpisode.extraData.guid = rssPodcastEpisode.guid
    }

    if (audioFile.chapters?.length) {
      podcastEpisode.chapters = audioFile.chapters.map((ch) => ({ ...ch }))
    } else if (rssPodcastEpisode.chapters?.length) {
      podcastEpisode.chapters = rssPodcastEpisode.chapters.map((ch) => ({ ...ch }))
    } else {
      const timeMarkerRegex = /\b(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\b/
      const chapterTitleRegex = /\b\d{1,2}:\d{1,2}(?::\d{1,2})?\b(.+)$/

      Logger.debug("Podcast episode doesn't have chapters, attempting to generate them from timestamps", rssPodcastEpisode.title)

      var errorMessage = null
      var descriptionLines = podcastEpisode.description.split('</p>')
      var chaptersToPush = []

      for (let i = 0; i < descriptionLines.length; i++) {
        let line = descriptionLines[i]
        Logger.debug('Description Line:', line)

        let match = timeMarkerRegex.exec(line)
        if (match == null) continue

        Logger.debug('Matches:', match)

        let first = match[1]
        let second = match[2]
        let third = match[3]

        let hours = 0
        let minutes = 0
        let seconds = 0

        // If there's three components then we can assume its hh:mm:ss
        if (first && second && third) {
          hours = Number(first)
          minutes = Number(second)
          seconds = Number(third)
        } else if (first && second) // otherwise assume mm:ss
        {
          minutes = Number(first)
          seconds = Number(second)
        } else {
          // Unknown timestamp state
          errorMessage = `Unknown timestamp format in description, line ${line}`
          break
        }

        let startTime = seconds + minutes * 60 + hours * 60 * 60
        let chapterTitleMatch = chapterTitleRegex.exec(line)
        Logger.debug('Chapter Title Matches:', chapterTitleMatch)

        if (chapterTitleMatch == null && chapterTitleMatch.length >= 2) {
          // Unknown chapter state
          errorMessage = `Unable to get chapter title from description, line ${line}`
          break
        }

        let chapter = { title: chapterTitleMatch[1].trim(), id: i, start: startTime }

        if (chaptersToPush.length > 0) {
          chaptersToPush[chaptersToPush.length - 1].end = startTime
        }

        chaptersToPush.push(chapter)

        Logger.debug('Added chapter', chapter)
      }
      if (errorMessage == null) {
        if (chaptersToPush.length > 0) {
          chaptersToPush[chaptersToPush.length - 1].end = podcastEpisode.audioFile.duration
        }

        podcastEpisode.chapters.push(...chaptersToPush)
        Logger.debug(`Successfully gnerated ${podcastEpisode.chapters.length} chapters`)
      } else {
        logger.error(`Unable generate chapters from podcast description, error '${errorMessage}`)
      }
    }

    return this.create(podcastEpisode)
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
          },
          {
            name: 'podcast_episodes_published_at',
            fields: ['publishedAt']
          }
        ]
      }
    )

    const { podcast } = sequelize.models
    podcast.hasMany(PodcastEpisode, {
      onDelete: 'CASCADE'
    })
    PodcastEpisode.belongsTo(podcast)

    PodcastEpisode.addHook('afterDestroy', async (instance) => {
      libraryItemsPodcastFilters.clearCountCache('podcastEpisode', 'afterDestroy')
    })

    PodcastEpisode.addHook('afterCreate', async (instance) => {
      libraryItemsPodcastFilters.clearCountCache('podcastEpisode', 'afterCreate')
    })
  }

  get size() {
    return this.audioFile?.metadata.size || 0
  }

  get duration() {
    return this.audioFile?.duration || 0
  }

  /**
   * Used for matching the episode with an episode in the RSS feed
   *
   * @param {string} guid
   * @param {string} enclosureURL
   * @returns {boolean}
   */
  checkMatchesGuidOrEnclosureUrl(guid, enclosureURL) {
    if (this.extraData?.guid && this.extraData.guid === guid) {
      return true
    }
    if (this.enclosureURL && this.enclosureURL === enclosureURL) {
      return true
    }
    return false
  }

  /**
   * Used in client players
   *
   * @param {string} libraryItemId
   * @returns {import('./Book').AudioTrack}
   */
  getAudioTrack(libraryItemId) {
    const track = structuredClone(this.audioFile)
    track.startOffset = 0
    track.title = this.audioFile.metadata.filename
    track.index = 1 // Podcast episodes only have one track
    track.contentUrl = `/api/items/${libraryItemId}/file/${track.ino}`
    return track
  }

  toOldJSON(libraryItemId) {
    if (!libraryItemId) {
      throw new Error(`[PodcastEpisode] Cannot convert to old JSON because libraryItemId is not provided`)
    }

    let enclosure = null
    if (this.enclosureURL) {
      enclosure = {
        url: this.enclosureURL,
        type: this.enclosureType,
        length: this.enclosureSize !== null ? String(this.enclosureSize) : null
      }
    }

    return {
      libraryItemId: libraryItemId,
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
      chapters: structuredClone(this.chapters),
      audioFile: structuredClone(this.audioFile),
      publishedAt: this.publishedAt?.valueOf() || null,
      addedAt: this.createdAt.valueOf(),
      updatedAt: this.updatedAt.valueOf()
    }
  }

  toOldJSONExpanded(libraryItemId) {
    const json = this.toOldJSON(libraryItemId)

    json.audioTrack = this.getAudioTrack(libraryItemId)
    json.size = this.size
    json.duration = this.duration

    return json
  }
}

module.exports = PodcastEpisode
