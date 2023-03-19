const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Book extends Model { }

  Book.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: DataTypes.STRING,
    subtitle: DataTypes.STRING,
    publishedYear: DataTypes.STRING,
    publishedDate: DataTypes.STRING,
    publisher: DataTypes.STRING,
    description: DataTypes.TEXT,
    isbn: DataTypes.STRING,
    asin: DataTypes.STRING,
    language: DataTypes.STRING,
    explicit: DataTypes.BOOLEAN,
    lastCoverSearchQuery: DataTypes.STRING,
    lastCoverSearch: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'book'
  })

  const { fileMetadata, eBookFile } = sequelize.models

  fileMetadata.hasOne(Book, { foreignKey: 'imageFileId' })
  Book.belongsTo(fileMetadata, { as: 'imageFile', foreignKey: 'imageFileId' }) // Ref: https://sequelize.org/docs/v6/core-concepts/assocs/#defining-an-alias

  eBookFile.hasOne(Book)
  Book.belongsTo(eBookFile)

  return Book
}