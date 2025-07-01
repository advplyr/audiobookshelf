const Logger = require('../Logger')
const Database = require('../Database')
const { Op } = require('sequelize')

class KOReaderController {
  tmpUsers = []

  /**
   * GET: /public/auth/users
   * Authenticate user for KOReader
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async authenticateUser(req, res) {
    console.log('KOReaderController.authenticateUser called')
    console.log('req.user:', req.body)

    // Check if user is authenticated

    return res.status(200).json({
      authorized: 'OK'
    })
  }

  async updateProgress(req, res) {
    try {
      const doc = req.body.document
      console.log(doc)
      if (!doc) {
        return res.status(400).json({ error: 'Document field is missing' })
      }

      const percentage = Number(req.body.percentage)
      const progress = req.body.progress
      const device = req.body.device
      const device_id = req.body.device_id
      const timestamp = Math.floor(Date.now() / 1000)

      if (percentage && progress && device) {
        const data = {
          percentage,
          progress,
          device,
          device_id,
          timestamp
        }

        console.log(data)

        // Needs to be saved later

        return res.status(200).json({
          document: doc,
          timestamp
        })
      } else {
        return res.status(400).json({ error: 'Invalid fields' })
      }
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  /**
   * GET: public/sync/:documentHash
   * Get reading progress for a document by its hash
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getProgress(req, res) {
    const { documentHash } = req.params

    console.log('KOReaderController.getProgress called with documentHash:', documentHash)

    if (!documentHash) {
      return res.status(400).json({ error: 'Document hash is required' })
    }

    try {
      const book = await Database.bookModel.findOne({
        where: {
          [Op.or]: [{ md5FileHash: documentHash }, { md5FilenameHash: documentHash }]
        },
        include: [
          {
            model: Database.mediaProgressModel,
            where: {
              // Idk how we will map this later. For now enter your user ID here
              userId: '50a15f71-8504-4046-be75-8cf38212d7d1',
              mediaItemType: 'book'
            },
            required: false
          }
        ]
      })

      if (!book) {
        return res.status(404).json({ error: 'Book not found for the provided hash' })
      }

      const mediaProgress = book.mediaProgresses?.[0]

      if (!mediaProgress) {
        return res.json({
          percentage: 0,
          progress: 0,
          device: null,
          device_id: null,
          timestamp: Math.floor(Date.now() / 1000)
        })
      }

      // Convert progress to KOReader format
      const progressPercentage = mediaProgress.ebookProgress || 0
      // Seems not to work currently at all
      const progressValue = mediaProgress.ebookLocation.replace('epubcfi(', '').replace(/\)$/, '')

      console.log(`Progress for hash "${documentHash}":`, {
        percentage: progressPercentage,
        progress: progressValue,
        device: '1',
        device_id: '1',
        timestamp: Math.floor(mediaProgress.updatedAt.getTime() / 1000)
      })

      return res.status(200).json({
        percentage: progressPercentage,
        progress: progressValue,
        device: '1',
        device_id: '1',
        timestamp: Math.floor(mediaProgress.updatedAt.getTime() / 1000)
      })
    } catch (error) {
      Logger.error(`[KOReaderController] Failed to get progress for hash "${documentHash}":`, error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

module.exports = new KOReaderController()
