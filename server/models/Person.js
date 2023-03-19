const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Person extends Model { }

  Person.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    type: DataTypes.STRING,
    name: DataTypes.STRING,
    asin: DataTypes.STRING,
    description: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'person'
  })

  const { fileMetadata } = sequelize.models
  fileMetadata.hasMany(Person, { foreignKey: 'imageFileId' })
  Person.belongsTo(fileMetadata, { as: 'imageFile', foreignKey: 'imageFileId' }) // Ref: https://sequelize.org/docs/v6/core-concepts/assocs/#defining-an-alias

  return Person
}