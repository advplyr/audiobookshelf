const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PodcastTag extends Model { }

  PodcastTag.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'PodcastTag',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Podcast, Tag } = sequelize.models
  Podcast.belongsToMany(Tag, { through: PodcastTag })
  Tag.belongsToMany(Podcast, { through: PodcastTag })

  Podcast.hasMany(PodcastTag)
  PodcastTag.belongsTo(Podcast)

  Tag.hasMany(PodcastTag)
  PodcastTag.belongsTo(Tag)

  return PodcastTag
}