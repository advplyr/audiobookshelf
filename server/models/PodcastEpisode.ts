import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import type AudioFile from '../objects/files/AudioFile'
import type { RssPodcastEpisode } from '../utils/podcastUtils'
import libraryItemsPodcastFilters from '../utils/queries/libraryItemsPodcastFilters'

type ChapterObject = { id: number; start: number; end: number; title: string }
type AudioFileJSON = ReturnType<AudioFile['toJSON']>
// Older stored JSON may omit fields added by later versions of AudioFile.
type AudioFileObject = Partial<Omit<AudioFileJSON, 'metadata'>> & { metadata: Partial<AudioFileJSON['metadata']> }
type AudioTrack = AudioFileObject & { startOffset: number; title: string | null | undefined; contentUrl: string }

type PodcastEpisodeAttributes = {
  id: string
  index: number | null
  season: string | null
  episode: string | null
  episodeType: string | null
  title: string | null
  subtitle: string | null
  description: string | null
  pubDate: string | null
  enclosureURL: string | null
  enclosureSize: number | string | null
  enclosureType: string | null
  publishedAt: Date | number | null
  audioFile: AudioFileObject | null
  chapters: ChapterObject[] | null
  extraData: { guid?: string | null; oldEpisodeId?: string | null } | null
  podcastId?: string | null
  createdAt?: Date
  updatedAt?: Date
}
type PodcastEpisodeCreation = Optional<PodcastEpisodeAttributes, keyof PodcastEpisodeAttributes>
type LegacyEpisode = ReturnType<PodcastEpisode['toOldJSON']> & { audioTrack?: AudioTrack; size?: number; duration?: number }

class PodcastEpisode extends Model<PodcastEpisodeAttributes, PodcastEpisodeCreation> {
  declare id: string
  declare index: number | null
  declare season: string | null
  declare episode: string | null
  declare episodeType: string | null
  declare title: string | null
  declare subtitle: string | null
  declare description: string | null
  declare pubDate: string | null
  declare enclosureURL: string | null
  declare enclosureSize: number | string | null
  declare enclosureType: string | null
  declare publishedAt: Date | null
  declare audioFile: AudioFileObject | null
  declare chapters: ChapterObject[] | null
  declare extraData: { guid?: string | null; oldEpisodeId?: string | null } | null
  declare podcastId: string | null
  declare createdAt: Date
  declare updatedAt: Date

  constructor(values?: PodcastEpisodeCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   *
   * @param {import('../utils/podcastUtils').RssPodcastEpisode} rssPodcastEpisode
   * @param {string} podcastId
   * @param {import('../objects/files/AudioFile')} audioFile
   */
  static async createFromRssPodcastEpisode(rssPodcastEpisode: RssPodcastEpisode, podcastId: string, audioFile: AudioFile) {
    const podcastEpisode: PodcastEpisodeCreation & { extraData: NonNullable<PodcastEpisodeAttributes['extraData']> } = {
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
    }

    return this.create(podcastEpisode)
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
    super.init<typeof PodcastEpisode, PodcastEpisode>(
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

    PodcastEpisode.addHook('afterDestroy', () => {
      libraryItemsPodcastFilters.clearCountCache('podcastEpisode', 'afterDestroy')
      return Promise.resolve()
    })

    PodcastEpisode.addHook('afterCreate', () => {
      libraryItemsPodcastFilters.clearCountCache('podcastEpisode', 'afterCreate')
      return Promise.resolve()
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
  checkMatchesGuidOrEnclosureUrl(guid: string | null, enclosureURL: string | null) {
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
  getAudioTrack(libraryItemId: string): AudioTrack {
    // Playback requires a stored audio file, as in the legacy implementation.
    const track = structuredClone(this.audioFile!) as AudioTrack
    track.startOffset = 0
    track.title = this.audioFile!.metadata.filename
    track.index = 1 // Podcast episodes only have one track
    track.contentUrl = `/api/items/${libraryItemId}/file/${track.ino}`
    return track
  }

  toOldJSON(libraryItemId: string) {
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

  toOldJSONExpanded(libraryItemId: string) {
    const json: LegacyEpisode = this.toOldJSON(libraryItemId)

    json.audioTrack = this.getAudioTrack(libraryItemId)
    json.size = this.size
    json.duration = this.duration

    return json
  }
}

declare namespace PodcastEpisode {
  export type { ChapterObject }
}

export = PodcastEpisode
