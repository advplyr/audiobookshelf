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
    modelName: 'PodcastGenre',
    timestamps: false
  })

  // Super Many-to-Many
  // ref: https://sequelize.org/docs/v6/advanced-association-concepts/advanced-many-to-many/#the-best-of-both-worlds-the-super-many-to-many-relationship
  const { Podcast, Genre } = sequelize.models
  Podcast.belongsToMany(Genre, { through: PodcastGenre })
  Genre.belongsToMany(Podcast, { through: PodcastGenre })

  Podcast.hasMany(PodcastGenre)
  PodcastGenre.belongsTo(Podcast)

  Genre.hasMany(PodcastGenre)
  PodcastGenre.belongsTo(Genre)

  return PodcastGenre
}