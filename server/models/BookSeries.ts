import { DataTypes, Model } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

type BookSeriesAttributes = {
  id: string
  sequence: string | null
  bookId?: string | null
  seriesId?: string | null
  createdAt?: Date
}

type BookSeriesCreation = Optional<BookSeriesAttributes, 'id' | 'sequence' | 'bookId' | 'seriesId' | 'createdAt'>

class BookSeries extends Model<BookSeriesAttributes, BookSeriesCreation> {
  declare id: string
  declare sequence: string | null
  declare bookId: string | null
  declare seriesId: string | null
  declare createdAt: Date

  constructor(values?: BookSeriesCreation, options?: BuildOptions) {
    super(values, options)
  }

  static removeByIds(seriesId: string | null = null, bookId: string | null = null) {
    const where: { seriesId?: string; bookId?: string } = {}
    if (seriesId) where.seriesId = seriesId
    if (bookId) where.bookId = bookId
    return this.destroy({
      where
    })
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
    super.init<typeof BookSeries, BookSeries>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        },
        sequence: DataTypes.STRING
      },
      {
        sequelize,
        modelName: 'bookSeries',
        timestamps: true,
        updatedAt: false,
        indexes: [
          {
            name: 'bookSeries_seriesId',
            fields: ['seriesId']
          },
          {
            name: 'book_series_series_book',
            fields: ['seriesId', 'bookId']
          }
        ]
      }
    )

    // Super Many-to-Many
    // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
    const { book, series } = sequelize.models
    book.belongsToMany(series, { through: BookSeries })
    series.belongsToMany(book, { through: BookSeries })

    book.hasMany(BookSeries, {
      onDelete: 'CASCADE'
    })
    BookSeries.belongsTo(book)

    series.hasMany(BookSeries, {
      onDelete: 'CASCADE'
    })
    BookSeries.belongsTo(series)
  }
}

export = BookSeries
