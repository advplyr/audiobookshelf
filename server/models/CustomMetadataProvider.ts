import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

type CustomMetadataProviderAttributes = {
  id: string
  mediaType: string | null
  name: string | null
  url: string | null
  authHeaderValue: string | null
  extraData: unknown
  createdAt?: Date
  updatedAt?: Date
}

type CustomMetadataProviderCreation = Optional<CustomMetadataProviderAttributes, 'id' | 'mediaType' | 'name' | 'url' | 'authHeaderValue' | 'extraData' | 'createdAt' | 'updatedAt'>

type ClientCustomMetadataProvider = {
  id: string
  name: string | null
  mediaType: string | null
  slug: string
}

class CustomMetadataProvider extends Model<CustomMetadataProviderAttributes, CustomMetadataProviderCreation> {
  declare id: string
  declare mediaType: string | null
  declare name: string | null
  declare url: string | null
  declare authHeaderValue: string | null
  declare extraData: unknown
  declare createdAt: Date
  declare updatedAt: Date

  constructor(values?: CustomMetadataProviderCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   * Get providers for client by media type
   * Currently only available for "book" media type
   *
   * @param {string} mediaType
   * @returns {Promise<ClientCustomMetadataProvider[]>}
   */
  static async getForClientByMediaType(mediaType: string): Promise<ClientCustomMetadataProvider[]> {
    if (mediaType !== 'book') return []
    const customMetadataProviders = await this.findAll({
      where: {
        mediaType
      }
    })
    return customMetadataProviders.map((cmp) => cmp.toClientJson())
  }

  /**
   * Check if provider exists by slug
   *
   * @param {string} providerSlug
   * @returns {Promise<boolean>}
   */
  static async checkExistsBySlug(providerSlug: string | null | undefined) {
    const providerId = providerSlug?.split?.('custom-')[1]
    if (!providerId) return false

    return (await this.count({ where: { id: providerId } })) > 0
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
    super.init<typeof CustomMetadataProvider, CustomMetadataProvider>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        mediaType: DataTypes.STRING,
        url: DataTypes.STRING,
        authHeaderValue: DataTypes.STRING,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'customMetadataProvider'
      }
    )
  }

  getSlug() {
    return `custom-${this.id}`
  }

  /**
   * Safe for clients
   * @returns {ClientCustomMetadataProvider}
   */
  toClientJson(): ClientCustomMetadataProvider {
    return {
      id: this.id,
      name: this.name,
      mediaType: this.mediaType,
      slug: this.getSlug()
    }
  }
}

export = CustomMetadataProvider
