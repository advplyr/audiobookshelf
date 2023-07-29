const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookAuthor extends Model {
    static removeByIds(authorId = null, bookId = null) {
      const where = {}
      if (authorId) where.authorId = authorId
      if (bookId) where.bookId = bookId
      return this.destroy({
        where
      })
    }
  }

  BookAuthor.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'bookAuthor',
    timestamps: true,
    updatedAt: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { book, author } = sequelize.models
  book.belongsToMany(author, { through: BookAuthor })
  author.belongsToMany(book, { through: BookAuthor })

  book.hasMany(BookAuthor)
  BookAuthor.belongsTo(book)

  author.hasMany(BookAuthor)
  BookAuthor.belongsTo(author)

  return BookAuthor
}