const { CambClient } = require('@camb-ai/sdk')
const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const TaskManager = require('./TaskManager')
const Task = require('../objects/Task')

class TtsManager {
  constructor() {
    this.tasksRunning = []
    this.tasksQueued = []
    this.MAX_CONCURRENT = 1
  }

  /**
   * Get list of available voices
   * @param {string} apiKey
   * @returns {Promise<Array>}
   */
  async getVoices(apiKey) {
    const client = new CambClient({ apiKey })
    const response = await fetch('https://client.camb.ai/apis/list-voices', {
      headers: { 'x-api-key': apiKey }
    })
    if (!response.ok) {
      throw new Error(`Failed to list voices: ${response.status}`)
    }
    return response.json()
  }

  /**
   * Synthesize a chapter to audio
   * @param {string} apiKey
   * @param {string} text
   * @param {number} voiceId
   * @param {string} outputPath
   * @param {string} language
   * @param {string} model
   * @returns {Promise<void>}
   */
  async synthesizeChapter(apiKey, text, voiceId, outputPath, language = 'en-us', model = 'mars-flash') {
    const response = await fetch('https://client.camb.ai/apis/tts-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        language,
        speech_model: model,
        output_configuration: { format: 'wav' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TTS API error (${response.status}): ${error}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer))
  }

  /**
   * Synthesize an ebook to audiobook
   * @param {object} options
   * @param {string} options.apiKey
   * @param {string} options.libraryItemId
   * @param {string} options.ebookPath
   * @param {string} options.outputDir
   * @param {number} options.voiceId
   * @param {string} options.language
   * @param {string} options.model
   * @returns {Promise<object>}
   */
  async synthesizeEbook({ apiKey, libraryItemId, ebookPath, outputDir, voiceId, language, model }) {
    const taskData = {
      libraryItemId,
      ebookPath,
      outputDir
    }

    const task = TaskManager.createAndAddTask('tts-synthesize', 'Synthesizing audiobook', 'Starting...', true, taskData)

    try {
      const textExtractor = require('../utils/textExtractor')
      const chapters = await textExtractor.extractFromEpub(ebookPath)

      if (!chapters.length) {
        task.setFailed('No text content found in ebook')
        TaskManager.taskFinished(task)
        return { success: false, error: 'No text content found' }
      }

      await fs.ensureDir(outputDir)

      const audioFiles = []
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        task.data.description = `Synthesizing chapter ${i + 1} of ${chapters.length}`

        const outputPath = Path.join(outputDir, `chapter_${String(i + 1).padStart(3, '0')}.wav`)

        await this.synthesizeChapter(apiKey, chapter.text, voiceId, outputPath, language, model)
        audioFiles.push(outputPath)

        Logger.info(`[TtsManager] Synthesized chapter ${i + 1}/${chapters.length}`)
      }

      task.setFinished(`Synthesized ${chapters.length} chapters`)
      TaskManager.taskFinished(task)

      return {
        success: true,
        audioFiles,
        chapters: chapters.map((c, i) => ({ title: c.title, audioFile: audioFiles[i] }))
      }
    } catch (error) {
      Logger.error(`[TtsManager] Synthesis failed: ${error.message}`)
      task.setFailed(error.message)
      TaskManager.taskFinished(task)
      return { success: false, error: error.message }
    }
  }
}

module.exports = new TtsManager()
