const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookNarrator extends Model { }

  BookNarrator.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'BookNarrator',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Book, Person } = sequelize.models
  Book.belongsToMany(Person, { through: BookNarrator })
  Person.belongsToMany(Book, { through: BookNarrator })

  Book.hasMany(BookNarrator)
  BookNarrator.belongsTo(Book)

  Person.hasMany(BookNarrator)
  BookNarrator.belongsTo(Person)

  return BookNarrator
}