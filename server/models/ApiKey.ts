import { DataTypes, Model, Op } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, InstanceDestroyOptions, InstanceUpdateOptions, ModelAttributes, ModelStatic, Optional, SaveOptions, Sequelize } from 'sequelize'
import type User from './User'
import type { Col, Fn, Literal } from 'sequelize/types/utils'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { LRUCache } from 'lru-cache'
import Logger from '../Logger'

type ApiPermissions = {
  download: boolean
  update: boolean
  delete: boolean
  upload: boolean
  createEreader: boolean
  accessAllLibraries: boolean
  accessAllTags: boolean
  accessExplicitContent: boolean
  selectedTagsNotAccessible: boolean
  librariesAccessible: string[]
  itemTagsSelected: string[]
  // Legacy merging also retains additional boolean permission keys.
  [key: string]: boolean | string[]
}

class ApiKeyCache {
  declare cache: LRUCache<string, ApiKey>

  constructor() {
    this.cache = new LRUCache<string, ApiKey>({ max: 100 })
  }

  getById(id: string) {
    const apiKey = this.cache.get(id)
    return apiKey
  }

  set(apiKey: ApiKey) {
    apiKey.fromCache = true
    this.cache.set(apiKey.id, apiKey)
  }

  delete(apiKeyId: string) {
    this.cache.delete(apiKeyId)
  }

  maybeInvalidate(apiKey: ApiKey) {
    if (!apiKey.fromCache) this.delete(apiKey.id)
  }
}

const apiKeyCache = new ApiKeyCache()

type ApiKeyAttributes = {
  id: string
  name: string
  description: string | null
  expiresAt: Date | null
  lastUsedAt: Date | null
  isActive: boolean
  permissions: ApiPermissions | null
  createdAt?: Date
  updatedAt?: Date
  userId?: string | null
  createdByUserId?: string | null
}

type ApiKeyCreation = Optional<ApiKeyAttributes, 'id' | 'description' | 'expiresAt' | 'lastUsedAt' | 'isActive' | 'permissions' | 'createdAt' | 'updatedAt' | 'userId' | 'createdByUserId'>
type ApiKeyUpdateValues = { [Key in keyof ApiKeyAttributes]?: ApiKeyAttributes[Key] | Col | Fn | Literal }

class ApiKey extends Model<ApiKeyAttributes, ApiKeyCreation> {
  declare id: string
  declare name: string
  declare description: string | null
  declare expiresAt: Date | null
  declare lastUsedAt: Date | null
  declare isActive: boolean
  declare permissions: ApiPermissions | null
  declare createdAt: Date
  declare updatedAt: Date
  declare userId: string | null
  declare createdByUserId: string | null
  declare user?: User
  declare fromCache?: boolean

  constructor(values?: ApiKeyCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   * Same properties as User.getDefaultPermissions
   * @returns {ApiKeyPermissions}
   */
  static getDefaultPermissions(): ApiPermissions {
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
  static mergePermissionsWithDefault(reqPermissions: unknown): ApiPermissions {
    const permissions = this.getDefaultPermissions()

    if (!reqPermissions || typeof reqPermissions !== 'object') {
      // concat preserves template-literal coercion, including errors for Symbols.
      Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid permissions: ${''.concat(reqPermissions as string)}`)
      return permissions
    }

    const requestedPermissions = reqPermissions as Record<string, unknown>
    for (const key in requestedPermissions) {
      if (requestedPermissions[key] === undefined) {
        Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid permission key: ${key}`)
        continue
      }

      if (key === 'librariesAccessible' || key === 'itemTagsSelected') {
        if (!Array.isArray(requestedPermissions[key]) || requestedPermissions[key].some((value: unknown) => typeof value !== 'string')) {
          Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid ${key} value: ${''.concat(requestedPermissions[key] as string)}`)
          continue
        }

        permissions[key] = requestedPermissions[key] as string[]
      } else if (typeof requestedPermissions[key] !== 'boolean') {
        Logger.warn(`[ApiKey] mergePermissionsWithDefault: Invalid permission value for key ${key}. Should be boolean`)
        continue
      }

      permissions[key] = requestedPermissions[key] as boolean | string[]
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
  static async generateApiKey(tokenSecret: string, keyId: string, name: string, expiresIn?: number): Promise<string | null | undefined> {
    const options: SignOptions = {}
    if (expiresIn && !isNaN(expiresIn) && expiresIn > 0) {
      options.expiresIn = expiresIn
    }

    return new Promise<string | null | undefined>((resolve) => {
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
  static async getById(apiKeyId: string) {
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
    super.init<typeof ApiKey, ApiKey>(
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

  update<Key extends keyof ApiKeyAttributes>(key: Key, value: ApiKeyAttributes[Key] | Col | Fn | Literal, options?: InstanceUpdateOptions<ApiKeyAttributes>): Promise<this>
  update(values: ApiKeyUpdateValues, options?: InstanceUpdateOptions<ApiKeyAttributes>): Promise<this>
  async update<Key extends keyof ApiKeyAttributes>(values: Key | ApiKeyUpdateValues, options?: ApiKeyAttributes[Key] | Col | Fn | Literal | InstanceUpdateOptions<ApiKeyAttributes>): Promise<this> {
    apiKeyCache.maybeInvalidate(this)
    // The overload selects the value/options shape; keep forwarding two arguments.
    if (typeof values === 'string') return await super.update(values, options as ApiKeyAttributes[Key] | Col | Fn | Literal)
    return await super.update(values, options as InstanceUpdateOptions<ApiKeyAttributes> | undefined)
  }

  async save(options?: SaveOptions<ApiKeyAttributes>) {
    apiKeyCache.maybeInvalidate(this)
    return await super.save(options)
  }

  async destroy(options?: InstanceDestroyOptions) {
    apiKeyCache.delete(this.id)
    await super.destroy(options)
  }
}

declare namespace ApiKey {
  export type ApiKeyPermissions = ApiPermissions
}

export = ApiKey
