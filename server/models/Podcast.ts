import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize, Transaction } from 'sequelize'
import type PodcastEpisode from './PodcastEpisode'
import type { RssPodcastEpisode } from '../utils/podcastUtils'
import { getTitlePrefixAtEnd, getTitleIgnorePrefix } from '../utils'
import Logger from '../Logger'
import libraryItemsPodcastFilters from '../utils/queries/libraryItemsPodcastFilters'
import htmlSanitizer from '../utils/htmlSanitizer'

type PodcastRequest = { [key: string]: unknown; metadata?: Record<string, unknown> }
type PodcastCreateRequest = PodcastRequest & { metadata: Record<string, unknown> }
type PodcastExpanded = Podcast & { podcastEpisodes: PodcastEpisode[] }
type PodcastStringKey = 'title' | 'titleIgnorePrefix' | 'author' | 'releaseDate' | 'feedURL' | 'imageURL' | 'description' | 'itunesPageURL' | 'itunesId' | 'itunesArtistId' | 'language' | 'podcastType'
type PodcastAttributes = {
  id: string
  title: string | null
  titleIgnorePrefix: string | null
  author: string | null
  releaseDate: string | null
  feedURL: string | null
  imageURL: string | null
  description: string | null
  itunesPageURL: string | null
  itunesId: string | null
  itunesArtistId: string | null
  language: string | null
  podcastType: string | null
  autoDownloadSchedule: string | null
  coverPath: string | null
  explicit: boolean | null
  autoDownloadEpisodes: boolean | null
  maxEpisodesToKeep: number | null
  maxNewEpisodesToDownload: number | null
  numEpisodes: number | null
  lastEpisodeCheck: Date | number | null
  tags: string[] | null
  genres: string[] | null
  createdAt?: Date
  updatedAt?: Date
}
type PodcastCreation = Optional<PodcastAttributes, keyof PodcastAttributes>
type ExpandedMetadata = ReturnType<Podcast['oldMetadataToJSON']> & { titleIgnorePrefix?: string | null | undefined }

class Podcast extends Model<PodcastAttributes, PodcastCreation> {
  declare id: string
  declare title: string | null
  declare titleIgnorePrefix: string | null
  declare author: string | null
  declare releaseDate: string | null
  declare feedURL: string | null
  declare imageURL: string | null
  declare description: string | null
  declare itunesPageURL: string | null
  declare itunesId: string | null
  declare itunesArtistId: string | null
  declare language: string | null
  declare podcastType: string | null
  declare autoDownloadSchedule: string | null
  declare coverPath: string | null
  declare explicit: boolean | null
  declare autoDownloadEpisodes: boolean | null
  declare maxEpisodesToKeep: number | null
  declare maxNewEpisodesToDownload: number | null
  declare numEpisodes: number | null
  declare lastEpisodeCheck: Date | number | null
  declare tags: string[] | null
  declare genres: string[] | null
  declare createdAt: Date
  declare updatedAt: Date
  declare podcastEpisodes?: PodcastEpisode[]

