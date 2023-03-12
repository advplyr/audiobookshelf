const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookTag extends Model { }

  BookTag.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'BookTag',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Book, Tag } = sequelize.models
  Book.belongsToMany(Tag, { through: BookTag })
  Tag.belongsToMany(Book, { through: BookTag })

  Book.hasMany(BookTag)
  BookTag.belongsTo(Book)

  Tag.hasMany(BookTag)
  BookTag.belongsTo(Tag)

  return BookTag
}