const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class PodcastGenre extends Model { }

  PodcastGenre.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'podcastGenre',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { podcast, genre } = sequelize.models
  podcast.belongsToMany(genre, { through: PodcastGenre })
  genre.belongsToMany(podcast, { through: PodcastGenre })

  podcast.hasMany(PodcastGenre)
  PodcastGenre.belongsTo(podcast)

  genre.hasMany(PodcastGenre)
  PodcastGenre.belongsTo(genre)

  return PodcastGenre
}