const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Genre extends Model { }

  Genre.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    cleanName: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Genre'
  })

  return Genre
}