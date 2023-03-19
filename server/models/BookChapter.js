const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class BookChapter extends Model { }

  BookChapter.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    index: DataTypes.INTEGER,
    title: DataTypes.STRING,
    start: DataTypes.FLOAT,
    end: DataTypes.FLOAT
  }, {
    sequelize,
    modelName: 'bookChapter'
  })

  const { book } = sequelize.models

  book.hasMany(BookChapter)
  BookChapter.belongsTo(book)

  return BookChapter
}