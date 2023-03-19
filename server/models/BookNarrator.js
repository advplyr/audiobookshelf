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
    modelName: 'bookNarrator',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { book, person } = sequelize.models
  book.belongsToMany(person, { through: BookNarrator, as: 'narrators', otherKey: 'narratorId' })
  person.belongsToMany(book, { through: BookNarrator, foreignKey: 'narratorId' })

  book.hasMany(BookNarrator)
  BookNarrator.belongsTo(book)

  person.hasMany(BookNarrator, { foreignKey: 'narratorId' })
  BookNarrator.belongsTo(person, { as: 'narrator', foreignKey: 'narratorId' })

  return BookNarrator
}