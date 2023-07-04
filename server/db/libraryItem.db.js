/**
 * TODO: Unused for testing
 */
const { Sequelize } = require('sequelize')
const Database = require('../Database')

const getLibraryItemMinified = (libraryItemId) => {
  return Database.models.libraryItem.findByPk(libraryItemId, {
    include: [
      {
        model: Database.models.book,
        attributes: [
          'id', 'title', 'subtitle', 'publishedYear', 'publishedDate', 'publisher', 'description', 'isbn', 'asin', 'language', 'explicit', 'narrators', 'coverPath', 'genres', 'tags'
        ],
        include: [
          {
            model: Database.models.author,
            attributes: ['id', 'name'],
            through: {
              attributes: []
            }
          },
          {
            model: Database.models.series,
            attributes: ['id', 'name'],
            through: {
              attributes: ['sequence']
            }
          }
        ]
      },
      {
        model: Database.models.podcast,
        attributes: [
          'id', 'title', 'author', 'releaseDate', 'feedURL', 'imageURL', 'description', 'itunesPageURL', 'itunesId', 'itunesArtistId', 'language', 'podcastType', 'explicit', 'autoDownloadEpisodes', 'genres', 'tags',
          [Sequelize.literal('(SELECT COUNT(*) FROM "podcastEpisodes" WHERE "podcastEpisodes"."podcastId" = podcast.id)'), 'numPodcastEpisodes']
        ]
      }
    ]
  })
}

const getLibraryItemExpanded = (libraryItemId) => {
  return Database.models.libraryItem.findByPk(libraryItemId, {
    include: [
      {
        model: Database.models.book,
        include: [
          {
            model: Database.models.author,
            through: {
              attributes: []
            }
          },
          {
            model: Database.models.series,
            through: {
              attributes: ['sequence']
            }
          }
        ]
      },
      {
        model: Database.models.podcast,
        include: [
          {
            model: Database.models.podcastEpisode
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