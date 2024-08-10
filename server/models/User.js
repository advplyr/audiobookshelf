const uuidv4 = require('uuid').v4
const sequelize = require('sequelize')
const Logger = require('../Logger')
const oldUser = require('../objects/user/User')
const SocketAuthority = require('../SocketAuthority')
const { DataTypes, Model } = sequelize

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
    /** @type {Object} */
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
   * Get first available library id for user
   *
   * @param {string[]} libraryIds
   * @returns {string|null}
   */
  getDefaultLibraryId(libraryIds) {
    // Libraries should already be in ascending display order, find first accessible
    return libraryIds.find((lid) => this.checkCanAccessLibrary(lid)) || null
  }
}

module.exports = User
