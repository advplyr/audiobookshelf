import { v4 as uuidv4 } from 'uuid'
import * as sequelize from 'sequelize'
import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, InstanceDestroyOptions, InstanceUpdateOptions, ModelAttributes, ModelStatic, Optional, SaveOptions, Sequelize, Transaction } from 'sequelize'
import type { Col, Fn, Literal } from 'sequelize/types/utils'
import type MediaProgress from './MediaProgress'
import type Book from './Book'
import type PodcastEpisode from './PodcastEpisode'
import type LibraryItem from './LibraryItem'
import { LRUCache } from 'lru-cache'

import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'
import { isNullOrNaN } from '../utils'
import TokenManager from '../auth/TokenManager'

class UserCache {
  declare cache: LRUCache<string, User>
  constructor() {
    this.cache = new LRUCache<string, User>({ max: 100 })
  }

  getById(id: string | null) {
    // A missing progress owner cannot match a cache entry; preserve the legacy lookup.
    const user = this.cache.get(id!)
    return user
  }

  getByEmail(email: string | null) {
    const user = this.cache.find((u) => u.email === email)
    return user
  }

  getByUsername(username: string | null) {
    const user = this.cache.find((u) => u.username === username)
    return user
  }

  getByOldId(oldUserId: string | null) {
    const user = this.cache.find((u) => u.extraData?.oldUserId === oldUserId)
    return user
  }

  getByOpenIDSub(sub: string | null) {
    const user = this.cache.find((u) => u.extraData?.authOpenIDSub === sub)
    return user
  }

  set(user: User) {
    user.fromCache = true
    this.cache.set(user.id, user)
  }

  delete(userId: string | null) {
    this.cache.delete(userId!)
  }

  maybeInvalidate(user: User) {
    if (!user.fromCache) this.delete(user.id)
  }
}

const userCache = new UserCache()


type AudioBookmarkObject = { libraryItemId: string; title: string; time: number; createdAt: number }
type ProgressUpdatePayload = {
  libraryItemId: string; episodeId?: string; duration?: number; progress?: number; currentTime?: number
  isFinished?: boolean; hideFromContinueListening?: boolean; ebookLocation?: string; ebookProgress?: number
  finishedAt?: string; lastUpdate?: number; markAsFinishedTimeRemaining?: number; markAsFinishedPercentComplete?: number
  createdAt?: Date
}
type PermissionFlag = 'download' | 'update' | 'delete' | 'upload' | 'createEreader' | 'accessAllLibraries' | 'accessAllTags' | 'accessExplicitContent' | 'selectedTagsNotAccessible'
type UserPermissions = Partial<Record<PermissionFlag, boolean>> & { librariesAccessible?: string[]; itemTagsSelected?: string[]; [key: string]: unknown }
type UserExtraData = { oldUserId?: string; authOpenIDSub?: string; seriesHideFromContinueListening?: string[]; [key: string]: unknown }
type UserAttributes = {
  id: string; username: string | null; email: string | null; pash: string | null; type: string | null; token: string | null
  isActive: boolean | null; isLocked: boolean | null; lastSeen: Date | null
  permissions: UserPermissions | null; bookmarks: AudioBookmarkObject[] | null; extraData: UserExtraData | null
  createdAt?: Date; updatedAt?: Date
}
type UserCreation = Optional<UserAttributes, keyof UserAttributes>
type UserUpdate = { [Key in keyof UserAttributes]?: UserAttributes[Key] | Col | Fn | Literal }
type OpenIdUserInfo = { sub: string; email?: string; email_verified?: boolean; preferred_username?: string; username?: string; name?: string }
type TokenGenerator = { generateAccessToken(user: { id: string; username: string }): string }
type PublicSession = { userId: string | null; toJSONForClient(): unknown }
// Both expanded database items and legacy item JSON pass through access checks.
type AccessibleItem = { libraryId: string; media: { explicit?: boolean | null; metadata?: { explicit?: boolean | null }; tags: string[] | null } }
type BrowserJSON = {
  id: string; username: string | null; email: string | null; type: string | null; token: string | null; isOldToken?: boolean
  mediaProgress?: ReturnType<MediaProgress['getOldMediaProgress']>[]; seriesHideFromContinueListening: string[]; bookmarks?: AudioBookmarkObject[]
  isActive: boolean | null; isLocked: boolean | null; lastSeen: number | null; createdAt: number; permissions: UserPermissions
  librariesAccessible: string[]; itemTagsSelected: string[]; hasOpenIDLink: boolean
}
type ProgressResult = { mediaProgress: MediaProgress; error?: never; statusCode?: never } | { mediaProgress?: never; error: string; statusCode: number }

