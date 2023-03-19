const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookAuthor extends Model { }

  BookAuthor.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'bookAuthor',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { book, person } = sequelize.models
  book.belongsToMany(person, { through: BookAuthor, as: 'authors', otherKey: 'authorId' })
  person.belongsToMany(book, { through: BookAuthor, foreignKey: 'authorId' })

  book.hasMany(BookAuthor)
  BookAuthor.belongsTo(book)

  person.hasMany(BookAuthor, { foreignKey: 'authorId' })
  BookAuthor.belongsTo(person, { as: 'author', foreignKey: 'authorId' })

  return BookAuthor
}