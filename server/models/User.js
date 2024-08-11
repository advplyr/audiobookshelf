const uuidv4 = require('uuid').v4
const sequelize = require('sequelize')
const Logger = require('../Logger')
const oldUser = require('../objects/user/User')
const AudioBookmark = require('../objects/user/AudioBookmark')
const SocketAuthority = require('../SocketAuthority')
const { isNullOrNaN } = require('../utils')

const { DataTypes, Model } = sequelize

/**
 * @typedef AudioBookmarkObject
 * @property {string} libraryItemId
 * @property {string} title
 * @property {number} time
 * @property {number} createdAt
 */

class User extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.username
    /** @type {string} */
    this.email
    /** @type {string} */
    this.pash
    /** @type {string} */
    this.type
    /** @type {string} */
    this.token
    /** @type {boolean} */
    this.isActive
    /** @type {boolean} */
    this.isLocked
    /** @type {Date} */
    this.lastSeen
    /** @type {Object} */
    this.permissions
    /** @type {AudioBookmarkObject[]} */
    this.bookmarks
    /** @type {Object} */
    this.extraData
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
    /** @type {import('./MediaProgress')[]?} - Only included when extended */
    this.mediaProgresses
  }

  /**
   *
   * @param {string} type
   * @returns
   */
  static getDefaultPermissionsForUserType(type) {
    return {
      download: true,
      update: type === 'root' || type === 'admin',
      delete: type === 'root',
      upload: type === 'root' || type === 'admin',
      accessAllLibraries: true,
      accessAllTags: true,
      accessExplicitContent: true,
      librariesAccessible: [],
      itemTagsSelected: []
    }
  }

  /**
   * Get old user model from new
   *
   * @param {User} userExpanded
   * @returns {oldUser}
   */
  static getOldUser(userExpanded) {
    const mediaProgress = userExpanded.mediaProgresses.map((mp) => mp.getOldMediaProgress())

    const librariesAccessible = [...(userExpanded.permissions?.librariesAccessible || [])]
    const itemTagsSelected = [...(userExpanded.permissions?.itemTagsSelected || [])]
    const permissions = { ...(userExpanded.permissions || {}) }
    delete permissions.librariesAccessible
    delete permissions.itemTagsSelected

    const seriesHideFromContinueListening = userExpanded.extraData?.seriesHideFromContinueListening || []

    return new oldUser({
      id: userExpanded.id,
      oldUserId: userExpanded.extraData?.oldUserId || null,
      username: userExpanded.username,
      email: userExpanded.email || null,
      pash: userExpanded.pash,
      type: userExpanded.type,
      token: userExpanded.token,
      mediaProgress,
      seriesHideFromContinueListening: [...seriesHideFromContinueListening],
      bookmarks: userExpanded.bookmarks,
      isActive: userExpanded.isActive,
      isLocked: userExpanded.isLocked,
      lastSeen: userExpanded.lastSeen?.valueOf() || null,
      createdAt: userExpanded.createdAt.valueOf(),
      permissions,
      librariesAccessible,
      itemTagsSelected,
      authOpenIDSub: userExpanded.extraData?.authOpenIDSub || null
    })
  }

  /**
   *
   * @param {oldUser} oldUser
   * @returns {Promise<User>}
   */
  static createFromOld(oldUser) {
    const user = this.getFromOld(oldUser)
    return this.create(user)
  }

  /**
   * Update User from old user model
   *
   * @param {oldUser} oldUser
   * @param {boolean} [hooks=true] Run before / after bulk update hooks?
   * @returns {Promise<boolean>}
   */
  static updateFromOld(oldUser, hooks = true) {
    const user = this.getFromOld(oldUser)
    return this.update(user, {
      hooks: !!hooks,
      where: {
        id: user.id
      }
    })
      .then((result) => result[0] > 0)
      .catch((error) => {
        Logger.error(`[User] Failed to save user ${oldUser.id}`, error)
        return false
      })
  }

  /**
   * Get new User model from old
   *
   * @param {oldUser} oldUser
   * @returns {Object}
   */
  static getFromOld(oldUser) {
    const extraData = {
      seriesHideFromContinueListening: oldUser.seriesHideFromContinueListening || [],
      oldUserId: oldUser.oldUserId
    }
    if (oldUser.authOpenIDSub) {
      extraData.authOpenIDSub = oldUser.authOpenIDSub
    }

    return {
      id: oldUser.id,
      username: oldUser.username,
      email: oldUser.email || null,
      pash: oldUser.pash || null,
      type: oldUser.type || null,
      token: oldUser.token || null,
      isActive: !!oldUser.isActive,
      lastSeen: oldUser.lastSeen || null,
      extraData,
      createdAt: oldUser.createdAt || Date.now(),
      permissions: {
        ...oldUser.permissions,
        librariesAccessible: oldUser.librariesAccessible || [],
        itemTagsSelected: oldUser.itemTagsSelected || []
      },
      bookmarks: oldUser.bookmarks
    }
  }

  static removeById(userId) {
    return this.destroy({
      where: {
        id: userId
      }
    })
  }

  /**
   * Create root user
   * @param {string} username
   * @param {string} pash
   * @param {import('../Auth')} auth
   * @returns {Promise<User>}
   */
  static async createRootUser(username, pash, auth) {
    const userId = uuidv4()

    const token = await auth.generateAccessToken({ id: userId, username })

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
    return this.create(newUser)
  }

  /**
   * Create user from openid userinfo
   * @param {Object} userinfo
   * @param {import('../Auth')} auth
   * @returns {Promise<User>}
   */
  static async createUserFromOpenIdUserInfo(userinfo, auth) {
    const userId = uuidv4()
    // TODO: Ensure username is unique?
    const username = userinfo.preferred_username || userinfo.name || userinfo.sub
    const email = userinfo.email && userinfo.email_verified ? userinfo.email : null

    const token = await auth.generateAccessToken({ id: userId, username })

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
  static async getUserByUsername(username) {
    if (!username) return null
    return this.findOne({
      where: {
        username: {
          [sequelize.Op.like]: username
        }
      },
      include: this.sequelize.models.mediaProgress
    })
  }

  /**
   * Get user by email case insensitive
   * @param {string} email
   * @returns {Promise<User>}
   */
  static async getUserByEmail(email) {
    if (!email) return null
    return this.findOne({
      where: {
        email: {
          [sequelize.Op.like]: email
        }
      },
      include: this.sequelize.models.mediaProgress
    })
  }

  /**
   * Get user by id
   * @param {string} userId
   * @returns {Promise<User>}
   */
  static async getUserById(userId) {
    if (!userId) return null
    return this.findByPk(userId, {
      include: this.sequelize.models.mediaProgress
    })
  }

  /**
   * Get user by id or old id
   * JWT tokens generated before 2.3.0 used old user ids
   *
   * @param {string} userId
   * @returns {Promise<User>}
   */
  static async getUserByIdOrOldId(userId) {
    if (!userId) return null
    return this.findOne({
      where: {
        [sequelize.Op.or]: [{ id: userId }, { 'extraData.oldUserId': userId }]
      },
      include: this.sequelize.models.mediaProgress
    })
  }

  /**
   * @deprecated
   * Get old user by id
   * @param {string} userId
   * @returns {Promise<oldUser|null>} returns null if not found
   */
  static async getOldUserById(userId) {
    const user = await this.getUserById(userId)
    if (!user) return null
    return this.getOldUser(user)
  }

  /**
   * Get user by openid sub
   * @param {string} sub
   * @returns {Promise<User>}
   */
  static async getUserByOpenIDSub(sub) {
    if (!sub) return null
    return this.findOne({
      where: sequelize.where(sequelize.literal(`extraData->>"authOpenIDSub"`), sub),
      include: this.sequelize.models.mediaProgress
    })
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
  static async checkUserExistsWithUsername(username) {
    const count = await this.count({
      where: {
        username
      }
    })
    return count > 0
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
        modelName: 'user'
      }
    )
  }

  get isAdminOrUp() {
    return this.type === 'root' || this.type === 'admin'
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
  toJSONForPublic(sessions) {
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

    const json = {
      id: this.id,
      username: this.username,
      email: this.email,
      type: this.type,
      token: this.type === 'root' && hideRootToken ? '' : this.token,
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
  checkCanAccessLibrary(libraryId) {
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
  checkCanAccessLibraryItemWithTags(tags) {
    if (this.permissions.accessAllTags) return true
    const itemTagsSelected = this.permissions?.itemTagsSelected || []
    if (this.permissions.selectedTagsNotAccessible) {
      if (!tags?.length) return true
      return tags.every((tag) => !itemTagsSelected?.includes(tag))
    }
    if (!tags?.length) return false
    return itemTagsSelected.some((tag) => tags.includes(tag))
  }

  /**
   * Check user can access library item
   * TODO: Currently supports both old and new library item models
   *
   * @param {import('../objects/LibraryItem')|import('./LibraryItem')} libraryItem
   * @returns {boolean}
   */
  checkCanAccessLibraryItem(libraryItem) {
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
  getDefaultLibraryId(libraryIds) {
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
  getMediaProgress(mediaItemId) {
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
  getOldMediaProgress(libraryItemId, episodeId = null) {
    const mediaProgress = this.mediaProgresses?.find((mp) => {
      if (episodeId && mp.mediaItemId === episodeId) return true
      return mp.extraData?.libraryItemId === libraryItemId
    })
    return mediaProgress?.getOldMediaProgress() || null
  }

  /**
   * TODO: Uses old model and should account for the different between ebook/audiobook progress
   *
   * @typedef ProgressUpdatePayload
   * @property {string} libraryItemId
   * @property {string} [episodeId]
   * @property {number} [duration]
   * @property {number} [progress]
   * @property {number} [currentTime]
   * @property {boolean} [isFinished]
   * @property {boolean} [hideFromContinueListening]
   * @property {string} [ebookLocation]
   * @property {number} [ebookProgress]
   * @property {string} [finishedAt]
   * @property {number} [lastUpdate]
   *
   * @param {ProgressUpdatePayload} progressPayload
   * @returns {Promise<{ mediaProgress: import('./MediaProgress'), error: [string], statusCode: [number] }>}
   */
  async createUpdateMediaProgressFromPayload(progressPayload) {
    /** @type {import('./MediaProgress')|null} */
    let mediaProgress = null
    let mediaItemId = null
    if (progressPayload.episodeId) {
      const podcastEpisode = await this.sequelize.models.podcastEpisode.findByPk(progressPayload.episodeId, {
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
            include: {
              model: this.sequelize.models.libraryItem,
              attributes: ['id']
            }
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
    } else {
      const libraryItem = await this.sequelize.models.libraryItem.findByPk(progressPayload.libraryItemId, {
        attributes: ['id', 'mediaId', 'mediaType'],
        include: {
          model: this.sequelize.models.book,
          attributes: ['id', 'title'],
          required: false,
          include: {
            model: this.sequelize.models.mediaProgress,
            where: { userId: this.id },
            required: false
          }
        }
      })
      if (!libraryItem) {
        Logger.error(`[User] createUpdateMediaProgress: library item ${progressPayload.libraryItemId} not found`)
        return {
          error: 'Library item not found',
          statusCode: 404
        }
      }
      mediaItemId = libraryItem.media.id
      mediaProgress = libraryItem.media.mediaProgresses?.[0]
    }

    if (mediaProgress) {
      mediaProgress = await mediaProgress.applyProgressUpdate(progressPayload)
      this.mediaProgresses = this.mediaProgresses.map((mp) => (mp.id === mediaProgress.id ? mediaProgress : mp))
    } else {
      const newMediaProgressPayload = {
        userId: this.id,
        mediaItemId,
        mediaItemType: progressPayload.episodeId ? 'podcastEpisode' : 'book',
        duration: isNullOrNaN(progressPayload.duration) ? 0 : Number(progressPayload.duration),
        currentTime: isNullOrNaN(progressPayload.currentTime) ? 0 : Number(progressPayload.currentTime),
        isFinished: !!progressPayload.isFinished,
        hideFromContinueListening: !!progressPayload.hideFromContinueListening,
        ebookLocation: progressPayload.ebookLocation || null,
        ebookProgress: isNullOrNaN(progressPayload.ebookProgress) ? 0 : Number(progressPayload.ebookProgress),
        finishedAt: progressPayload.finishedAt || null,
        extraData: {
          libraryItemId: progressPayload.libraryItemId,
          progress: isNullOrNaN(progressPayload.progress) ? 0 : Number(progressPayload.progress)
        }
      }
      if (newMediaProgressPayload.isFinished) {
        newMediaProgressPayload.finishedAt = new Date()
        newMediaProgressPayload.extraData.progress = 1
      } else {
        newMediaProgressPayload.finishedAt = null
      }
      mediaProgress = await this.sequelize.models.mediaProgress.create(newMediaProgressPayload)
      this.mediaProgresses.push(mediaProgress)
    }
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
  findBookmark(libraryItemId, time) {
    return this.bookmarks.find((bm) => bm.libraryItemId === libraryItemId && bm.time == time)
  }

  /**
   * Create bookmark
   *
   * @param {string} libraryItemId
   * @param {number} time
   * @param {string} title
   * @returns {Promise<AudioBookmarkObject>}
   */
  async createBookmark(libraryItemId, time, title) {
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
    this.bookmarks.push(newBookmark)
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
  async updateBookmark(libraryItemId, time, title) {
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
  async removeBookmark(libraryItemId, time) {
    if (!this.findBookmark(libraryItemId, time)) {
      Logger.error(`[User] removeBookmark not found`)
      return false
    }
    this.bookmarks = this.bookmarks.filter((bm) => bm.libraryItemId !== libraryItemId || bm.time !== time)
    this.changed('bookmarks', true)
    await this.save()
    return true
  }

  /**
   *
   * @param {string} seriesId
   * @returns {Promise<boolean>}
   */
  async addSeriesToHideFromContinueListening(seriesId) {
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
  async removeSeriesFromHideFromContinueListening(seriesId) {
    if (!this.extraData) this.extraData = {}
    let seriesHideFromContinueListening = this.extraData.seriesHideFromContinueListening || []
    if (!seriesHideFromContinueListening.includes(seriesId)) return false
    seriesHideFromContinueListening = seriesHideFromContinueListening.filter((sid) => sid !== seriesId)
    this.extraData.seriesHideFromContinueListening = seriesHideFromContinueListening
    this.changed('extraData', true)
    await this.save()
    return true
  }
}

module.exports = User
