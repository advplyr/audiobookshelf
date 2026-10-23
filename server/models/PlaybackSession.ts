import { DataTypes, Model } from 'sequelize'
import type { Attributes, BelongsToGetAssociationMixin, BuildOptions, FindOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize, UpsertOptions, WhereOptions } from 'sequelize'
import type Book from './Book'
import type PodcastEpisode from './PodcastEpisode'
import type Device from './Device'
import type DeviceInfo from '../objects/DeviceInfo'

import oldPlaybackSession from '../objects/PlaybackSession'

type PlaybackSessionAttributes = {
  id: string | null
  mediaItemId: string | null
  mediaItemType: string | null
  displayTitle: string | null
  displayAuthor: string | null
  duration: number | null
  playMethod: number | null
  mediaPlayer: string | null
  startTime: number | null
  currentTime: number | null
  serverVersion: string | null
  coverPath: string | null
  timeListening: number | null
  mediaMetadata: unknown
  date: string | null
  dayOfWeek: string | null
  extraData: { libraryItemId?: string | null } | null
  userId?: string | null
  deviceId?: string | null
  libraryId?: string | null
  updatedAt?: Date | number | string | null
  createdAt?: Date | number | string | null
  book?: Book | null
  podcastEpisode?: PodcastEpisode | null
  mediaItem?: Book | PodcastEpisode | null
  device?: Device | null
}

type PlaybackSessionCreation = Omit<Optional<PlaybackSessionAttributes, 'id' | 'mediaItemId' | 'mediaItemType' | 'displayTitle' | 'displayAuthor' | 'duration' | 'playMethod' | 'mediaPlayer' | 'startTime' | 'currentTime' | 'serverVersion' | 'coverPath' | 'timeListening' | 'mediaMetadata' | 'date' | 'dayOfWeek' | 'extraData' | 'userId' | 'deviceId' | 'libraryId' | 'updatedAt' | 'createdAt'>, 'createdAt' | 'updatedAt'> & {
  createdAt?: Date | number | string | null
  updatedAt?: Date | number | string | null
}

// Legacy objects remain JavaScript; describe the persisted fields at this boundary.
type LegacyPlaybackSessionData = {
  id?: string | null
  episodeId?: string | null
  bookId?: string | null
  libraryId?: string | null
  libraryItemId?: string | null
  displayTitle?: string | null
  displayAuthor?: string | null
  duration?: number | null
  playMethod?: number | null
  mediaPlayer?: string | null
  startTime?: number | null
  currentTime?: number | null
  serverVersion?: string | null
  startedAt?: number | null
  updatedAt?: number | null
  userId?: string | null
  deviceInfo?: DeviceInfo | null
  timeListening?: number | null
  coverPath?: string | null
  mediaMetadata?: unknown
  date?: string | null
  dayOfWeek?: string | null
}

class PlaybackSession extends Model<PlaybackSessionAttributes, PlaybackSessionCreation> {
  // Query methods are used after Database.buildModels initializes the model.
  declare static sequelize: Sequelize
  declare id: string | null
  declare mediaItemId: string | null
  declare mediaItemType: string | null
  declare displayTitle: string | null
  declare displayAuthor: string | null
  declare duration: number | null
  declare playMethod: number | null
  declare mediaPlayer: string | null
  declare startTime: number | null
  declare currentTime: number | null
  declare serverVersion: string | null
  declare coverPath: string | null
  declare timeListening: number | null
  declare mediaMetadata: unknown
  declare date: string | null
  declare dayOfWeek: string | null
  declare extraData: { libraryItemId?: string | null } | null
  declare userId: string | null
  declare deviceId: string | null
  declare libraryId: string | null
  declare updatedAt: Date
  declare createdAt: Date
  declare book?: Book | null
  declare podcastEpisode?: PodcastEpisode | null
  declare mediaItem?: Book | PodcastEpisode | null
  declare device?: Device | null
  declare getBook: BelongsToGetAssociationMixin<Book>
  declare getPodcastEpisode: BelongsToGetAssociationMixin<PodcastEpisode>


  constructor(values?: PlaybackSessionCreation, options?: BuildOptions) {
    super(values, options)
  }

