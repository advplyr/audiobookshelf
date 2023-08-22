/**
 * TODO: Unused for testing
 */
const { Sequelize } = require('sequelize')
const Database = require('../Database')

const getLibraryItemMinified = (libraryItemId) => {
  return Database.libraryItemModel.findByPk(libraryItemId, {
    include: [
      {
        model: Database.bookModel,
        attributes: [
          'id', 'title', 'subtitle', 'publishedYear', 'publishedDate', 'publisher', 'description', 'isbn', 'asin', 'language', 'explicit', 'narrators', 'coverPath', 'genres', 'tags'
        ],
        include: [
          {
            model: Database.authorModel,
            attributes: ['id', 'name'],
            through: {
              attributes: []
            }
          },
          {
            model: Database.seriesModel,
            attributes: ['id', 'name'],
            through: {
              attributes: ['sequence']
            }
          }
        ]
      },
      {
        model: Database.podcastModel,
        attributes: [
          'id', 'title', 'author', 'releaseDate', 'feedURL', 'imageURL', 'description', 'itunesPageURL', 'itunesId', 'itunesArtistId', 'language', 'podcastType', 'explicit', 'autoDownloadEpisodes', 'genres', 'tags',
          [Sequelize.literal('(SELECT COUNT(*) FROM "podcastEpisodes" WHERE "podcastEpisodes"."podcastId" = podcast.id)'), 'numPodcastEpisodes']
        ]
      }
    ]
  })
}

const getLibraryItemExpanded = (libraryItemId) => {
  return Database.libraryItemModel.findByPk(libraryItemId, {
    include: [
      {
        model: Database.bookModel,
        include: [
          {
            model: Database.authorModel,
            through: {
              attributes: []
            }
          },
          {
            model: Database.seriesModel,
            through: {
              attributes: ['sequence']
            }
          }
        ]
      },
      {
        model: Database.podcastModel,
        include: [
          {
            model: Database.podcastEpisodeModel
          }
        ]
      },
      'libraryFolder',
      'library'
    ]
  })
}

module.exports = {
  getLibraryItemMinified,
  getLibraryItemExpanded
}