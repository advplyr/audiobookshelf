const { Sequelize } = require('sequelize')
const Database = require('../Database')

class LibraryItemController {
  constructor() { }

  // Example get library item full, expanded, minified
  async get(req, res) {
    const key = req.query.minified == 1 ? 'minified' : req.query.expanded == 1 ? 'expanded' : 'full'
    const include = {
      minified: [
        {
          model: Database.models.book,
          attributes: [
            'id', 'title', 'subtitle', 'publishedYear', 'publishedDate', 'publisher', 'description', 'isbn', 'asin', 'language', 'explicit',
            [Sequelize.literal('(SELECT COUNT(*) FROM "audioTracks" WHERE "audioTracks"."mediaItemId" = book.id)'), 'numAudioTracks'],
            [Sequelize.literal('(SELECT COUNT(*) FROM "bookChapters" WHERE "bookChapters"."bookId" = book.id)'), 'numChapters']
          ],
          include: [
            {
              model: Database.models.genre,
              attributes: ['id', 'name'],
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.tag,
              attributes: ['id', 'name'],
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.person,
              as: 'authors',
              attributes: ['id', 'name'],
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.person,
              as: 'narrators',
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
            'id', 'title', 'author', 'releaseDate', 'feedURL', 'imageURL', 'description', 'itunesPageURL', 'itunesId', 'itunesArtistId', 'language', 'podcastType', 'explicit', 'autoDownloadEpisodes',
            [Sequelize.literal('(SELECT COUNT(*) FROM "podcastEpisodes" WHERE "podcastEpisodes"."podcastId" = podcast.id)'), 'numPodcastEpisodes']
          ],
          include: [
            {
              model: Database.models.genre,
              attributes: ['id', 'name'],
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.tag,
              attributes: ['id', 'name'],
              through: {
                attributes: []
              }
            },
          ]
        }
      ],
      full: [
        {
          model: Database.models.book,
          include: [
            {
              model: Database.models.audioTrack
            },
            {
              model: Database.models.genre,
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.tag,
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.person,
              as: 'authors',
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.person,
              as: 'narrators',
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.series,
              through: {
                attributes: ['sequence']
              }
            },
            {
              model: Database.models.bookChapter
            },
            {
              model: Database.models.eBookFile,
              include: 'fileMetadata'
            }
          ]
        },
        {
          model: Database.models.podcast,
          include: [
            {
              model: Database.models.podcastEpisode,
              include: {
                model: Database.models.audioTrack
              }
            },
            {
              model: Database.models.genre,
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.tag,
              through: {
                attributes: []
              }
            },
          ]
        }
      ],
      expanded: [
        {
          model: Database.models.book,
          include: [
            {
              model: Database.models.fileMetadata,
              as: 'imageFile'
            },
            {
              model: Database.models.audioTrack,
              include: {
                model: Database.models.mediaFile,
                include: [
                  'fileMetadata',
                  'mediaStreams'
                ]
              }
            },
            {
              model: Database.models.genre,
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.tag,
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.person,
              as: 'authors',
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.person,
              as: 'narrators',
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.series,
              through: {
                attributes: ['sequence']
              }
            },
            {
              model: Database.models.bookChapter
            },
            {
              model: Database.models.eBookFile,
              include: 'fileMetadata'
            }
          ]
        },
        {
          model: Database.models.podcast,
          include: [
            {
              model: Database.models.fileMetadata,
              as: 'imageFile'
            },
            {
              model: Database.models.podcastEpisode,
              include: {
                model: Database.models.audioTrack,
                include: {
                  model: Database.models.mediaFile,
                  include: [
                    'fileMetadata',
                    'mediaStreams'
                  ]
                }
              }
            },
            {
              model: Database.models.genre,
              through: {
                attributes: []
              }
            },
            {
              model: Database.models.tag,
              through: {
                attributes: []
              }
            },
          ]
        },
        {
          model: Database.models.libraryFile,
          include: 'fileMetadata'
        },
        {
          model: Database.models.libraryFolder,
          include: 'library'
        }
      ]
    }
    const LibraryItem = await Database.models.libraryItem.findByPk(req.params.id, {
      include: include[key]
    })

    res.json(LibraryItem)
  }
}
module.exports = new LibraryItemController()