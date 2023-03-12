const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Tag extends Model { }

  Tag.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Tag'
  })

  return Tag
}