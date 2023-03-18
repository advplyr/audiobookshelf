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
    modelName: 'Book'
  })

  const { LibraryItem, FileMetadata, EBookFile } = sequelize.models
  LibraryItem.hasOne(Book)
  Book.belongsTo(LibraryItem)

  FileMetadata.hasOne(Book, { foreignKey: 'ImageFileId ' })
  Book.belongsTo(FileMetadata, { as: 'ImageFile', foreignKey: 'ImageFileId' }) // Ref: https://sequelize.org/docs/v6/core-concepts/assocs/#defining-an-alias

  EBookFile.hasOne(Book)
  Book.belongsTo(EBookFile)

  return Book
}