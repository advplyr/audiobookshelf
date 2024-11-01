const { DataTypes, Model } = require('sequelize')

class BookAuthor extends Model {
  constructor(values, options) {
    super(values, options)

    /** @type {UUIDV4} */
    this.id
    /** @type {UUIDV4} */
    this.bookId
    /** @type {UUIDV4} */
    this.authorId
    /** @type {Date} */
    this.createdAt
  }

  static removeByIds(authorId = null, bookId = null) {
    const where = {}
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
  static getCountForAuthor(authorId) {
    return this.count({
      where: {
        authorId
      }
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
module.exports = BookAuthor
