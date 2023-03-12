const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Collection extends Model { }

  Collection.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Collection'
  })

  const { Library } = sequelize.models

  Library.hasMany(Collection)
  Collection.belongsTo(Library)

  return Collection
}