class User extends Model<UserAttributes, UserCreation> {
  declare static sequelize: Sequelize
  declare id: string
  declare username: string | null
  declare email: string | null
  declare pash: string | null
  declare type: string | null
  declare token: string | null
  declare isActive: boolean | null
  declare isLocked: boolean | null
  declare lastSeen: Date | null
  declare permissions: UserPermissions | null
  declare bookmarks: AudioBookmarkObject[] | null
  declare extraData: UserExtraData | null
  declare createdAt: Date
  declare updatedAt: Date
  declare mediaProgresses?: MediaProgress[] | null
  declare fromCache?: boolean
  declare isOldToken?: boolean

  constructor(values?: UserCreation, options?: BuildOptions) {
    super(values, options)
  }

  // Excludes "root" since their can only be 1 root user
  static accountTypes = ['admin', 'user', 'guest']

  /**
   * List of expected permission properties from the client
   * Only used for OpenID
   */
  static permissionMapping = {
    canDownload: 'download',
    canUpload: 'upload',
    canDelete: 'delete',
    canUpdate: 'update',
    canAccessExplicitContent: 'accessExplicitContent',
    canAccessAllLibraries: 'accessAllLibraries',
    canAccessAllTags: 'accessAllTags',
    canCreateEReader: 'createEreader',
    tagsAreDenylist: 'selectedTagsNotAccessible',
    // Direct mapping for array-based permissions
    allowedLibraries: 'librariesAccessible',
    allowedTags: 'itemTagsSelected'
  } as const

  /**
   * Get a sample to show how a JSON for updatePermissionsFromExternalJSON should look like
   * Only used for OpenID
   *
   * @returns {string} JSON string
   */
  static getSampleAbsPermissions() {
    // Start with a template object where all permissions are false for simplicity
    const samplePermissions = Object.keys(User.permissionMapping).reduce<Record<string, boolean | string[]>>((acc, key) => {
      // For array-based permissions, provide a sample array
      if (key === 'allowedLibraries') {
        acc[key] = [`5406ba8a-16e1-451d-96d7-4931b0a0d966`, `918fd848-7c1d-4a02-818a-847435a879ca`]
      } else if (key === 'allowedTags') {
        acc[key] = [`ExampleTag`, `AnotherTag`, `ThirdTag`]
      } else {
        acc[key] = false
      }
      return acc
    }, {})

    return JSON.stringify(samplePermissions, null, 2) // Pretty print the JSON
  }

  /**
   *
   * @param {string} type
   * @returns
   */
  static getDefaultPermissionsForUserType(type: string): UserPermissions {
    return {
      download: true,
      update: type === 'root' || type === 'admin',
      delete: type === 'root',
      upload: type === 'root' || type === 'admin',
      createEreader: type === 'root' || type === 'admin',
      accessAllLibraries: true,
      accessAllTags: true,
      accessExplicitContent: type === 'root' || type === 'admin',
      selectedTagsNotAccessible: false,
      librariesAccessible: [],
      itemTagsSelected: []
    }
  }

  /**
   * Create root user
   * @param {string} username
   * @param {string} pash
   * @param {import('../Auth')} auth
   * @returns {Promise<User>}
   */
  static async createRootUser(username: string, pash: string, auth: TokenGenerator, transaction: Transaction | null = null) {
    const userId = uuidv4()

    const token = auth.generateAccessToken({ id: userId, username })

    const newUser = {
      id: userId,
      type: 'root',
      username,
      pash,
      token,
      isActive: true,
      permissions: this.getDefaultPermissionsForUserType('root'),
      bookmarks: [],
      extraData: {
        seriesHideFromContinueListening: []
      }
    }
    return this.create(newUser, { transaction })
  }

