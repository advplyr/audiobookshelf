const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Library extends Model { }

  Library.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    displayOrder: DataTypes.INTEGER,
    icon: DataTypes.STRING,
    mediaType: DataTypes.STRING,
    provider: DataTypes.STRING,
    lastScan: DataTypes.DATE,
    scanVersion: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Library'
  })

  return Library
}