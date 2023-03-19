const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class CollectionBook extends Model { }

  CollectionBook.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    timestamps: true,
    updatedAt: false,
    modelName: 'collectionBook'
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { book, collection } = sequelize.models
  book.belongsToMany(collection, { through: CollectionBook })
  collection.belongsToMany(book, { through: CollectionBook })

  book.hasMany(CollectionBook)
  CollectionBook.belongsTo(book)

  collection.hasMany(CollectionBook)
  CollectionBook.belongsTo(collection)

  return CollectionBook
}