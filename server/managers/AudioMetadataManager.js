const Path = require('path')

const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')

const fs = require('../libs/fsExtra')

const toneHelpers = require('../utils/toneHelpers')

const Task = require('../objects/Task')

class AudioMetadataMangaer {
  constructor(db, taskManager) {
    this.db = db
    this.taskManager = taskManager

    this.itemsCacheDir = Path.join(global.MetadataPath, 'cache/items')

    this.MAX_CONCURRENT_TASKS = 1
    this.tasksRunning = []
    this.tasksQueued = []
  }

  /**
  * Get queued task data
  * @return {Array}
  */
  getQueuedTaskData() {
    return this.tasksQueued.map(t => t.data)
  }

  getIsLibraryItemQueuedOrProcessing(libraryItemId) {
    return this.tasksQueued.some(t => t.data.libraryItemId === libraryItemId) || this.tasksRunning.some(t => t.data.libraryItemId === libraryItemId)
  }

  getToneMetadataObjectForApi(libraryItem) {
    const audioFiles = libraryItem.media.includedAudioFiles
    let mimeType = audioFiles[0].mimeType
    if (audioFiles.some(a => a.mimeType !== mimeType)) mimeType = null
    return toneHelpers.getToneMetadataObject(libraryItem, libraryItem.media.chapters, libraryItem.media.tracks.length, mimeType)
  }

  handleBatchEmbed(user, libraryItems, options = {}) {
    libraryItems.forEach((li) => {
      this.updateMetadataForItem(user, li, options)
    })
  }

  async updateMetadataForItem(user, libraryItem, options = {}) {
    const forceEmbedChapters = !!options.forceEmbedChapters
    const backupFiles = !!options.backup

    const audioFiles = libraryItem.media.includedAudioFiles

    const task = new Task()

    const itemCachePath = Path.join(this.itemsCacheDir, libraryItem.id)

    // Only writing chapters for single file audiobooks
    const chapters = (audioFiles.length == 1 || forceEmbedChapters) ? libraryItem.media.chapters.map(c => ({ ...c })) : null

    let mimeType = audioFiles[0].mimeType
    if (audioFiles.some(a => a.mimeType !== mimeType)) mimeType = null

    // Create task
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryItemPath: libraryItem.path,
      userId: user.id,
      audioFiles: audioFiles.map(af => (
        {
          index: af.index,
          ino: af.ino,
          filename: af.metadata.filename,
          path: af.metadata.path,
          cachePath: Path.join(itemCachePath, af.metadata.filename)
        }
      )),
      coverPath: libraryItem.media.coverPath,
      metadataObject: toneHelpers.getToneMetadataObject(libraryItem, chapters, audioFiles.length, mimeType),
      itemCachePath,
      chapters,
      options: {
        forceEmbedChapters,
        backupFiles
      }
    }
    const taskDescription = `Embedding metadata in audiobook "${libraryItem.media.metadata.title}".`
    task.setData('embed-metadata', 'Embedding Metadata', taskDescription, taskData)

    if (this.tasksRunning.length >= this.MAX_CONCURRENT_TASKS) {
      Logger.info(`[AudioMetadataManager] Queueing embed metadata for audiobook "${libraryItem.media.metadata.title}"`)
      SocketAuthority.adminEmitter('metadata_embed_queue_update', {
        libraryItemId: libraryItem.id,
        queued: true
      })
      this.tasksQueued.push(task)
    } else {
      this.runMetadataEmbed(task)
    }
  }

  async runMetadataEmbed(task) {
    this.tasksRunning.push(task)
    this.taskManager.addTask(task)

    Logger.info(`[AudioMetadataManager] Starting metadata embed task`, task.description)

    // Ensure item cache dir exists
    let cacheDirCreated = false
    if (!await fs.pathExists(task.data.itemCachePath)) {
      await fs.mkdir(task.data.itemCachePath)
      cacheDirCreated = true
    }

    // Create metadata json file
    const toneJsonPath = Path.join(task.data.itemCachePath, 'metadata.json')
    try {
      await fs.writeFile(toneJsonPath, JSON.stringify({ meta: task.data.metadataObject }, null, 2))
    } catch (error) {
      Logger.error(`[AudioMetadataManager] Write metadata.json failed`, error)
      task.setFailed('Failed to write metadata.json')
      this.handleTaskFinished(task)
      return
    }

    // Tag audio files
    for (const af of task.data.audioFiles) {
      SocketAuthority.adminEmitter('audiofile_metadata_started', {
        libraryItemId: task.data.libraryItemId,
        ino: af.ino
      })

      // Backup audio file
      if (task.data.options.backupFiles) {
        try {
          const backupFilePath = Path.join(task.data.itemCachePath, af.filename)
          await fs.copy(af.path, backupFilePath)
          Logger.debug(`[AudioMetadataManager] Backed up audio file at "${backupFilePath}"`)
        } catch (err) {
          Logger.error(`[AudioMetadataManager] Failed to backup audio file "${af.path}"`, err)
        }
      }

      const _toneMetadataObject = {
        'ToneJsonFile': toneJsonPath,
        'TrackNumber': af.index,
      }

      if (task.data.coverPath) {
        _toneMetadataObject['CoverFile'] = task.data.coverPath
      }

      const success = await toneHelpers.tagAudioFile(af.path, _toneMetadataObject)
      if (success) {
        Logger.info(`[AudioMetadataManager] Successfully tagged audio file "${af.path}"`)
      }

      SocketAuthority.adminEmitter('audiofile_metadata_finished', {
        libraryItemId: task.data.libraryItemId,
        ino: af.ino
      })
    }

    // Remove temp cache file/folder if not backing up
    if (!task.data.options.backupFiles) {
      // If cache dir was created from this then remove it
      if (cacheDirCreated) {
        await fs.remove(task.data.itemCachePath)
      } else {
        await fs.remove(toneJsonPath)
      }
    }

    task.setFinished()
    this.handleTaskFinished(task)
  }

  handleTaskFinished(task) {
    this.taskManager.taskFinished(task)
    this.tasksRunning = this.tasksRunning.filter(t => t.id !== task.id)

    if (this.tasksRunning.length < this.MAX_CONCURRENT_TASKS && this.tasksQueued.length) {
      Logger.info(`[AudioMetadataManager] Task finished and dequeueing next task. ${this.tasksQueued} tasks queued.`)
      const nextTask = this.tasksQueued.shift()
      SocketAuthority.emitter('metadata_embed_queue_update', {
        libraryItemId: nextTask.data.libraryItemId,
        queued: false
      })
      this.runMetadataEmbed(nextTask)
    } else if (this.tasksRunning.length > 0) {
      Logger.debug(`[AudioMetadataManager] Task finished but not dequeueing. Currently running ${this.tasksRunning.length} tasks. ${this.tasksQueued.length} tasks queued.`)
    } else {
      Logger.debug(`[AudioMetadataManager] Task finished and no tasks remain in queue`)
    }
  }
}
module.exports = AudioMetadataMangaer
