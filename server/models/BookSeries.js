const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookSeries extends Model {
    static removeByIds(seriesId = null, bookId = null) {
      const where = {}
      if (seriesId) where.seriesId = seriesId
      if (bookId) where.bookId = bookId
      return this.destroy({
        where
      })
    }
  }

  BookSeries.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sequence: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'bookSeries',
    timestamps: true,
    updatedAt: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { book, series } = sequelize.models
  book.belongsToMany(series, { through: BookSeries })
  series.belongsToMany(book, { through: BookSeries })

  book.hasMany(BookSeries)
  BookSeries.belongsTo(book)

  series.hasMany(BookSeries)
  BookSeries.belongsTo(series)

  return BookSeries
}