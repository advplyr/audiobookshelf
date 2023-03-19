const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookGenre extends Model { }

  BookGenre.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'bookGenre',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { book, genre } = sequelize.models
  book.belongsToMany(genre, { through: BookGenre })
  genre.belongsToMany(book, { through: BookGenre })

  book.hasMany(BookGenre)
  BookGenre.belongsTo(book)

  genre.hasMany(BookGenre)
  BookGenre.belongsTo(genre)

  return BookGenre
}