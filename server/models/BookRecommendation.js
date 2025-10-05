// server/models/BookRecommendation.js
'use strict'

module.exports.init = (sequelize) => {
  const { DataTypes } = require('sequelize')

  const BookRecommendation = sequelize.define(
    'bookRecommendation',
    {
      // LibraryItem id (UUID string)
      bookId: { type: DataTypes.STRING, allowNull: false },

      // -> users.id (UUID string) — the recommender (sender)
      recommenderUserId: { type: DataTypes.STRING, allowNull: false },

      // -> users.id (UUID string), nullable — the recipient (if any)
      recipientUserId: { type: DataTypes.STRING, allowNull: true },

      // -> recommendation_tags.id (INTEGER)
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
      // helpful indexes for common queries
      indexes: [
        { fields: ['bookId'] },
        { fields: ['recommenderUserId'] },
        { fields: ['recipientUserId'] },
        { fields: ['tagId'] },
        { fields: ['visibility'] }
      ]
    }
  )

  BookRecommendation.associate = (models) => {
    const { user: User, recommendationTag: RecommendationTag } = models

    if (User) {
      // Canonical aliases
      BookRecommendation.belongsTo(User, {
        as: 'recommender',
        foreignKey: 'recommenderUserId'
      })
      BookRecommendation.belongsTo(User, {
        as: 'recipient',
        foreignKey: 'recipientUserId'
      })
      // (removed the duplicate alias "user")
    }

    if (RecommendationTag) {
      BookRecommendation.belongsTo(RecommendationTag, {
        as: 'tag',
        foreignKey: 'tagId'
      })
    }

    // Link to libraryItem so router can include media title
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
