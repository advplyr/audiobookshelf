const { DataTypes, Model, Op } = require('sequelize')
const jwt = require('jsonwebtoken')
const { LRUCache } = require('lru-cache')
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

class ApiKeyCache {
  constructor() {
    this.cache = new LRUCache({ max: 100 })
  }

  getById(id) {
    const apiKey = this.cache.get(id)
    return apiKey
  }

  set(apiKey) {
    apiKey.fromCache = true
    this.cache.set(apiKey.id, apiKey)
  }

  delete(apiKeyId) {
    this.cache.delete(apiKeyId)
  }

  maybeInvalidate(apiKey) {
    if (!apiKey.fromCache) this.delete(apiKey.id)
  }
}

const apiKeyCache = new ApiKeyCache()

class ApiKey extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {string} */
    this.name
    /** @type {string} */
    this.description
    /** @type {Date} */
    this.expiresAt
    /** @type {Date} */
    this.lastUsedAt
    /** @type {boolean} */
    this.isActive
    /** @type {ApiKeyPermissions} */
    this.permissions
    /** @type {Date} */
    this.createdAt
    /** @type {Date} */
    this.updatedAt
    /** @type {UUIDV4} */
    this.userId
    /** @type {UUIDV4} */
    this.createdByUserId

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
   * Deactivate expired api keys
   * @returns {Promise<number>} Number of api keys affected
   */
  static async deactivateExpiredApiKeys() {
    const [affectedCount] = await ApiKey.update(
      {
        isActive: false
      },
      {
        where: {
          isActive: true,
          expiresAt: {
            [Op.lt]: new Date()
          }
        }
      }
    )
    return affectedCount
  }

  /**
   * Generate a new api key
   * @param {string} tokenSecret
   * @param {string} keyId
   * @param {string} name
   * @param {number} [expiresIn] - Seconds until the api key expires or undefined for no expiration
   * @returns {Promise<string>}
   */
  static async generateApiKey(tokenSecret, keyId, name, expiresIn) {
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
        tokenSecret,
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
   * Get an api key by id, from cache or database
   * @param {string} apiKeyId
   * @returns {Promise<ApiKey | null>}
   */
  static async getById(apiKeyId) {
    if (!apiKeyId) return null

    const cachedApiKey = apiKeyCache.getById(apiKeyId)
    if (cachedApiKey) return cachedApiKey

    const apiKey = await ApiKey.findByPk(apiKeyId)
    if (!apiKey) return null

    apiKeyCache.set(apiKey)
    return apiKey
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
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        description: DataTypes.TEXT,
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
      onDelete: 'CASCADE'
    })
    ApiKey.belongsTo(user)

    user.hasMany(ApiKey, {
      foreignKey: 'createdByUserId',
      onDelete: 'SET NULL'
    })
    ApiKey.belongsTo(user, { as: 'createdByUser', foreignKey: 'createdByUserId' })
  }

  async update(values, options) {
    apiKeyCache.maybeInvalidate(this)
    return await super.update(values, options)
  }

  async save(options) {
    apiKeyCache.maybeInvalidate(this)
    return await super.save(options)
  }

  async destroy(options) {
    apiKeyCache.delete(this.id)
    await super.destroy(options)
  }
}

module.exports = ApiKey
