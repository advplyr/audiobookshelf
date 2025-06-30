const { DataTypes, Model, Op } = require('sequelize')
const jwt = require('jsonwebtoken')
const Logger = require('../Logger')

/**
 * @typedef {Object} ApiKeyPermissions
 * @property {boolean} download
 * @property {boolean} update
 * @property {boolean} delete
 * @property {boolean} upload
 * @property {boolean} createEreader
 * @property {boolean} accessAllLibraries
 * @property {boolean} accessAllTags
 * @property {boolean} accessExplicitContent
 * @property {boolean} selectedTagsNotAccessible
 * @property {string[]} librariesAccessible
 * @property {string[]} itemTagsSelected
 */

class ApiKey extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {Date} */
    this.expiresAt
    /** @type {Date} */
    this.lastUsedAt
    /** @type {boolean} */
    this.isActive
    /** @type {Object} */
    this.permissions
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
    /** @type {UUIDV4} */
    this.userId

    // Expanded properties

    /** @type {import('./User').User} */
    this.user
  }

  /**
   * Same properties as User.getDefaultPermissions
   * @returns {ApiKeyPermissions}
   */
  static getDefaultPermissions() {
    return {
      download: true,
      update: true,
      delete: true,
      upload: true,
      createEreader: true,
      accessAllLibraries: true,
      accessAllTags: true,
      accessExplicitContent: true,
      selectedTagsNotAccessible: false, // Inverts itemTagsSelected
      librariesAccessible: [],
      itemTagsSelected: []
    }
  }

  /**
   * Merge permissions from request with default permissions
   * @param {ApiKeyPermissions} reqPermissions
   * @returns {ApiKeyPermissions}
   */
  static mergePermissionsWithDefault(reqPermissions) {
    const permissions = this.getDefaultPermissions()

    if (!reqPermissions || typeof reqPermissions !== 'object') {
      Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid permissions: ${reqPermissions}`)
      return permissions
    }

    for (const key in reqPermissions) {
      if (reqPermissions[key] === undefined) {
        Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid permission key: ${key}`)
        continue
      }

      if (key === 'librariesAccessible' || key === 'itemTagsSelected') {
        if (!Array.isArray(reqPermissions[key]) || reqPermissions[key].some((value) => typeof value !== 'string')) {
          Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid ${key} value: ${reqPermissions[key]}`)
          continue
        }

        permissions[key] = reqPermissions[key]
      } else if (typeof reqPermissions[key] !== 'boolean') {
        Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid permission value for key ${key}. Should be boolean`)
        continue
      }

      permissions[key] = reqPermissions[key]
    }

    return permissions
  }

  /**
   * Clean up expired api keys from the database
   * @returns {Promise<number>} Number of api keys deleted
   */
  static async cleanupExpiredApiKeys() {
    const deletedCount = await ApiKey.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date()
        }
      }
    })
    return deletedCount
  }

  /**
   * Generate a new api key
   * @param {string} keyId
   * @param {string} name
   * @param {number} [expiresIn] - Seconds until the api key expires or undefined for no expiration
   * @returns {Promise<string>}
   */
  static async generateApiKey(keyId, name, expiresIn) {
    const options = {}
    if (expiresIn && !isNaN(expiresIn) && expiresIn > 0) {
      options.expiresIn = expiresIn
    }

    return new Promise((resolve) => {
      jwt.sign(
        {
          keyId,
          name,
          type: 'api'
        },
        global.ServerSettings.tokenSecret,
        options,
        (err, token) => {
          if (err) {
            Logger.error(`[ApiKey] Error generating API key: ${err}`)
            resolve(null)
          } else {
            resolve(token)
          }
        }
      )
    })
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
        name: DataTypes.STRING,
        expiresAt: DataTypes.DATE,
        lastUsedAt: DataTypes.DATE,
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        permissions: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'apiKey'
      }
    )

    const { user } = sequelize.models
    user.hasMany(ApiKey, {
      onDelete: 'SET NULL'
    })
    ApiKey.belongsTo(user)
  }
}

module.exports = ApiKey
