const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Setting extends Model { }

  Setting.init({
    key: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    value: DataTypes.STRING,
    type: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Setting'
  })

  return Setting
}