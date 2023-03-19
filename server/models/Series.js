const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Series extends Model { }

  Series.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'series'
  })

  return Series
}