  static async getOldPlaybackSessions(where: WhereOptions<PlaybackSessionAttributes> | null = null) {
    const playbackSessions = await this.findAll({
      // Sequelize treats a null where clause as no filter.
      where: where as WhereOptions<PlaybackSessionAttributes>,
      include: [
        {
          model: this.sequelize.models.device
        }
      ]
    })
    return playbackSessions.map((session) => this.getOldPlaybackSession(session))
  }

  static async getById(sessionId: string) {
    const playbackSession = await this.findByPk(sessionId, {
      include: [
        {
          model: this.sequelize.models.device
        }
      ]
    })
    if (!playbackSession) return null
    return this.getOldPlaybackSession(playbackSession)
  }

  static getOldPlaybackSession(playbackSessionExpanded: PlaybackSession) {
    const isPodcastEpisode = playbackSessionExpanded.mediaItemType === 'podcastEpisode'

    return new oldPlaybackSession({
      id: playbackSessionExpanded.id,
      userId: playbackSessionExpanded.userId,
      libraryId: playbackSessionExpanded.libraryId,
      libraryItemId: playbackSessionExpanded.extraData?.libraryItemId || null,
      bookId: isPodcastEpisode ? null : playbackSessionExpanded.mediaItemId,
      episodeId: isPodcastEpisode ? playbackSessionExpanded.mediaItemId : null,
      mediaType: isPodcastEpisode ? 'podcast' : 'book',
      mediaMetadata: playbackSessionExpanded.mediaMetadata,
      chapters: null,
      displayTitle: playbackSessionExpanded.displayTitle,
      displayAuthor: playbackSessionExpanded.displayAuthor,
      coverPath: playbackSessionExpanded.coverPath,
      duration: playbackSessionExpanded.duration,
      playMethod: playbackSessionExpanded.playMethod,
      mediaPlayer: playbackSessionExpanded.mediaPlayer,
      deviceInfo: playbackSessionExpanded.device?.getOldDevice() || null,
      serverVersion: playbackSessionExpanded.serverVersion,
      date: playbackSessionExpanded.date,
      dayOfWeek: playbackSessionExpanded.dayOfWeek,
      timeListening: playbackSessionExpanded.timeListening,
      startTime: playbackSessionExpanded.startTime,
      currentTime: playbackSessionExpanded.currentTime,
      startedAt: playbackSessionExpanded.createdAt.valueOf(),
      updatedAt: playbackSessionExpanded.updatedAt.valueOf()
    })
  }

  static removeById(sessionId: string) {
    return this.destroy({
      where: {
        id: sessionId
      }
    })
  }

  static createFromOld(oldPlaybackSession: LegacyPlaybackSessionData) {
    const playbackSession = this.getFromOld(oldPlaybackSession)
    // Preserve the runtime silent option, omitted by Sequelize's UpsertOptions type.
    const options: UpsertOptions<PlaybackSessionAttributes> & { silent: boolean } = { silent: true }
    return this.upsert(playbackSession, options)
  }

  static updateFromOld(oldPlaybackSession: LegacyPlaybackSessionData) {
    const playbackSession = this.getFromOld(oldPlaybackSession)
    return this.update(playbackSession, {
      where: {
        id: playbackSession.id
      },
      silent: true
    })
  }

  static getFromOld(oldPlaybackSession: LegacyPlaybackSessionData): PlaybackSessionCreation {
    return {
      id: oldPlaybackSession.id,
      mediaItemId: oldPlaybackSession.episodeId || oldPlaybackSession.bookId,
      mediaItemType: oldPlaybackSession.episodeId ? 'podcastEpisode' : 'book',
      libraryId: oldPlaybackSession.libraryId,
      displayTitle: oldPlaybackSession.displayTitle,
      displayAuthor: oldPlaybackSession.displayAuthor,
      duration: oldPlaybackSession.duration,
      playMethod: oldPlaybackSession.playMethod,
      mediaPlayer: oldPlaybackSession.mediaPlayer,
      startTime: oldPlaybackSession.startTime,
      currentTime: oldPlaybackSession.currentTime,
      serverVersion: oldPlaybackSession.serverVersion || null,
      createdAt: oldPlaybackSession.startedAt,
      updatedAt: oldPlaybackSession.updatedAt,
      userId: oldPlaybackSession.userId,
      deviceId: oldPlaybackSession.deviceInfo?.id || null,
      timeListening: oldPlaybackSession.timeListening,
      coverPath: oldPlaybackSession.coverPath,
      mediaMetadata: oldPlaybackSession.mediaMetadata,
      date: oldPlaybackSession.date,
      dayOfWeek: oldPlaybackSession.dayOfWeek,
      extraData: {
        libraryItemId: oldPlaybackSession.libraryItemId
      }
    }
  }

