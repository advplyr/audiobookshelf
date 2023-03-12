const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Podcast extends Model { }

  Podcast.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // Metadata
    title: DataTypes.STRING,
    author: DataTypes.STRING,
    releaseDate: DataTypes.STRING,
    feedUrl: DataTypes.STRING,
    imageUrl: DataTypes.STRING,
    description: DataTypes.TEXT,
    itunesPageUrl: DataTypes.STRING,
    itunesId: DataTypes.STRING,
    itunesArtistId: DataTypes.STRING,
    language: DataTypes.STRING,
    type: DataTypes.STRING,
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
    modelName: 'Podcast'
  })

  const { LibraryItem, FileMetadata } = sequelize.models
  LibraryItem.hasOne(Podcast)
  Podcast.belongsTo(LibraryItem)

  FileMetadata.hasOne(Podcast)
  Podcast.belongsTo(FileMetadata, { as: 'ImageFile' }) // Ref: https://sequelize.org/docs/v6/core-concepts/assocs/#defining-an-alias

  return Podcast
}