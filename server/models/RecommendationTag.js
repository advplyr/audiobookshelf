'use strict'
module.exports.init = (sequelize) => {
  const { DataTypes } = require('sequelize')
  const RecommendationTag = sequelize.define(
    'recommendationTag',
    {
      slug: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { is: /^[a-z0-9-]+$/ } },
      label: { type: DataTypes.STRING, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    },
    { tableName: 'recommendation_tags' }
  )

  RecommendationTag.associate = (models) => {
    if (models.bookRecommendation) {
      RecommendationTag.hasMany(models.bookRecommendation, { as: 'recommendations', foreignKey: 'tagId' })
    }
  }
  return RecommendationTag
}
