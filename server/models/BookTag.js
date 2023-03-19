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
    modelName: 'bookTag',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { book, tag } = sequelize.models
  book.belongsToMany(tag, { through: BookTag })
  tag.belongsToMany(book, { through: BookTag })

  book.hasMany(BookTag)
  BookTag.belongsTo(book)

  tag.hasMany(BookTag)
  BookTag.belongsTo(tag)

  return BookTag
}