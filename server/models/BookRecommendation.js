'use strict'

module.exports.init = (sequelize) => {
  const { DataTypes } = require('sequelize')

  const BookRecommendation = sequelize.define(
    'bookRecommendation',
    {
      bookId: { type: DataTypes.STRING, allowNull: false },

      recommenderUserId: { type: DataTypes.STRING, allowNull: false },

      recipientUserId: { type: DataTypes.STRING, allowNull: true },

      tagId: { type: DataTypes.INTEGER, allowNull: false },

      note: { type: DataTypes.TEXT, allowNull: true, validate: { len: [0, 1000] } },

      visibility: {
        type: DataTypes.ENUM('public', 'recipient-only'),
        allowNull: false,
        defaultValue: 'public'
      }
    },
    {
      tableName: 'book_recommendations',
      indexes: [{ fields: ['bookId'] }, { fields: ['recommenderUserId'] }, { fields: ['recipientUserId'] }, { fields: ['tagId'] }, { fields: ['visibility'] }]
    }
  )

  BookRecommendation.associate = (models) => {
    const { user: User, recommendationTag: RecommendationTag } = models

    if (User) {
      BookRecommendation.belongsTo(User, { as: 'recommender', foreignKey: 'recommenderUserId' })
      BookRecommendation.belongsTo(User, { as: 'recipient', foreignKey: 'recipientUserId' })
    }

    if (RecommendationTag) {
      BookRecommendation.belongsTo(RecommendationTag, { as: 'tag', foreignKey: 'tagId' })
    }

    if (models.libraryItem) {
      BookRecommendation.belongsTo(models.libraryItem, {
        as: 'item',
        foreignKey: 'bookId',
        targetKey: 'id'
      })
    }
  }

  return BookRecommendation
}
