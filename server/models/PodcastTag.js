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
    modelName: 'podcastTag',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { podcast, tag } = sequelize.models
  podcast.belongsToMany(tag, { through: PodcastTag })
  tag.belongsToMany(podcast, { through: PodcastTag })

  podcast.hasMany(PodcastTag)
  PodcastTag.belongsTo(podcast)

  tag.hasMany(PodcastTag)
  PodcastTag.belongsTo(tag)

  return PodcastTag
}