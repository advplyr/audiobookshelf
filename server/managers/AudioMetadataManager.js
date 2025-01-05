const Path = require('path')
const SocketAuthority = require('../SocketAuthority')
const Logger = require('../Logger')
const fs = require('../libs/fsExtra')
const ffmpegHelpers = require('../utils/ffmpegHelpers')
const TaskManager = require('./TaskManager')
const Task = require('../objects/Task')
const fileUtils = require('../utils/fileUtils')

/**
 * @typedef UpdateMetadataOptions
 * @property {boolean} [forceEmbedChapters=false] - Whether to force embed chapters.
 * @property {boolean} [backup=false] - Whether to backup the files.
 */

class AudioMetadataMangaer {
  constructor() {
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
    return this.tasksQueued.map((t) => t.data)
  }

  getIsLibraryItemQueuedOrProcessing(libraryItemId) {
    return this.tasksQueued.some((t) => t.data.libraryItemId === libraryItemId) || this.tasksRunning.some((t) => t.data.libraryItemId === libraryItemId)
  }

  /**
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @returns
   */
  getMetadataObjectForApi(libraryItem) {
    return ffmpegHelpers.getFFMetadataObject(libraryItem, libraryItem.media.includedAudioFiles.length)
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/LibraryItem')[]} libraryItems
   * @param {UpdateMetadataOptions} options
   */
  handleBatchEmbed(userId, libraryItems, options = {}) {
    libraryItems.forEach((li) => {
      this.updateMetadataForItem(userId, li, options)
    })
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {UpdateMetadataOptions} [options={}]
   */
  async updateMetadataForItem(userId, libraryItem, options = {}) {
    const forceEmbedChapters = !!options.forceEmbedChapters
    const backupFiles = !!options.backup

    const audioFiles = libraryItem.media.includedAudioFiles

    const task = new Task()

    const itemCachePath = Path.join(this.itemsCacheDir, libraryItem.id)

    // Only writing chapters for single file audiobooks
    const chapters = audioFiles.length == 1 || forceEmbedChapters ? libraryItem.media.chapters.map((c) => ({ ...c })) : null

    let mimeType = audioFiles[0].mimeType
    if (audioFiles.some((a) => a.mimeType !== mimeType)) mimeType = null

    // Create task
    const libraryItemDir = libraryItem.isFile ? Path.dirname(libraryItem.path) : libraryItem.path
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryItemDir,
      userId,
      audioFiles: audioFiles.map((af) => ({
        index: af.index,
        ino: af.ino,
        filename: af.metadata.filename,
        path: af.metadata.path,
        cachePath: Path.join(itemCachePath, af.metadata.filename),
        duration: af.duration
      })),
      coverPath: libraryItem.media.coverPath,
      metadataObject: ffmpegHelpers.getFFMetadataObject(libraryItem, audioFiles.length),
      itemCachePath,
      chapters,
      mimeType,
      options: {
        forceEmbedChapters,
        backupFiles
      },
      duration: libraryItem.media.duration
    }

    const taskTitleString = {
      text: 'Embedding Metadata',
      key: 'MessageTaskEmbeddingMetadata'
    }
    const taskDescriptionString = {
      text: `Embedding metadata in audiobook "${libraryItem.media.title}".`,
      key: 'MessageTaskEmbeddingMetadataDescription',
      subs: [libraryItem.media.title]
    }
    task.setData('embed-metadata', taskTitleString, taskDescriptionString, false, taskData)

    if (this.tasksRunning.length >= this.MAX_CONCURRENT_TASKS) {
      Logger.info(`[AudioMetadataManager] Queueing embed metadata for audiobook "${libraryItem.media.title}"`)
      SocketAuthority.adminEmitter('metadata_embed_queue_update', {
        libraryItemId: libraryItem.id,
        queued: true
      })
      this.tasksQueued.push(task)
    } else {
      this.runMetadataEmbed(task)
    }
  }

  /**
   *
   * @param {import('../objects/Task')} task
   */
  async runMetadataEmbed(task) {
    this.tasksRunning.push(task)
    TaskManager.addTask(task)

    Logger.info(`[AudioMetadataManager] Starting metadata embed task`, task.description)

    // Ensure target directory is writable
    const targetDirWritable = await fileUtils.isWritable(task.data.libraryItemDir)
    Logger.debug(`[AudioMetadataManager] Target directory ${task.data.libraryItemDir} writable: ${targetDirWritable}`)
    if (!targetDirWritable) {
      Logger.error(`[AudioMetadataManager] Target directory is not writable: ${task.data.libraryItemDir}`)
      const taskFailedString = {
        text: 'Target directory is not writable',
        key: 'MessageTaskTargetDirectoryNotWritable'
      }
      task.setFailed(taskFailedString)
      this.handleTaskFinished(task)
      return
    }

    // Ensure target audio files are writable
    for (const af of task.data.audioFiles) {
      try {
        await fs.access(af.path, fs.constants.W_OK)
      } catch (err) {
        Logger.error(`[AudioMetadataManager] Audio file is not writable: ${af.path}`)
        const taskFailedString = {
          text: `Audio file "${Path.basename(af.path)}" is not writable`,
          key: 'MessageTaskAudioFileNotWritable',
          subs: [Path.basename(af.path)]
        }
        task.setFailed(taskFailedString)
        this.handleTaskFinished(task)
        return
      }
    }

    // Ensure item cache dir exists
    let cacheDirCreated = false
    if (!(await fs.pathExists(task.data.itemCachePath))) {
      try {
        await fs.mkdir(task.data.itemCachePath)
        cacheDirCreated = true
      } catch (err) {
        Logger.error(`[AudioMetadataManager] Failed to create cache directory ${task.data.itemCachePath}`, err)
        const taskFailedString = {
          text: 'Failed to create cache directory',
          key: 'MessageTaskFailedToCreateCacheDirectory'
        }
        task.setFailed(taskFailedString)
        this.handleTaskFinished(task)
        return
      }
    }

    // Create ffmetadata file
    const ffmetadataPath = Path.join(task.data.itemCachePath, 'ffmetadata.txt')
    const success = await ffmpegHelpers.writeFFMetadataFile(task.data.metadataObject, task.data.chapters, ffmetadataPath)
    if (!success) {
      Logger.error(`[AudioMetadataManager] Failed to write ffmetadata file for audiobook "${task.data.libraryItemId}"`)
      const taskFailedString = {
        text: 'Failed to write metadata file',
        key: 'MessageTaskFailedToWriteMetadataFile'
      }
      task.setFailed(taskFailedString)
      this.handleTaskFinished(task)
      return
    }

    // Tag audio files
    let cummulativeProgress = 0
    for (const af of task.data.audioFiles) {
      const audioFileRelativeDuration = af.duration / task.data.duration
      SocketAuthority.adminEmitter('track_started', {
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
          const taskFailedString = {
            text: `Failed to backup audio file "${Path.basename(af.path)}"`,
            key: 'MessageTaskFailedToBackupAudioFile',
            subs: [Path.basename(af.path)]
          }
          task.setFailed(taskFailedString)
          this.handleTaskFinished(task)
          return
        }
      }

      try {
        await ffmpegHelpers.addCoverAndMetadataToFile(af.path, task.data.coverPath, ffmetadataPath, af.index, task.data.mimeType, (progress) => {
          SocketAuthority.adminEmitter('task_progress', { libraryItemId: task.data.libraryItemId, progress: cummulativeProgress + progress * audioFileRelativeDuration })
          SocketAuthority.adminEmitter('track_progress', { libraryItemId: task.data.libraryItemId, ino: af.ino, progress })
        })
        Logger.info(`[AudioMetadataManager] Successfully tagged audio file "${af.path}"`)
      } catch (err) {
        Logger.error(`[AudioMetadataManager] Failed to tag audio file "${af.path}"`, err)
        const taskFailedString = {
          text: `Failed to embed metadata in file "${Path.basename(af.path)}"`,
          key: 'MessageTaskFailedToEmbedMetadataInFile',
          subs: [Path.basename(af.path)]
        }
        task.setFailed(taskFailedString)
        this.handleTaskFinished(task)
        return
      }

      SocketAuthority.adminEmitter('track_finished', {
        libraryItemId: task.data.libraryItemId,
        ino: af.ino
      })

      cummulativeProgress += audioFileRelativeDuration * 100
    }

    // Remove temp cache file/folder if not backing up
    if (!task.data.options.backupFiles) {
      // If cache dir was created from this then remove it
      if (cacheDirCreated) {
        await fs.remove(task.data.itemCachePath)
      } else {
        await fs.remove(ffmetadataPath)
      }
    }

    task.setFinished()
    this.handleTaskFinished(task)
  }

  handleTaskFinished(task) {
    TaskManager.taskFinished(task)
    this.tasksRunning = this.tasksRunning.filter((t) => t.id !== task.id)

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
