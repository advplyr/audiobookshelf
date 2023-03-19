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
    modelName: 'collection'
  })

  const { library } = sequelize.models

  library.hasMany(Collection)
  Collection.belongsTo(library)

  return Collection
}