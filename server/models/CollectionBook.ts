import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

type CollectionBookAttributes = {
  id: string
  order: number | null
  bookId?: string | null
  collectionId?: string | null
  createdAt?: Date
}

type CollectionBookCreation = Optional<CollectionBookAttributes, 'id' | 'order' | 'bookId' | 'collectionId' | 'createdAt'>

class CollectionBook extends Model<CollectionBookAttributes, CollectionBookCreation> {
  declare id: string
  declare order: number | null
  declare bookId: string | null
  declare collectionId: string | null
  declare createdAt: Date

  constructor(values?: CollectionBookCreation, options?: BuildOptions) {
    super(values, options)
  }

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
    super.init<typeof CollectionBook, CollectionBook>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        order: DataTypes.INTEGER
      },
      {
        sequelize,
        timestamps: true,
        updatedAt: false,
        modelName: 'collectionBook'
      }
    )

    // Super Many-to-Many
    // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
    const { book, collection } = sequelize.models
    book.belongsToMany(collection, { through: CollectionBook })
    collection.belongsToMany(book, { through: CollectionBook })

    book.hasMany(CollectionBook, {
      onDelete: 'CASCADE'
    })
    CollectionBook.belongsTo(book)

    collection.hasMany(CollectionBook, {
      onDelete: 'CASCADE'
    })
    CollectionBook.belongsTo(collection)
  }
}

export = CollectionBook
