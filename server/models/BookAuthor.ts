import { DataTypes, Model, fn, col } from 'sequelize'
import type { Attributes, BuildOptions, InitOptions, ModelAttributes, ModelStatic, Optional, Sequelize } from 'sequelize'

type BookAuthorAttributes = {
  id: string
  bookId?: string | null
  authorId?: string | null
  createdAt?: Date
}

type BookAuthorCreation = Optional<BookAuthorAttributes, 'id' | 'bookId' | 'authorId' | 'createdAt'>

class BookAuthor extends Model<BookAuthorAttributes, BookAuthorCreation> {
  declare id: string
  declare bookId: string | null
  declare authorId: string | null
  declare createdAt: Date

  // Populated only by the raw grouped COUNT projection.
  declare count?: unknown

  constructor(values?: BookAuthorCreation, options?: BuildOptions) {
    super(values, options)
  }

  static removeByIds(authorId: string | null = null, bookId: string | null = null) {
    const where: { authorId?: string; bookId?: string } = {}
    if (authorId) where.authorId = authorId
    if (bookId) where.bookId = bookId
    return this.destroy({
      where
    })
  }

  /**
   * Get number of books for author
   *
   * @param {string} authorId
   * @returns {Promise<number>}
   */
  static getCountForAuthor(authorId: string) {
    return this.count({
      where: {
        authorId
      }
    })
  }

  /**
   * Get number of books for each author
   *
   * @param {string[]} authorIds
   * @returns {Promise<Record<string, number>>}
   */
  static async getCountsForAuthors(authorIds: string[]): Promise<Record<string, number>> {
    if (!authorIds.length) return {}

    const rows = await this.findAll({
      attributes: ['authorId', [fn('COUNT', col('id')), 'count']],
      where: {
        authorId: authorIds
      },
      group: ['authorId'],
      raw: true
    })

    /** @type {Record<string, number>} */
    const counts: Record<string, number> = {}
    for (const row of rows) {
      counts[String(row.authorId)] = Number(row.count)
    }
    return counts
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
    super.init<typeof BookAuthor, BookAuthor>(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true
        }
      },
      {
        sequelize,
        modelName: 'bookAuthor',
        timestamps: true,
        updatedAt: false,
        indexes: [
          {
            name: 'bookAuthor_authorId',
            fields: ['authorId']
          }
        ]
      }
    )

    // Super Many-to-Many
    // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
    const { book, author } = sequelize.models
    book.belongsToMany(author, { through: BookAuthor })
    author.belongsToMany(book, { through: BookAuthor })

    book.hasMany(BookAuthor, {
      onDelete: 'CASCADE'
    })
    BookAuthor.belongsTo(book)

    author.hasMany(BookAuthor, {
      onDelete: 'CASCADE'
    })
    BookAuthor.belongsTo(author)
  }
}
export = BookAuthor
