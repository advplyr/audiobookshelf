const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Podcast extends Model { }

  Podcast.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: DataTypes.STRING,
    author: DataTypes.STRING,
    releaseDate: DataTypes.STRING,
    feedURL: DataTypes.STRING,
    imageURL: DataTypes.STRING,
    description: DataTypes.TEXT,
    itunesPageURL: DataTypes.STRING,
    itunesId: DataTypes.STRING,
    itunesArtistId: DataTypes.STRING,
    language: DataTypes.STRING,
    podcastType: DataTypes.STRING,
    explicit: DataTypes.BOOLEAN,

    autoDownloadEpisodes: DataTypes.BOOLEAN,
    autoDownloadSchedule: DataTypes.STRING,
    lastEpisodeCheck: DataTypes.DATE,
    maxEpisodesToKeep: DataTypes.INTEGER,
    maxNewEpisodesToDownload: DataTypes.INTEGER,
    lastCoverSearchQuery: DataTypes.STRING,
    lastCoverSearch: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'podcast'
  })

  const { fileMetadata } = sequelize.models

  fileMetadata.hasOne(Podcast, { foreignKey: 'imageFileId' })
  Podcast.belongsTo(fileMetadata, { as: 'imageFile', foreignKey: 'imageFileId' }) // Ref: https://sequelize.org/docs/v6/core-concepts/assocs/#defining-an-alias

  return Podcast
}