  constructor(values?: PodcastCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   * Payload from the /api/podcasts POST endpoint
   *
   * @param {Object} payload
   * @param {import('sequelize').Transaction} transaction
   */
  static async createFromRequest(payload: PodcastCreateRequest, transaction?: Transaction) {
    const title = typeof payload.metadata.title === 'string' ? payload.metadata.title : null
    // cron expression validated in controller
    const autoDownloadSchedule = typeof payload.autoDownloadSchedule === 'string' ? payload.autoDownloadSchedule : null
    const isArray: (value: unknown) => value is unknown[] = Array.isArray
    const genres = isArray(payload.metadata.genres) && payload.metadata.genres.every((g): g is string => typeof g === 'string' && !!g.length) ? payload.metadata.genres : []
    const tags = isArray(payload.tags) && payload.tags.every((t): t is string => typeof t === 'string' && !!t.length) ? payload.tags : []

    const stringKeys = ['title', 'author', 'releaseDate', 'feedUrl', 'imageUrl', 'description', 'itunesPageUrl', 'itunesId', 'itunesArtistId', 'language', 'type']
    stringKeys.forEach((key) => {
      if (typeof payload.metadata[key] === 'number') {
        payload.metadata[key] = String(payload.metadata[key])
      }
    })

    const rawDescription = typeof payload.metadata.description === 'string' ? payload.metadata.description : null
    const description = rawDescription ? htmlSanitizer.sanitize(rawDescription) : null

    return this.create(
      {
        title,
        titleIgnorePrefix: getTitleIgnorePrefix(title),
        author: typeof payload.metadata.author === 'string' ? payload.metadata.author : null,
        releaseDate: typeof payload.metadata.releaseDate === 'string' ? payload.metadata.releaseDate : null,
        feedURL: typeof payload.metadata.feedUrl === 'string' ? payload.metadata.feedUrl : null,
        imageURL: typeof payload.metadata.imageUrl === 'string' ? payload.metadata.imageUrl : null,
        description,
        itunesPageURL: typeof payload.metadata.itunesPageUrl === 'string' ? payload.metadata.itunesPageUrl : null,
        itunesId: typeof payload.metadata.itunesId === 'string' ? payload.metadata.itunesId : null,
        itunesArtistId: typeof payload.metadata.itunesArtistId === 'string' ? payload.metadata.itunesArtistId : null,
        language: typeof payload.metadata.language === 'string' ? payload.metadata.language : null,
        podcastType: typeof payload.metadata.type === 'string' ? payload.metadata.type : null,
        explicit: !!payload.metadata.explicit,
        autoDownloadEpisodes: !!payload.autoDownloadEpisodes,
        autoDownloadSchedule: autoDownloadSchedule || global.ServerSettings.podcastEpisodeSchedule,
        lastEpisodeCheck: new Date(),
        maxEpisodesToKeep: 0,
        maxNewEpisodesToDownload: 3,
        tags,
        genres
      },
      { transaction }
    )
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  // Keep Sequelize's inherited static contract; application initialization uses one argument.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS, attributes: ModelAttributes<M, Partial<Attributes<M>>>, options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels always supplies the Sequelize instance.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof Podcast, Podcast>(
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
        genres: DataTypes.JSON,
        numEpisodes: DataTypes.INTEGER
      },
      {
        sequelize,
        modelName: 'podcast'
      }
    )

    Podcast.addHook('afterDestroy', () => {
      libraryItemsPodcastFilters.clearCountCache('podcast', 'afterDestroy')
      return Promise.resolve()
    })

