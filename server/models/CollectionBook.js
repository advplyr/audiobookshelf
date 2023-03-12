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
    modelName: 'CollectionBook'
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Book, Collection } = sequelize.models
  Book.belongsToMany(Collection, { through: CollectionBook })
  Collection.belongsToMany(Book, { through: CollectionBook })

  Book.hasMany(CollectionBook)
  CollectionBook.belongsTo(Book)

  Collection.hasMany(CollectionBook)
  CollectionBook.belongsTo(Collection)

  return CollectionBook
}