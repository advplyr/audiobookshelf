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
    if (libraryItem.isPodcast) {
      return {
        title: libraryItem.media.title,
        artist: libraryItem.media.author,
        album_artist: libraryItem.media.author,
        album: libraryItem.media.title,
        genre: libraryItem.media.genres?.join('; '),
        description: libraryItem.media.description,
        language: libraryItem.media.language
      }
    }
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

    const audioFiles = libraryItem.isPodcast
      ? libraryItem.media.podcastEpisodes
          .filter((ep) => !!ep.audioFile && !!ep.audioFile.metadata?.path)
          .map((ep) => ({
            episode: ep,
            index: 1,
            ino: ep.audioFile?.ino,
            filename: ep.audioFile?.metadata?.filename,
            path: ep.audioFile?.metadata?.path,
            duration: ep.duration,
            mimeType: ep.audioFile?.mimeType
          }))
      : libraryItem.media.includedAudioFiles

    if (!audioFiles.length) {
      return
    }

    const task = new Task()

    const itemCachePath = Path.join(this.itemsCacheDir, libraryItem.id)

    // Only writing chapters for single file audiobooks
    const chapters = libraryItem.isPodcast ? null : audioFiles.length == 1 || forceEmbedChapters ? libraryItem.media.chapters.map((c) => ({ ...c })) : null

    let mimeType = libraryItem.isPodcast ? audioFiles[0]?.mimeType || null : audioFiles[0].mimeType
    if (audioFiles.some((a) => (libraryItem.isPodcast ? a.mimeType : a.mimeType) !== mimeType)) mimeType = null

    // Create task
    const libraryItemDir = libraryItem.isFile ? Path.dirname(libraryItem.path) : libraryItem.path
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryItemDir,
      userId,
      audioFiles: libraryItem.isPodcast
        ? audioFiles.map((af) => ({
            index: 1,
            ino: af.ino,
            filename: af.filename,
            path: af.path,
            cachePath: Path.join(itemCachePath, af.filename || 'episode'),
            duration: af.duration,
            episodeId: af.episode?.id,
            mimeType: af.mimeType
          }))
        : audioFiles.map((af) => ({
            index: af.index,
            ino: af.ino,
            filename: af.metadata.filename,
            path: af.metadata.path,
            cachePath: Path.join(itemCachePath, af.metadata.filename),
            duration: af.duration
          })),
      coverPath: libraryItem.media.coverPath,
      metadataObject: libraryItem.isPodcast ? null : ffmpegHelpers.getFFMetadataObject(libraryItem, audioFiles.length),
      podcast: libraryItem.isPodcast
        ? {
            title: libraryItem.media.title,
            author: libraryItem.media.author,
            genres: Array.isArray(libraryItem.media.genres) ? [...libraryItem.media.genres] : [],
            language: libraryItem.media.language,
            itunesId: libraryItem.media.itunesId,
            podcastType: libraryItem.media.podcastType,
            releaseDate: libraryItem.media.releaseDate
          }
        : null,
      podcastEpisodes: libraryItem.isPodcast
        ? libraryItem.media.podcastEpisodes.map((ep) => ({
            id: ep.id,
            title: ep.title,
            description: ep.description,
            subtitle: ep.subtitle,
            season: ep.season,
            episode: ep.episode,
            episodeType: ep.episodeType,
            pubDate: ep.pubDate,
            chapters: Array.isArray(ep.chapters) ? ep.chapters.map((c) => ({ ...c })) : []
          }))
        : null,
      itemCachePath,
      chapters,
      mimeType,
      options: {
        forceEmbedChapters,
        backupFiles
      },
      duration: libraryItem.isPodcast ? audioFiles.reduce((acc, af) => acc + (af.duration || 0), 0) || 0 : libraryItem.media.duration
    }

    const taskTitleString = {
      text: 'Embedding Metadata',
      key: 'MessageTaskEmbeddingMetadata'
    }
    const taskDescriptionString = libraryItem.isPodcast
      ? {
          text: `Embedding metadata in podcast "${libraryItem.media.title}" episodes.`,
          key: 'MessageTaskEmbeddingMetadataDescription',
          subs: [libraryItem.media.title]
        }
      : {
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

    let ffmetadataPath = Path.join(task.data.itemCachePath, 'ffmetadata.txt')
    // Pre-write single ffmetadata file for non-podcast items
    if (task.data.metadataObject) {
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
    }

    const createdFFMetadataFiles = []

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
        // For podcasts, write per-episode ffmetadata file and chapters
        let perFileMetaPath = ffmetadataPath
        if (!task.data.metadataObject) {
          // Podcast flow: metadataObject is null; generate per-episode metadata
          const episode = (task.data.podcastEpisodes || []).find((ep) => ep.id === af.episodeId)
          const liStub = { media: task.data.podcast }
          const perEpisodeMeta = ffmpegHelpers.getPodcastEpisodeFFMetadataObject(liStub, episode)
          perFileMetaPath = Path.join(task.data.itemCachePath, `${af.filename || 'episode'}.ffmetadata.txt`)
          const episodeChapters = Array.isArray(episode?.chapters) && episode.chapters.length ? episode.chapters.map((c) => ({ ...c })) : null
          const wrote = await ffmpegHelpers.writeFFMetadataFile(perEpisodeMeta, episodeChapters, perFileMetaPath)
          if (!wrote) {
            throw new Error('Failed to write episode ffmetadata file')
          }
          createdFFMetadataFiles.push(perFileMetaPath)
        }

        await ffmpegHelpers.addCoverAndMetadataToFile(af.path, task.data.coverPath, perFileMetaPath, af.index, af.mimeType || task.data.mimeType, (progress) => {
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
        if (createdFFMetadataFiles.length) {
          for (const metaPath of createdFFMetadataFiles) {
            await fs.remove(metaPath)
          }
        } else {
          await fs.remove(ffmetadataPath)
        }
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
