const Logger = require('../Logger')

class TtsController {
  constructor() {}

  /**
   * POST /api/tts/synthesize
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async synthesize(req, res) {
    const { apiKey, libraryItemId, voiceId, language, model } = req.body

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' })
    }
    if (!libraryItemId) {
      return res.status(400).json({ error: 'libraryItemId is required' })
    }
    if (!voiceId) {
      return res.status(400).json({ error: 'voiceId is required' })
    }

    try {
      // Find the library item and its ebook file
      const Database = require('../Database')
      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
      if (!libraryItem) {
        return res.status(404).json({ error: 'Library item not found' })
      }

      // Find ebook file
      const ebookFile = libraryItem.libraryFiles?.find((f) => f.metadata?.ext === '.epub')
      if (!ebookFile) {
        return res.status(400).json({ error: 'No EPUB file found for this library item' })
      }

      const Path = require('path')
      const outputDir = Path.join(libraryItem.path, 'tts_output')

      const TtsManager = require('../managers/TtsManager')
      const result = await TtsManager.synthesizeEbook({
        apiKey,
        libraryItemId,
        ebookPath: ebookFile.metadata.path,
        outputDir,
        voiceId: parseInt(voiceId),
        language: language || 'en-us',
        model: model || 'mars-flash'
      })

      res.json(result)
    } catch (error) {
      Logger.error(`[TtsController] Synthesis error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * GET /api/tts/voices
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getVoices(req, res) {
    const { apiKey } = req.query

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' })
    }

    try {
      const TtsManager = require('../managers/TtsManager')
      const voices = await TtsManager.getVoices(apiKey)
      res.json(voices)
    } catch (error) {
      Logger.error(`[TtsController] Get voices error: ${error.message}`)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * Middleware for TTS routes
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {Function} next
   */
  async middleware(req, res, next) {
    if (!req.user.isAdminOrUp) {
      return res.sendStatus(403)
    }
    next()
  }
}

module.exports = new TtsController()
