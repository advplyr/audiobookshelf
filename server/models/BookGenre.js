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
    modelName: 'BookGenre',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Book, Genre } = sequelize.models
  Book.belongsToMany(Genre, { through: BookGenre })
  Genre.belongsToMany(Book, { through: BookGenre })

  Book.hasMany(BookGenre)
  BookGenre.belongsTo(Book)

  Genre.hasMany(BookGenre)
  BookGenre.belongsTo(Genre)

  return BookGenre
}