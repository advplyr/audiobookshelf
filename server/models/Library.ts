import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'
import type LibraryFolder from './LibraryFolder'
import Logger from '../Logger'

type LibrarySettings = {
  coverAspectRatio?: number
  disableWatcher?: boolean
  skipMatchingMediaWithAsin?: boolean
  skipMatchingMediaWithIsbn?: boolean
  autoScanCronExpression?: string | null
  podcastSearchRegion?: string
  audiobooksOnly?: boolean
  epubsAllowScriptedContent?: boolean
  hideSingleBookSeries?: boolean
  onlyShowLaterBooksInContinueSeries?: boolean
  metadataPrecedence?: string[]
  markAsFinishedTimeRemaining?: number
  markAsFinishedPercentComplete?: number | null
}

type LibraryAttributes = {
  id: string
  name: string | null
  displayOrder: number | null
  icon: string | null
  mediaType: string | null
  provider: string | null
  lastScan: Date | null
  lastScanVersion: string | null
  settings: LibrarySettings | null
  extraData: { lastScanMetadataPrecedence?: string[]; [key: string]: unknown } | null
  createdAt?: Date
  updatedAt?: Date
}

type LibraryCreation = Optional<LibraryAttributes, 'id' | 'name' | 'displayOrder' | 'icon' | 'mediaType' | 'provider' | 'lastScan' | 'lastScanVersion' | 'settings' | 'extraData' | 'createdAt' | 'updatedAt'>

class Library extends Model<LibraryAttributes, LibraryCreation> {
  // Query methods are used after Database.buildModels initializes the model.
  declare static sequelize: Sequelize
  declare id: string
  declare name: string | null
  declare displayOrder: number | null
  declare icon: string | null
  declare mediaType: string | null
  declare provider: string | null
  declare lastScan: Date | null
  declare lastScanVersion: string | null
  declare settings: LibrarySettings | null
  declare extraData: { lastScanMetadataPrecedence?: string[]; [key: string]: unknown } | null
  declare createdAt: Date
  declare updatedAt: Date
  declare libraryFolders?: LibraryFolder[]


  constructor(values?: LibraryCreation, options?: BuildOptions) {
    super(values, options)
  }

  /**
   *
   * @param {string} mediaType
   * @returns
   */
  static getDefaultLibrarySettingsForMediaType(mediaType: string | null | undefined) {
    if (mediaType === 'podcast') {
      return {
        coverAspectRatio: 1, // Square
        disableWatcher: false,
        autoScanCronExpression: null,
        podcastSearchRegion: 'us',
        markAsFinishedPercentComplete: null,
        markAsFinishedTimeRemaining: 10
      }
    } else {
      return {
        coverAspectRatio: 1, // Square
        disableWatcher: false,
        autoScanCronExpression: null,
        skipMatchingMediaWithAsin: false,
        skipMatchingMediaWithIsbn: false,
        audiobooksOnly: false,
        epubsAllowScriptedContent: false,
        hideSingleBookSeries: false,
        onlyShowLaterBooksInContinueSeries: false,
        metadataPrecedence: this.defaultMetadataPrecedence,
        markAsFinishedPercentComplete: null,
        markAsFinishedTimeRemaining: 10
      }
    }
  }

  static get defaultMetadataPrecedence() {
    return ['folderStructure', 'audioMetatags', 'nfoFile', 'txtFiles', 'opfFile', 'absMetadata']
  }

  /**
   *
   * @returns {Promise<Library[]>}
   */
  static getAllWithFolders() {
    return this.findAll({
      include: this.sequelize.models.libraryFolder,
      order: [['displayOrder', 'ASC']]
    })
  }

  /**
   *
   * @param {string} libraryId
   * @returns {Promise<Library>}
   */
  static findByIdWithFolders(libraryId: string) {
    return this.findByPk(libraryId, {
      include: this.sequelize.models.libraryFolder
    })
  }

  /**
   * Get all library ids
   * @returns {Promise<string[]>} array of library ids
   */
  static async getAllLibraryIds() {
    const libraries = await this.findAll({
      attributes: ['id', 'displayOrder'],
      order: [['displayOrder', 'ASC']]
    })
    return libraries.map((l) => l.id)
  }

  /**
   * Get the largest value in the displayOrder column
   * Used for setting a new libraries display order
   * @returns {Promise<number|null>}
   */
  static getMaxDisplayOrder() {
    // Sequelize returns a Promise; an empty table still resolves to null, as before.
    return this.max<number | null, Library>('displayOrder')
  }

  /**
   * Updates displayOrder to be sequential
   * Used after removing a library
   */
  static async resetDisplayOrder() {
    const libraries = await this.findAll({
      order: [['displayOrder', 'ASC']]
    })
    for (let i = 0; i < libraries.length; i++) {
      const library = libraries[i]
      if (library.displayOrder !== i + 1) {
        Logger.debug(`[Library] Updating display order of library from ${library.displayOrder} to ${i + 1}`)
        await library.update({ displayOrder: i + 1 }).catch((error: unknown) => {
          Logger.error(`[Library] Failed to update library display order to ${i + 1}`, error)
        })
      }
    }
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
    super.init<typeof Library, Library>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        name: DataTypes.STRING,
        displayOrder: DataTypes.INTEGER,
        icon: DataTypes.STRING,
        mediaType: DataTypes.STRING,
        provider: DataTypes.STRING,
        lastScan: DataTypes.DATE,
        lastScanVersion: DataTypes.STRING,
        settings: DataTypes.JSON,
        extraData: DataTypes.JSON
      },
      {
        sequelize,
        modelName: 'library'
      }
    )
  }

  get isPodcast() {
    return this.mediaType === 'podcast'
  }
  get isBook() {
    return this.mediaType === 'book'
  }
  /**
   * @returns {string[]}
   */
  get lastScanMetadataPrecedence() {
    return this.extraData?.lastScanMetadataPrecedence || []
  }

  /**
   * @returns {LibrarySettingsObject}
   */
  get librarySettings() {
    return this.settings || Library.getDefaultLibrarySettingsForMediaType(this.mediaType)
  }

  /**
   * TODO: Update to use new model
   */
  toOldJSON() {
    return {
      id: this.id,
      name: this.name,
      folders: (this.libraryFolders || []).map((f) => f.toOldJSON()),
      displayOrder: this.displayOrder,
      icon: this.icon,
      mediaType: this.mediaType,
      provider: this.provider,
      settings: {
        ...this.settings
      },
      lastScan: this.lastScan?.valueOf() || null,
      lastScanVersion: this.lastScanVersion,
      createdAt: this.createdAt.valueOf(),
      lastUpdate: this.updatedAt.valueOf()
    }
  }
}

declare namespace Library {
  export type LibrarySettingsObject = LibrarySettings
}

export = Library
