import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

type LibraryFolderAttributes = {
  id: string
  path: string | null
  libraryId?: string | null
  createdAt?: Date
  updatedAt?: Date
}

type LibraryFolderCreation = Optional<LibraryFolderAttributes, 'id' | 'path' | 'libraryId' | 'createdAt' | 'updatedAt'>

class LibraryFolder extends Model<LibraryFolderAttributes, LibraryFolderCreation> {
  declare id: string
  declare path: string | null
  declare libraryId: string | null
  declare createdAt: Date
  declare updatedAt: Date

  constructor(values?: LibraryFolderCreation, options?: BuildOptions) {
    super(values, options)
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
    super.init<typeof LibraryFolder, LibraryFolder>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        path: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'libraryFolder'
      }
    )

    const { library } = sequelize.models
    library.hasMany(LibraryFolder, {
      onDelete: 'CASCADE'
    })
    LibraryFolder.belongsTo(library)
  }

  /**
   * TODO: Update to use new model
   */
  toOldJSON() {
    return {
      id: this.id,
      fullPath: this.path,
      libraryId: this.libraryId,
      addedAt: this.createdAt.valueOf()
    }
  }
}

export = LibraryFolder