  getMediaItem(options?: FindOptions) {
    if (!this.mediaItemType) return Promise.resolve(null)
    const mixinMethodName = `get${this.sequelize.uppercaseFirst(this.mediaItemType)}`
    // The persisted discriminator selects one of the two association mixins.
    return this[mixinMethodName as 'getBook' | 'getPodcastEpisode'](options)
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  // Retain Sequelize's static signature for its polymorphic model methods.
  // Application code uses the single-argument initializer, as before migration.
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
    this: MS,
    attributes: ModelAttributes<M, Partial<Attributes<M>>>,
    options: InitOptions<M>
  ): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels supplies a Sequelize instance; the other overload preserves
    // the inherited static contract required by Sequelize's generic query methods.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof PlaybackSession, PlaybackSession>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        mediaItemId: DataTypes.UUID,
        mediaItemType: DataTypes.STRING,
        displayTitle: DataTypes.STRING,
        displayAuthor: DataTypes.STRING,
        duration: DataTypes.FLOAT,
        playMethod: DataTypes.INTEGER,
        mediaPlayer: DataTypes.STRING,
        startTime: DataTypes.FLOAT,
        currentTime: DataTypes.FLOAT,
        serverVersion: DataTypes.STRING,
        coverPath: DataTypes.STRING,
        timeListening: DataTypes.INTEGER,
        mediaMetadata: DataTypes.JSON,
        date: DataTypes.STRING,
        dayOfWeek: DataTypes.STRING,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'playbackSession'
      }
    )

    const { book, podcastEpisode, user, device, library } = sequelize.models

    user.hasMany(PlaybackSession)
    PlaybackSession.belongsTo(user)

    device.hasMany(PlaybackSession)
    PlaybackSession.belongsTo(device)

    library.hasMany(PlaybackSession)
    PlaybackSession.belongsTo(library)

    book.hasMany(PlaybackSession, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'book'
      }
    })
    PlaybackSession.belongsTo(book, { foreignKey: 'mediaItemId', constraints: false })

    podcastEpisode.hasOne(PlaybackSession, {
      foreignKey: 'mediaItemId',
      constraints: false,
      scope: {
        mediaItemType: 'podcastEpisode'
      }
    })
    PlaybackSession.belongsTo(podcastEpisode, { foreignKey: 'mediaItemId', constraints: false })

    PlaybackSession.addHook('afterFind', (findResult: PlaybackSession | readonly PlaybackSession[] | null) => {
      if (!findResult) return

      // Sequelize types results as readonly arrays; retain Array.isArray's runtime check.
      const isArray: (value: PlaybackSession | readonly PlaybackSession[]) => value is readonly PlaybackSession[] = Array.isArray
      if (!isArray(findResult)) findResult = [findResult]

      for (const instance of findResult) {
        if (instance.mediaItemType === 'book' && instance.book !== undefined) {
          instance.mediaItem = instance.book
          instance.dataValues.mediaItem = instance.dataValues.book
        } else if (instance.mediaItemType === 'podcastEpisode' && instance.podcastEpisode !== undefined) {
          instance.mediaItem = instance.podcastEpisode
          instance.dataValues.mediaItem = instance.dataValues.podcastEpisode
        }
        // To prevent mistakes:
        delete instance.book
        delete instance.dataValues.book
        delete instance.podcastEpisode
        delete instance.dataValues.podcastEpisode
      }
    })
  }
}

export = PlaybackSession