    Podcast.addHook('afterCreate', () => {
      libraryItemsPodcastFilters.clearCountCache('podcast', 'afterCreate')
      return Promise.resolve()
    })
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
  async updateFromRequest(payload: PodcastRequest | null | undefined) {
    if (!payload) return false

    let hasUpdates = false

    if (payload.metadata) {
      const metadata = payload.metadata
      const stringKeys = ['title', 'author', 'releaseDate', 'feedUrl', 'imageUrl', 'description', 'itunesPageUrl', 'itunesId', 'itunesArtistId', 'language', 'type']
      stringKeys.forEach((key) => {
        // Convert numbers to strings
        if (typeof metadata[key] === 'number') {
          metadata[key] = String(metadata[key])
        }

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
        // These aliases cover every field in stringKeys.
        const propertyKey = newKey as PodcastStringKey
        if ((typeof metadata[key] === 'string' || metadata[key] === null) && metadata[key] !== this[propertyKey]) {
          // Sanitize description HTML
          if (key === 'description' && metadata[key]) {
            const sanitizedDescription = htmlSanitizer.sanitize(metadata[key])
            if (sanitizedDescription !== metadata[key]) {
              Logger.debug(`[Podcast] "${this.title}" Sanitized description from "${metadata[key]}" to "${sanitizedDescription}"`)
              metadata[key] = sanitizedDescription
            }
          }

          this[propertyKey] = (metadata[key] as string | null) || null

          if (key === 'title') {
            this.titleIgnorePrefix = getTitleIgnorePrefix(this.title)
          }

          hasUpdates = true
        }
      })

      if (metadata.explicit !== undefined && metadata.explicit !== this.explicit) {
        this.explicit = !!metadata.explicit
        hasUpdates = true
      }

      if (Array.isArray(metadata.genres) && !metadata.genres.some((item) => typeof item !== 'string') && JSON.stringify(this.genres) !== JSON.stringify(metadata.genres)) {
        // The preceding check rejects every non-string element.
        this.genres = metadata.genres as string[]
        this.changed('genres', true)
        hasUpdates = true
      }
    }

    if (Array.isArray(payload.tags) && !payload.tags.some((item) => typeof item !== 'string') && JSON.stringify(this.tags) !== JSON.stringify(payload.tags)) {
      // The preceding check rejects every non-string element.
      this.tags = payload.tags as string[]
      this.changed('tags', true)
      hasUpdates = true
    }

    if (payload.autoDownloadEpisodes !== undefined && payload.autoDownloadEpisodes !== this.autoDownloadEpisodes) {
      this.autoDownloadEpisodes = !!payload.autoDownloadEpisodes
      hasUpdates = true
    }
    if (typeof payload.autoDownloadSchedule === 'string' && payload.autoDownloadSchedule !== this.autoDownloadSchedule) {
      // cron expression validated in controller
      this.autoDownloadSchedule = payload.autoDownloadSchedule
      hasUpdates = true
    }
    if (typeof payload.lastEpisodeCheck === 'number' && payload.lastEpisodeCheck !== this.lastEpisodeCheck?.valueOf()) {
      this.lastEpisodeCheck = payload.lastEpisodeCheck
      hasUpdates = true
    }

    const numberKeys = ['maxEpisodesToKeep', 'maxNewEpisodesToDownload'] as const
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

  checkCanDirectPlay(supportedMimeTypes: unknown, episodeId: string) {
    if (!Array.isArray(supportedMimeTypes)) {
      Logger.error(`[Podcast] checkCanDirectPlay: supportedMimeTypes is not an array`, supportedMimeTypes)
      return false
    }
    const episode = this.podcastEpisodes!.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] checkCanDirectPlay: episode not found`, episodeId)
      return false
    }
    return supportedMimeTypes.includes(episode.audioFile!.mimeType)
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
  getTracklist(libraryItemId: string, episodeId: string) {
    const episode = this.podcastEpisodes!.find((ep) => ep.id === episodeId)
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
  getChapters(episodeId: string) {
    const episode = this.podcastEpisodes!.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] getChapters: episode not found`, episodeId)
      return []
    }

    return structuredClone(episode.chapters) || []
  }

  getPlaybackTitle(episodeId: string) {
    const episode = this.podcastEpisodes!.find((ep) => ep.id === episodeId)
    if (!episode) {
      Logger.error(`[Podcast] getPlaybackTitle: episode not found`, episodeId)
      return ''
    }

    return episode.title
  }

  getPlaybackAuthor() {
    return this.author
  }

  getPlaybackDuration(episodeId: string) {
    const episode = this.podcastEpisodes!.find((ep) => ep.id === episodeId)
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
    return this.podcastEpisodes!.reduce((latest, episode) => {
      if (Number(episode.publishedAt?.valueOf()) > latest) {
        return episode.publishedAt!.valueOf()
      }
      return latest
    }, 0)
  }

  /**
   * Used for checking if an rss feed episode is already in the podcast
   *
   * @param {import('../utils/podcastUtils').RssPodcastEpisode} feedEpisode - object from rss feed
   * @returns {boolean}
   */
  checkHasEpisodeByFeedEpisode(feedEpisode: RssPodcastEpisode) {
    const guid = feedEpisode.guid
    const url = feedEpisode.enclosure.url
    return this.podcastEpisodes!.some((ep) => ep.checkMatchesGuidOrEnclosureUrl(guid, url))
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
    const oldMetadataJSON: ExpandedMetadata = this.oldMetadataToJSON()
    oldMetadataJSON.titleIgnorePrefix = getTitlePrefixAtEnd(this.title)
    return oldMetadataJSON
  }

  /**
   * The old model stored episodes with the podcast object
   *
   * @param {string} libraryItemId
   */
  toOldJSON(libraryItemId: string) {
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

  /**
   * Minified podcast JSON for list/shelf endpoints.
   * `toOldJSONExpanded()` must be a strict superset: every key here must exist in expanded
   * with the same value semantics. Only additive changes to expanded; never remove or rename keys.
   */
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

  /**
   * Expanded podcast JSON for item detail and socket events.
   * Must be a strict superset of `toOldJSONMinified()` — built by spreading minified, then adding expanded-only fields.
   *
   * @param {string} libraryItemId
   */
  toOldJSONExpanded(libraryItemId: string) {
    if (!libraryItemId) {
      throw new Error(`[Podcast] Cannot convert to old JSON because libraryItemId is not provided`)
    }
    if (!this.podcastEpisodes) {
      throw new Error(`[Podcast] Cannot convert to old JSON because episodes are not provided`)
    }

    return {
      ...this.toOldJSONMinified(),
      libraryItemId,
      episodes: this.podcastEpisodes.map((e) => e.toOldJSONExpanded(libraryItemId))
    }
  }
}

declare namespace Podcast {
  export type { PodcastExpanded }
}

export = Podcast