  /**
   * Finds an existing user by OpenID subject identifier, or by email/username based on server settings
   * Returns null if no user is found
   *
   * @param {Object} userinfo
   * @returns {Promise<User|{error: string}>}
   */
  static async findUserFromOpenIdUserInfo(userinfo: OpenIdUserInfo) {
    let user = await this.getUserByOpenIDSub(userinfo.sub)

    // Matched by sub
    if (user) {
      Logger.debug(`[User] openid: User found by sub "${userinfo.sub}"`)
      return user
    }

    // Match existing user by email
    if (global.ServerSettings.authOpenIDMatchExistingBy === 'email') {
      if (userinfo.email) {
        // Only disallow when email_verified explicitly set to false (allow both if not set or true)
        if (userinfo.email_verified === false) {
          Logger.warn(`[User] openid: User not found and email "${userinfo.email}" is not verified`)
          return {
            error: 'Email not verified'
          }
        } else {
          Logger.info(`[User] openid: User not found, checking existing with email "${userinfo.email}"`)
          user = await this.getUserByEmail(userinfo.email)

          if (user?.authOpenIDSub) {
            Logger.warn(`[User] openid: User found with email "${userinfo.email}" but is already matched with sub "${user.authOpenIDSub}"`)
            // User is linked to a different OpenID subject; do not proceed.
            return {
              error: 'User already linked to a different OpenID subject'
            }
          }
        }
      } else {
        Logger.warn(`[User] openid: User not found and no email in userinfo`)
        // We deny login, because if the admin whishes to match email, it makes sense to require it
        return {
          error: 'No email in userinfo'
        }
      }
    }
    // Match existing user by username
    else if (global.ServerSettings.authOpenIDMatchExistingBy === 'username') {
      let username

      if (userinfo.preferred_username) {
        Logger.info(`[User] openid: User not found, checking existing with userinfo.preferred_username "${userinfo.preferred_username}"`)
        username = userinfo.preferred_username
      } else if (userinfo.username) {
        Logger.info(`[User] openid: User not found, checking existing with userinfo.username "${userinfo.username}"`)
        username = userinfo.username
      } else {
        Logger.warn(`[User] openid: User not found and neither preferred_username nor username in userinfo`)
        return {
          error: 'No username in userinfo'
        }
      }

      user = await this.getUserByUsername(username)

      if (user?.authOpenIDSub) {
        Logger.warn(`[User] openid: User found with username "${username}" but is already matched with sub "${user.authOpenIDSub}"`)
        // User is linked to a different OpenID subject; do not proceed.
        return {
          error: 'User already linked to a different OpenID subject'
        }
      }
    }

    if (!user) {
      return null
    }

    // Found existing user via email or username
    if (!user.isActive) {
      Logger.warn(`[User] openid: User found but is not active`)
      return user
    }

    // Update user with OpenID sub
    if (!user.extraData) user.extraData = {}
    user.extraData.authOpenIDSub = userinfo.sub
    user.changed('extraData', true)
    await user.save()

    Logger.debug(`[User] openid: User found by email/username`)
    return user
  }

  /**
   * Create user from openid userinfo
   * @param {Object} userinfo
   * @returns {Promise<User>}
   */
  static async createUserFromOpenIdUserInfo(userinfo: OpenIdUserInfo) {
    const userId = uuidv4()
    // TODO: Ensure username is unique?
    const username = userinfo.preferred_username || userinfo.name || userinfo.sub
    const email = userinfo.email && userinfo.email_verified ? userinfo.email : null

    const token = TokenManager.generateAccessToken({ id: userId, username })

    const newUser = {
      id: userId,
      type: 'user',
      username,
      email,
      pash: null,
      token,
      isActive: true,
      permissions: this.getDefaultPermissionsForUserType('user'),
      bookmarks: [],
      extraData: {
        authOpenIDSub: userinfo.sub,
        seriesHideFromContinueListening: []
      }
    }
    const user = await this.create(newUser)

    if (user) {
      SocketAuthority.adminEmitter('user_added', user.toOldJSONForBrowser())
      return user
    }
    return null
  }

