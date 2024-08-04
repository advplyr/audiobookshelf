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
   * Get all oldUsers
   * @returns {Promise<oldUser>}
   */
  static async getOldUsers() {
    const users = await this.findAll({
      include: this.sequelize.models.mediaProgress
    })
    return users.map((u) => this.getOldUser(u))
  }

  /**
   * Get old user model from new
   *
   * @param {Object} userExpanded
   * @returns {oldUser}
   */
  static getOldUser(userExpanded) {
    const mediaProgress = userExpanded.mediaProgresses.map((mp) => mp.getOldMediaProgress())

    const librariesAccessible = userExpanded.permissions?.librariesAccessible || []
    const itemTagsSelected = userExpanded.permissions?.itemTagsSelected || []
    const permissions = userExpanded.permissions || {}
    delete permissions.librariesAccessible
    delete permissions.itemTagsSelected

    return new oldUser({
      id: userExpanded.id,
      oldUserId: userExpanded.extraData?.oldUserId || null,
      username: userExpanded.username,
      email: userExpanded.email || null,
      pash: userExpanded.pash,
      type: userExpanded.type,
      token: userExpanded.token,
      mediaProgress,
      seriesHideFromContinueListening: userExpanded.extraData?.seriesHideFromContinueListening || [],
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
   * @param {Auth} auth
   * @returns {Promise<oldUser>}
   */
  static async createRootUser(username, pash, auth) {
    const userId = uuidv4()

    const token = await auth.generateAccessToken({ id: userId, username })

    const newRoot = new oldUser({
      id: userId,
      type: 'root',
      username,
      pash,
      token,
      isActive: true,
      createdAt: Date.now()
    })
    await this.createFromOld(newRoot)
    return newRoot
  }

  /**
   * Create user from openid userinfo
   * @param {Object} userinfo
   * @param {Auth} auth
   * @returns {Promise<oldUser>}
   */
  static async createUserFromOpenIdUserInfo(userinfo, auth) {
    const userId = uuidv4()
    // TODO: Ensure username is unique?
    const username = userinfo.preferred_username || userinfo.name || userinfo.sub
    const email = userinfo.email && userinfo.email_verified ? userinfo.email : null

    const token = await auth.generateAccessToken({ id: userId, username })

    const newUser = new oldUser({
      id: userId,
      type: 'user',
      username,
      email,
      pash: null,
      token,
      isActive: true,
      authOpenIDSub: userinfo.sub,
      createdAt: Date.now()
    })
    if (await this.createFromOld(newUser)) {
      SocketAuthority.adminEmitter('user_added', newUser.toJSONForBrowser())
      return newUser
    }
    return null
  }

  /**
   * Get a user by id or by the old database id
   * @temp User ids were updated in v2.3.0 migration and old API tokens may still use that id
   * @param {string} userId
   * @returns {Promise<oldUser|null>} null if not found
   */
  static async getUserByIdOrOldId(userId) {
    if (!userId) return null
    const user = await this.findOne({
      where: {
        [sequelize.Op.or]: [
          {
            id: userId
          },
          {
            extraData: {
              [sequelize.Op.substring]: userId
            }
          }
        ]
      },
      include: this.sequelize.models.mediaProgress
    })
    if (!user) return null
    return this.getOldUser(user)
  }

  /**
   * Get user by username case insensitive
   * @param {string} username
   * @returns {Promise<oldUser|null>} returns null if not found
   */
  static async getUserByUsername(username) {
    if (!username) return null
    const user = await this.findOne({
      where: {
        username: {
          [sequelize.Op.like]: username
        }
      },
      include: this.sequelize.models.mediaProgress
    })
    if (!user) return null
    return this.getOldUser(user)
  }

  /**
   * Get user by email case insensitive
   * @param {string} username
   * @returns {Promise<oldUser|null>} returns null if not found
   */
  static async getUserByEmail(email) {
    if (!email) return null
    const user = await this.findOne({
      where: {
        email: {
          [sequelize.Op.like]: email
        }
      },
      include: this.sequelize.models.mediaProgress
    })
    if (!user) return null
    return this.getOldUser(user)
  }

  /**
   * Get user by id
   * @param {string} userId
   * @returns {Promise<oldUser|null>} returns null if not found
   */
  static async getUserById(userId) {
    if (!userId) return null
    const user = await this.findByPk(userId, {
      include: this.sequelize.models.mediaProgress
    })
    if (!user) return null
    return this.getOldUser(user)
  }

  /**
   * Get user by openid sub
   * @param {string} sub
   * @returns {Promise<oldUser|null>} returns null if not found
   */
  static async getUserByOpenIDSub(sub) {
    if (!sub) return null
    const user = await this.findOne({
      where: sequelize.where(sequelize.literal(`extraData->>"authOpenIDSub"`), sub),
      include: this.sequelize.models.mediaProgress
    })
    if (!user) return null
    return this.getOldUser(user)
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
}

module.exports = User
