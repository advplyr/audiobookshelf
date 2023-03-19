const Database = require('../Database')

class LibraryItemController {
  constructor() { }

  // Example get library item fully expanded or minified
  async get(req, res) {
    const key = req.query.minified == 1 ? 'minified' : 'full'
    const include = {
      minified: [
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
      full: [
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