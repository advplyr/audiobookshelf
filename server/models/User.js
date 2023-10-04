const uuidv4 = require("uuid").v4
const { DataTypes, Model, Op } = require('sequelize')
const Logger = require('../Logger')
const oldUser = require('../objects/user/User')

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
  }

  /**
   * Get all oldUsers
   * @returns {Promise<oldUser>}
   */
  static async getOldUsers() {
    const users = await this.findAll({
      include: this.sequelize.models.mediaProgress
    })
    return users.map(u => this.getOldUser(u))
  }

  static getOldUser(userExpanded) {
    const mediaProgress = userExpanded.mediaProgresses.map(mp => mp.getOldMediaProgress())

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
      itemTagsSelected
    })
  }

  static createFromOld(oldUser) {
    const user = this.getFromOld(oldUser)
    return this.create(user)
  }

  static updateFromOld(oldUser) {
    const user = this.getFromOld(oldUser)
    return this.update(user, {
      where: {
        id: user.id
      }
    }).then((result) => result[0] > 0).catch((error) => {
      Logger.error(`[User] Failed to save user ${oldUser.id}`, error)
      return false
    })
  }

  static getFromOld(oldUser) {
    return {
      id: oldUser.id,
      username: oldUser.username,
      email: oldUser.email || null,
      pash: oldUser.pash || null,
      type: oldUser.type || null,
      token: oldUser.token || null,
      isActive: !!oldUser.isActive,
      lastSeen: oldUser.lastSeen || null,
      extraData: {
        seriesHideFromContinueListening: oldUser.seriesHideFromContinueListening || [],
        oldUserId: oldUser.oldUserId
      },
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
   * @returns {oldUser}
   */
  static async createRootUser(username, pash, auth) {
    const userId = uuidv4()

    const token = await auth.generateAccessToken({ userId, username })

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
   * Get a user by id or by the old database id
   * @temp User ids were updated in v2.3.0 migration and old API tokens may still use that id
   * @param {string} userId 
   * @returns {Promise<oldUser|null>} null if not found
   */
  static async getUserByIdOrOldId(userId) {
    if (!userId) return null
    const user = await this.findOne({
      where: {
        [Op.or]: [
          {
            id: userId
          },
          {
            extraData: {
              [Op.substring]: userId
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
          [Op.like]: username
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
   * Get array of user id and username
   * @returns {object[]} { id, username }
   */
  static async getMinifiedUserObjects() {
    const users = await this.findAll({
      attributes: ['id', 'username']
    })
    return users.map(u => {
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
    super.init({
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
    }, {
      sequelize,
      modelName: 'user'
    })
  }
}

module.exports = User