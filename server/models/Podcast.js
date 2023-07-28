const { DataTypes, Model } = require('sequelize')

module.exports = (sequelize) => {
  class Podcast extends Model {
    static getOldPodcast(libraryItemExpanded) {
      const podcastExpanded = libraryItemExpanded.media
      const podcastEpisodes = podcastExpanded.podcastEpisodes.map(ep => ep.getOldPodcastEpisode(libraryItemExpanded.id)).sort((a, b) => a.index - b.index)
      return {
        id: podcastExpanded.id,
        libraryItemId: libraryItemExpanded.id,
        metadata: {
          title: podcastExpanded.title,
          author: podcastExpanded.author,
          description: podcastExpanded.description,
          releaseDate: podcastExpanded.releaseDate,
          genres: podcastExpanded.genres,
          feedUrl: podcastExpanded.feedURL,
          imageUrl: podcastExpanded.imageURL,
          itunesPageUrl: podcastExpanded.itunesPageURL,
          itunesId: podcastExpanded.itunesId,
          itunesArtistId: podcastExpanded.itunesArtistId,
          explicit: podcastExpanded.explicit,
          language: podcastExpanded.language,
          type: podcastExpanded.podcastType
        },
        coverPath: podcastExpanded.coverPath,
        tags: podcastExpanded.tags,
        episodes: podcastEpisodes,
        autoDownloadEpisodes: podcastExpanded.autoDownloadEpisodes,
        autoDownloadSchedule: podcastExpanded.autoDownloadSchedule,
        lastEpisodeCheck: podcastExpanded.lastEpisodeCheck?.valueOf() || null,
        maxEpisodesToKeep: podcastExpanded.maxEpisodesToKeep,
        maxNewEpisodesToDownload: podcastExpanded.maxNewEpisodesToDownload
      }
    }

    static getFromOld(oldPodcast) {
      const oldPodcastMetadata = oldPodcast.metadata
      return {
        id: oldPodcast.id,
        title: oldPodcastMetadata.title,
        titleIgnorePrefix: oldPodcastMetadata.titleIgnorePrefix,
        author: oldPodcastMetadata.author,
        releaseDate: oldPodcastMetadata.releaseDate,
        feedURL: oldPodcastMetadata.feedUrl,
        imageURL: oldPodcastMetadata.imageUrl,
        description: oldPodcastMetadata.description,
        itunesPageURL: oldPodcastMetadata.itunesPageUrl,
        itunesId: oldPodcastMetadata.itunesId,
        itunesArtistId: oldPodcastMetadata.itunesArtistId,
        language: oldPodcastMetadata.language,
        podcastType: oldPodcastMetadata.type,
        explicit: !!oldPodcastMetadata.explicit,
        autoDownloadEpisodes: !!oldPodcast.autoDownloadEpisodes,
        autoDownloadSchedule: oldPodcast.autoDownloadSchedule,
        lastEpisodeCheck: oldPodcast.lastEpisodeCheck,
        maxEpisodesToKeep: oldPodcast.maxEpisodesToKeep,
        maxNewEpisodesToDownload: oldPodcast.maxNewEpisodesToDownload,
        coverPath: oldPodcast.coverPath,
        tags: oldPodcast.tags,
        genres: oldPodcastMetadata.genres
      }
    }
  }

  Podcast.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: DataTypes.STRING,
    titleIgnorePrefix: DataTypes.STRING,
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
    coverPath: DataTypes.STRING,
    tags: DataTypes.JSON,
    genres: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'podcast'
  })

  return Podcast
}