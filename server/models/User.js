const uuidv4 = require("uuid").v4
const { DataTypes, Model } = require('sequelize')
const Logger = require('../Logger')
const oldUser = require('../objects/user/User')

module.exports = (sequelize) => {
  class User extends Model {
    static async getOldUsers() {
      const users = await this.findAll({
        include: sequelize.models.mediaProgress
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
  }

  User.init({
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

  return User
}