  /**
   * Get user by username case insensitive
   * @param {string} username
   * @returns {Promise<User>}
   */
  static async getUserByUsername(username: string | null | undefined) {
    if (!username) return null

    const cachedUser = userCache.getByUsername(username)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('username')), username.toLowerCase()),
      include: this.sequelize.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  /**
   * Get user by email case insensitive
   * @param {string} email
   * @returns {Promise<User>}
   */
  static async getUserByEmail(email: string | null | undefined) {
    if (!email) return null

    const cachedUser = userCache.getByEmail(email)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email.toLowerCase()),
      include: this.sequelize.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  /**
   * Get user by id
   * @param {string} userId
   * @returns {Promise<User>}
   */
  static async getUserById(userId: string | null | undefined) {
    if (!userId) return null

    const cachedUser = userCache.getById(userId)
    if (cachedUser) return cachedUser

    const user = await this.findByPk(userId, {
      include: this.sequelize.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  /**
   * Get user by id or old id
   * JWT tokens generated before 2.3.0 used old user ids
   *
   * @param {string} userId
   * @returns {Promise<User>}
   */
  static async getUserByIdOrOldId(userId: string | null | undefined) {
    if (!userId) return null
    const cachedUser = userCache.getById(userId) || userCache.getByOldId(userId)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: {
        [sequelize.Op.or]: [{ id: userId }, { 'extraData.oldUserId': userId }]
      },
      include: this.sequelize.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  /**
   * Get user by openid sub
   * @param {string} sub
   * @returns {Promise<User>}
   */
  static async getUserByOpenIDSub(sub: string | null | undefined) {
    if (!sub) return null

    const cachedUser = userCache.getByOpenIDSub(sub)
    if (cachedUser) return cachedUser

    const user = await this.findOne({
      where: sequelize.where(sequelize.literal(`extraData->>"authOpenIDSub"`), sub),
      include: this.sequelize.models.mediaProgress
    })

    if (user) userCache.set(user)

    return user
  }

  /**
   * Get array of user id and username
   * @returns {object[]} { id, username }
   */
  static async getMinifiedUserObjects() {
    const users = await this.findAll({
      attributes: ['id', 'username']
    })
    return users.map((u) => {
      return {
        id: u.id,
        username: u.username
      }
    })
  }

  /**
   * Return true if root user exists
   * @returns {boolean}
   */
  static async getHasRootUser() {
    const count = await this.count({
      where: {
        type: 'root'
      }
    })
    return count > 0
  }

  /**
   * Check if user exists with username
   * @param {string} username
   * @returns {boolean}
   */
  static async checkUserExistsWithUsername(username: string) {
    const count = await this.count({
      where: {
        username
      }
    })
    return count > 0
  }

  static mediaProgressRemoved(mediaProgress: MediaProgress) {
    const cachedUser = userCache.getById(mediaProgress.userId)
    if (cachedUser) {
      Logger.debug(`[User] mediaProgressRemoved: ${mediaProgress.id} from user ${cachedUser.id}`)
      cachedUser.mediaProgresses = cachedUser.mediaProgresses!.filter((mp) => mp.id !== mediaProgress.id)
    }
  }

  /**
   * Initialize model
   * @param {import('../Database').sequelize} sequelize
   */
  static init(sequelize: Sequelize): void
  static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(this: MS, attributes: ModelAttributes<M, Partial<Attributes<M>>>, options: InitOptions<M>): MS
  static init(sequelizeOrAttributes: Sequelize | ModelAttributes): void | ModelStatic<Model> {
    // Database.buildModels supplies the single Sequelize argument.
    const sequelize = sequelizeOrAttributes as Sequelize
    super.init<typeof User, User>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        username: DataTypes.STRING,
        email: DataTypes.STRING,
        pash: DataTypes.STRING,
        type: DataTypes.STRING,
        token: DataTypes.STRING,
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        isLocked: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        lastSeen: DataTypes.DATE,
        permissions: DataTypes.JSON,
        bookmarks: DataTypes.JSON,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'user',
        hooks: {
          beforeDestroy(user) {
            if (user.type === 'root') {
              throw new Error('Root user cannot be deleted')
            }
          }
        }
      }
    )
  }

  get isRoot() {
    return this.type === 'root'
  }
  get isAdminOrUp() {
    return this.isRoot || this.type === 'admin'
  }
  get isUser() {
    return this.type === 'user'
  }
  get isGuest() {
    return this.type === 'guest'
  }
  get canAccessExplicitContent() {
    return !!this.permissions?.accessExplicitContent && this.isActive
  }
  get canDelete() {
    return !!this.permissions?.delete && this.isActive
  }
  get canUpdate() {
    return !!this.permissions?.update && this.isActive
  }
  get canDownload() {
    return !!this.permissions?.download && this.isActive
  }
  get canUpload() {
    return !!this.permissions?.upload && this.isActive
  }
  /** @type {string|null} */
  get authOpenIDSub() {
    return this.extraData?.authOpenIDSub || null
  }

  /**
   * User data for clients
   * Emitted on socket events user_online, user_offline and user_stream_update
   *
   * @param {import('../objects/PlaybackSession')[]} sessions
   * @returns
   */
  toJSONForPublic(sessions: PublicSession[] | null | undefined) {
    const session = sessions?.find((s) => s.userId === this.id)?.toJSONForClient() || null
    return {
      id: this.id,
      username: this.username,
      type: this.type,
      session,
      lastSeen: this.lastSeen?.valueOf() || null,
      createdAt: this.createdAt.valueOf()
    }
  }

  /**
   * User data for browser using old model
   *
   * @param {boolean} [hideRootToken=false]
   * @param {boolean} [minimal=false]
   * @returns
   */
  toOldJSONForBrowser(hideRootToken = false, minimal = false) {
    const seriesHideFromContinueListening = this.extraData?.seriesHideFromContinueListening || []
    const librariesAccessible = this.permissions?.librariesAccessible || []
    const itemTagsSelected = this.permissions?.itemTagsSelected || []
    const permissions = { ...this.permissions }
    delete permissions.librariesAccessible
    delete permissions.itemTagsSelected

    const json: BrowserJSON = {
      id: this.id,
      username: this.username,
      email: this.email,
      type: this.type,
      // TODO: Old non-expiring token
      token: this.type === 'root' && hideRootToken ? '' : this.token,
      // TODO: Temporary flag not saved in db that is set in Auth.js jwtAuthCheck
      // Necessary to detect apps using old tokens that no longer match the old token stored on the user
      isOldToken: this.isOldToken,
      mediaProgress: this.mediaProgresses?.map((mp) => mp.getOldMediaProgress()) || [],
      seriesHideFromContinueListening: [...seriesHideFromContinueListening],
      bookmarks: this.bookmarks?.map((b) => ({ ...b })) || [],
      isActive: this.isActive,
      isLocked: this.isLocked,
      lastSeen: this.lastSeen?.valueOf() || null,
      createdAt: this.createdAt.valueOf(),
      permissions: permissions,
      librariesAccessible: [...librariesAccessible],
      itemTagsSelected: [...itemTagsSelected],
      hasOpenIDLink: !!this.authOpenIDSub
    }
    if (minimal) {
      delete json.mediaProgress
      delete json.bookmarks
    }
    return json
  }

  /**
   * Check user has access to library
   *
   * @param {string} libraryId
   * @returns {boolean}
   */
  checkCanAccessLibrary(libraryId: string) {
    if (this.permissions?.accessAllLibraries) return true
    if (!this.permissions?.librariesAccessible) return false
    return this.permissions.librariesAccessible.includes(libraryId)
  }

  /**
   * Check user has access to library item with tags
   *
   * @param {string[]} tags
   * @returns {boolean}
   */
  // Callers load permissions before checking tags; retain the failure for missing permissions.
  checkCanAccessLibraryItemWithTags(tags: string[] | null | undefined) {
    if (this.permissions!.accessAllTags) return true
    const itemTagsSelected = this.permissions?.itemTagsSelected || []
    if (this.permissions!.selectedTagsNotAccessible) {
      if (!tags?.length) return true
      return tags.every((tag) => !itemTagsSelected?.includes(tag))
    }
    if (!tags?.length) return false
    return itemTagsSelected.some((tag) => tags.includes(tag))
  }

  /**
   * Check user can access library item
   *
   * @param {import('./LibraryItem')} libraryItem
   * @returns {boolean}
   */
  checkCanAccessLibraryItem(libraryItem: AccessibleItem) {
    if (!this.checkCanAccessLibrary(libraryItem.libraryId)) return false

    const libraryItemExplicit = !!libraryItem.media.explicit || !!libraryItem.media.metadata?.explicit

    if (libraryItemExplicit && !this.canAccessExplicitContent) return false

    return this.checkCanAccessLibraryItemWithTags(libraryItem.media.tags)
  }

  /**
   * Get first available library id for user
   *
   * @param {string[]} libraryIds
   * @returns {string|null}
   */
  getDefaultLibraryId(libraryIds: string[]) {
    // Libraries should already be in ascending display order, find first accessible
    return libraryIds.find((lid) => this.checkCanAccessLibrary(lid)) || null
  }

  /**
   * Get media progress by media item id
   *
   * @param {string} libraryItemId
   * @param {string|null} [episodeId]
   * @returns {import('./MediaProgress')|null}
   */
  getMediaProgress(mediaItemId: string) {
    if (!this.mediaProgresses?.length) return null
    return this.mediaProgresses.find((mp) => mp.mediaItemId === mediaItemId)
  }

  /**
   * Get old media progress
   * TODO: Update to new model
   *
   * @param {string} libraryItemId
   * @param {string} [episodeId]
   * @returns
   */
  getOldMediaProgress(libraryItemId: string, episodeId: string | null = null) {
    const mediaProgress = this.mediaProgresses?.find((mp) => {
      if (episodeId && mp.mediaItemId !== episodeId) return false
      return mp.extraData?.libraryItemId === libraryItemId
    })
    return mediaProgress?.getOldMediaProgress() || null
  }

  /**
   * TODO: Uses old model and should account for the different between ebook/audiobook progress
   *
   * @param {ProgressUpdatePayload} progressPayload
   * @returns {Promise<{ mediaProgress: import('./MediaProgress'), error: [string], statusCode: [number] }>}
   */
  async createUpdateMediaProgressFromPayload(progressPayload: ProgressUpdatePayload): Promise<ProgressResult> {
    /** @type {import('./MediaProgress')|null} */
    // Includes below load progress for this user and normalize the library item's media.
    const podcastEpisodeModel = this.sequelize.models.podcastEpisode as ModelStatic<PodcastEpisode & { mediaProgresses?: MediaProgress[] }>
    const libraryItemModel = this.sequelize.models.libraryItem as unknown as ModelStatic<LibraryItem & { media: Book & { mediaProgresses?: MediaProgress[] } }>
    const mediaProgressModel = this.sequelize.models.mediaProgress as typeof MediaProgress
    let mediaProgress: MediaProgress | null | undefined = null
    let mediaItemId = null
    let podcastId = null
    if (progressPayload.episodeId) {
      const podcastEpisode = await podcastEpisodeModel.findByPk(progressPayload.episodeId, {
        attributes: ['id', 'podcastId'],
        include: [
          {
            model: this.sequelize.models.mediaProgress,
            where: { userId: this.id },
            required: false
          },
          {
            model: this.sequelize.models.podcast,
            attributes: ['id', 'title'],
            include: [{
              model: this.sequelize.models.libraryItem,
              attributes: ['id']
            }]
          }
        ]
      })
      if (!podcastEpisode) {
        Logger.error(`[User] createUpdateMediaProgress: episode ${progressPayload.episodeId} not found`)
        return {
          error: 'Episode not found',
          statusCode: 404
        }
      }
      mediaItemId = podcastEpisode.id
      mediaProgress = podcastEpisode.mediaProgresses?.[0]
      podcastId = podcastEpisode.podcastId
    } else {
      const libraryItem = await libraryItemModel.findByPk(progressPayload.libraryItemId, {
        attributes: ['id', 'mediaId', 'mediaType'],
        include: {
          model: this.sequelize.models.book,
          attributes: ['id', 'title'],
          required: false,
          include: [{
            model: this.sequelize.models.mediaProgress,
            where: { userId: this.id },
            required: false
          }]
        }
      })
      if (!libraryItem) {
        Logger.error(`[User] createUpdateMediaProgress: library item ${progressPayload.libraryItemId} not found`)
        return {
          error: 'Library item not found',
          statusCode: 404
        }
      } else if (libraryItem.mediaType !== 'book') {
        Logger.error(`[User] createUpdateMediaProgress: library item ${progressPayload.libraryItemId} is not a book`)
        return {
          error: 'Library item is not a book',
          statusCode: 400
        }
      }

      mediaItemId = libraryItem.media.id
      mediaProgress = libraryItem.media.mediaProgresses?.[0]
    }

    // Progress writes require an extended user with mediaProgresses already loaded.
    if (mediaProgress) {
      mediaProgress = await mediaProgress.applyProgressUpdate(progressPayload)
      this.mediaProgresses = this.mediaProgresses!.map((mp) => (mp.id === mediaProgress!.id ? mediaProgress! : mp))
    } else {
      const newMediaProgressPayload: sequelize.CreationAttributes<MediaProgress> & { extraData: { libraryItemId: string; progress: number } } = {
        userId: this.id,
        mediaItemId,
        podcastId,
        mediaItemType: progressPayload.episodeId ? 'podcastEpisode' : 'book',
        duration: isNullOrNaN(progressPayload.duration) ? 0 : Number(progressPayload.duration),
        currentTime: isNullOrNaN(progressPayload.currentTime) ? 0 : Number(progressPayload.currentTime),
        isFinished: !!progressPayload.isFinished,
        hideFromContinueListening: !!progressPayload.hideFromContinueListening,
        ebookLocation: progressPayload.ebookLocation || null,
        ebookProgress: isNullOrNaN(progressPayload.ebookProgress) ? 0 : Number(progressPayload.ebookProgress),
        finishedAt: progressPayload.finishedAt || null,
        createdAt: progressPayload.createdAt || new Date(),
        extraData: {
          libraryItemId: progressPayload.libraryItemId,
          progress: isNullOrNaN(progressPayload.progress) ? 0 : Number(progressPayload.progress)
        }
      }
      if (newMediaProgressPayload.isFinished) {
        newMediaProgressPayload.finishedAt = newMediaProgressPayload.finishedAt || new Date()
        newMediaProgressPayload.extraData.progress = 1
      } else {
        newMediaProgressPayload.finishedAt = null
      }
      mediaProgress = await mediaProgressModel.create(newMediaProgressPayload)
      this.mediaProgresses!.push(mediaProgress)
    }
    userCache.maybeInvalidate(this)
    return {
      mediaProgress
    }
  }

  /**
   * Find bookmark
   * TODO: Bookmarks should use mediaItemId instead of libraryItemId to support podcast episodes
   *
   * @param {string} libraryItemId
   * @param {number} time
   * @returns {AudioBookmarkObject|null}
   */
  // Bookmark operations require the initialized bookmark list from user creation.
  findBookmark(libraryItemId: string, time: number) {
    return this.bookmarks!.find((bm) => bm.libraryItemId === libraryItemId && bm.time == time)
  }

  /**
   * Create bookmark
   *
   * @param {string} libraryItemId
   * @param {number} time
   * @param {string} title
   * @returns {Promise<AudioBookmarkObject>}
   */
  async createBookmark(libraryItemId: string, time: number, title: string) {
    const existingBookmark = this.findBookmark(libraryItemId, time)
    if (existingBookmark) {
      Logger.warn('[User] Create Bookmark already exists for this time')
      if (existingBookmark.title !== title) {
        existingBookmark.title = title
        this.changed('bookmarks', true)
        await this.save()
      }
      return existingBookmark
    }

    const newBookmark = {
      libraryItemId,
      time,
      title,
      createdAt: Date.now()
    }
    this.bookmarks!.push(newBookmark)
    this.changed('bookmarks', true)
    await this.save()
    return newBookmark
  }

  /**
   * Update bookmark
   *
   * @param {string} libraryItemId
   * @param {number} time
   * @param {string} title
   * @returns {Promise<AudioBookmarkObject>}
   */
  async updateBookmark(libraryItemId: string, time: number, title: string) {
    const bookmark = this.findBookmark(libraryItemId, time)
    if (!bookmark) {
      Logger.error(`[User] updateBookmark not found`)
      return null
    }
    bookmark.title = title
    this.changed('bookmarks', true)
    await this.save()
    return bookmark
  }

  /**
   * Remove bookmark
   *
   * @param {string} libraryItemId
   * @param {number} time
   * @returns {Promise<boolean>} - true if bookmark was removed
   */
  async removeBookmark(libraryItemId: string, time: number) {
    if (!this.findBookmark(libraryItemId, time)) {
      Logger.error(`[User] removeBookmark not found`)
      return false
    }
    this.bookmarks = this.bookmarks!.filter((bm) => bm.libraryItemId !== libraryItemId || bm.time !== time)
    this.changed('bookmarks', true)
    await this.save()
    return true
  }

  /**
   *
   * @param {string} seriesId
   * @returns {Promise<boolean>}
   */
  async addSeriesToHideFromContinueListening(seriesId: string) {
    if (!this.extraData) this.extraData = {}
    const seriesHideFromContinueListening = this.extraData.seriesHideFromContinueListening || []
    if (seriesHideFromContinueListening.includes(seriesId)) return false
    seriesHideFromContinueListening.push(seriesId)
    this.extraData.seriesHideFromContinueListening = seriesHideFromContinueListening
    this.changed('extraData', true)
    await this.save()
    return true
  }

  /**
   *
   * @param {string} seriesId
   * @returns {Promise<boolean>}
   */
  async removeSeriesFromHideFromContinueListening(seriesId: string) {
    if (!this.extraData) this.extraData = {}
    let seriesHideFromContinueListening = this.extraData.seriesHideFromContinueListening || []
    if (!seriesHideFromContinueListening.includes(seriesId)) return false
    seriesHideFromContinueListening = seriesHideFromContinueListening.filter((sid) => sid !== seriesId)
    this.extraData.seriesHideFromContinueListening = seriesHideFromContinueListening
    this.changed('extraData', true)
    await this.save()
    return true
  }

  /**
   * Update user permissions from external JSON
   *
   * @param {Object} absPermissions JSON containing user permissions
   * @returns {Promise<boolean>} true if updates were made
   */
  async updatePermissionsFromExternalJSON(absPermissions: { [key: string]: unknown; allowedLibraries?: unknown[]; allowedTags?: unknown[] }) {
    if (!this.permissions) this.permissions = {}
    let hasUpdates = false

    // Map the boolean permissions from absPermissions
    Object.keys(absPermissions).forEach((absKey) => {
      const userPermKey = User.permissionMapping[absKey as keyof typeof User.permissionMapping]
      if (!userPermKey) {
        throw new Error(`Unexpected permission property: ${absKey}`)
      }

      if (userPermKey !== 'librariesAccessible' && userPermKey !== 'itemTagsSelected') {
        if (this.permissions![userPermKey] !== !!absPermissions[absKey]) {
          this.permissions![userPermKey] = !!absPermissions[absKey]
          hasUpdates = true
        }
      }
    })

    // Handle allowedLibraries
    const librariesAccessible = this.permissions.librariesAccessible || []
    if (this.permissions.accessAllLibraries) {
      if (librariesAccessible.length) {
        this.permissions.librariesAccessible = []
        hasUpdates = true
      }
    } else if (absPermissions.allowedLibraries?.length && absPermissions.allowedLibraries.join(',') !== librariesAccessible.join(',')) {
      if (absPermissions.allowedLibraries.some((lid) => typeof lid !== 'string')) {
        throw new Error('Invalid permission property "allowedLibraries", expecting array of strings')
      }
      // The element check above preserves the existing runtime validation.
      this.permissions.librariesAccessible = absPermissions.allowedLibraries as string[]
      hasUpdates = true
    }

    // Handle allowedTags
    const itemTagsSelected = this.permissions.itemTagsSelected || []
    if (this.permissions.accessAllTags) {
      if (itemTagsSelected.length) {
        this.permissions.itemTagsSelected = []
        hasUpdates = true
      }
    } else if (absPermissions.allowedTags?.length && absPermissions.allowedTags.join(',') !== itemTagsSelected.join(',')) {
      if (absPermissions.allowedTags.some((tag) => typeof tag !== 'string')) {
        throw new Error('Invalid permission property "allowedTags", expecting array of strings')
      }
      // The element check above preserves the existing runtime validation.
      this.permissions.itemTagsSelected = absPermissions.allowedTags as string[]
      hasUpdates = true
    }

    if (hasUpdates) {
      this.changed('permissions', true)
      await this.save()
    }

    return hasUpdates
  }

  update<Key extends keyof UserAttributes>(key: Key, value: UserAttributes[Key] | Col | Fn | Literal, options?: InstanceUpdateOptions<UserAttributes>): Promise<this>
  update(values: UserUpdate, options?: InstanceUpdateOptions<UserAttributes>): Promise<this>
  async update<Key extends keyof UserAttributes>(values: Key | UserUpdate, options?: UserAttributes[Key] | Col | Fn | Literal | InstanceUpdateOptions<UserAttributes>): Promise<this> {
    userCache.maybeInvalidate(this)
    // Preserve forwarding of two arguments in the original override.
    if (typeof values === 'string') return await super.update(values, options as UserAttributes[Key] | Col | Fn | Literal)
    return await super.update(values, options as InstanceUpdateOptions<UserAttributes> | undefined)
  }

  async save(options?: SaveOptions<UserAttributes>) {
    userCache.maybeInvalidate(this)
    return await super.save(options)
  }

  async destroy(options?: InstanceDestroyOptions) {
    userCache.delete(this.id)
    await super.destroy(options)
  }
}

declare namespace User { export type { AudioBookmarkObject, ProgressUpdatePayload, UserPermissions } }

export = User
