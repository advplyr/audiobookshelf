const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookSeries extends Model { }

  BookSeries.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sequence: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'BookSeries',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Book, Series } = sequelize.models
  Book.belongsToMany(Series, { through: BookSeries })
  Series.belongsToMany(Book, { through: BookSeries })

  Book.hasMany(BookSeries)
  BookSeries.belongsTo(Book)

  Series.hasMany(BookSeries)
  BookSeries.belongsTo(Series)

  return BookSeries
}