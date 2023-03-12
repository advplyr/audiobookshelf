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
    modelName: 'BookAuthor',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Book, Person } = sequelize.models
  Book.belongsToMany(Person, { through: BookAuthor })
  Person.belongsToMany(Book, { through: BookAuthor })

  Book.hasMany(BookAuthor)
  BookAuthor.belongsTo(Book)

  Person.hasMany(BookAuthor)
  BookAuthor.belongsTo(Person)

  return BookAuthor
}