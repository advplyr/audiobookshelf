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
    start: DataTypes.INTEGER,
    end: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'BookChapter'
  })

  const { Book } = sequelize.models

  Book.hasMany(BookChapter)
  BookChapter.belongsTo(Book)

  return BookChapter
}