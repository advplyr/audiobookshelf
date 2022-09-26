
const Path = require('path')
const fs = require('../libs/fsExtra')

const workerThreads = require('worker_threads')
const Logger = require('../Logger')
const AbManagerTask = require('../objects/AbManagerTask')
const filePerms = require('../utils/filePerms')
const { getId } = require('../utils/index')
const { writeConcatFile } = require('../utils/ffmpegHelpers')
const toneHelpers = require('../utils/toneHelpers')
const { getFileSize } = require('../utils/fileUtils')

class AbMergeManager {
  constructor(db, clientEmitter) {
    this.db = db
    this.clientEmitter = clientEmitter

    this.downloadDirPath = Path.join(global.MetadataPath, 'downloads')
    this.downloadDirPathExist = false

    this.pendingTasks = []
    this.tasks = []
  }

  async ensureDownloadDirPath() { // Creates download path if necessary and sets owner and permissions
    if (this.downloadDirPathExist) return

    var pathCreated = false
    if (!(await fs.pathExists(this.downloadDirPath))) {
      await fs.mkdir(this.downloadDirPath)
      pathCreated = true
    }

    if (pathCreated) {
      await filePerms.setDefault(this.downloadDirPath)
    }

    this.downloadDirPathExist = true
  }

  getTask(taskId) {
    return this.tasks.find(d => d.id === taskId)
  }

  removeTaskById(taskId) {
    var task = this.getTask(taskId)
    if (task) {
      this.removeTask(task)
    }
  }

  async removeOrphanDownloads() {
    try {
      var dirs = await fs.readdir(this.downloadDirPath)
      if (!dirs || !dirs.length) return true

      dirs = dirs.filter(d => d.startsWith('abmerge'))

      await Promise.all(dirs.map(async (dirname) => {
        var fullPath = Path.join(this.downloadDirPath, dirname)
        Logger.info(`Removing Orphan Download ${dirname}`)
        return fs.remove(fullPath)
      }))
      return true
    } catch (error) {
      return false
    }
  }

  async startAudiobookMerge(user, libraryItem) {
    var taskId = getId('abmerge')
    var dlpath = Path.join(this.downloadDirPath, taskId)
    Logger.info(`Start audiobook merge for ${libraryItem.id} - TaskId: ${taskId} - ${dlpath}`)

    var audiobookDirname = Path.basename(libraryItem.path)
    var filename = audiobookDirname + '.m4b'
    var taskData = {
      id: taskId,
      libraryItemId: libraryItem.id,
      type: 'abmerge',
      dirpath: dlpath,
      path: Path.join(dlpath, filename),
      filename,
      ext: '.m4b',
      userId: user.id,
      libraryItemPath: libraryItem.path,
      originalTrackPaths: libraryItem.media.tracks.map(t => t.metadata.path)
    }
    var abManagerTask = new AbManagerTask()
    abManagerTask.setData(taskData)
    abManagerTask.setTimeoutTimer(this.downloadTimedOut.bind(this))

    try {
      await fs.mkdir(abManagerTask.dirpath)
    } catch (error) {
      Logger.error(`[AbMergeManager] Failed to make directory ${abManagerTask.dirpath}`)
      Logger.debug(`[AbMergeManager] Make directory error: ${error}`)
      var taskJson = abManagerTask.toJSON()
      this.clientEmitter(user.id, 'abmerge_failed', taskJson)
      return
    }

    this.clientEmitter(user.id, 'abmerge_started', abManagerTask.toJSON())
    this.runAudiobookMerge(libraryItem, abManagerTask)
  }

  async runAudiobookMerge(libraryItem, abManagerTask) {
    // If changing audio file type then encoding is needed
    var audioTracks = libraryItem.media.tracks
    var audioRequiresEncode = audioTracks[0].metadata.ext !== abManagerTask.ext
    var shouldIncludeCover = libraryItem.media.coverPath
    var firstTrackIsM4b = audioTracks[0].metadata.ext.toLowerCase() === '.m4b'
    var isOneTrack = audioTracks.length === 1

    const ffmpegInputs = []

    if (!isOneTrack) {
      var concatFilePath = Path.join(abManagerTask.dirpath, 'files.txt')
      console.log('Write files.txt', concatFilePath)
      await writeConcatFile(audioTracks, concatFilePath)
      ffmpegInputs.push({
        input: concatFilePath,
        options: ['-safe 0', '-f concat']
      })
    } else {
      ffmpegInputs.push({
        input: audioTracks[0].metadata.path,
        options: firstTrackIsM4b ? ['-f mp4'] : []
      })
    }

    const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'warning'
    var ffmpegOptions = [`-loglevel ${logLevel}`]
    var ffmpegOutputOptions = []

    if (audioRequiresEncode) {
      ffmpegOptions = ffmpegOptions.concat([
        '-map 0:a',
        '-acodec aac',
        '-ac 2',
        '-b:a 64k'
        // '-movflags use_metadata_tags'
      ])
    } else {
      ffmpegOptions.push('-max_muxing_queue_size 1000')

      if (isOneTrack && firstTrackIsM4b && !shouldIncludeCover) {
        ffmpegOptions.push('-c copy')
      } else {
        ffmpegOptions.push('-c:a copy')
      }
    }
    if (abManagerTask.ext === '.m4b') {
      ffmpegOutputOptions.push('-f mp4')
    }


    var chaptersFilePath = null
    if (libraryItem.media.chapters.length) {
      chaptersFilePath = Path.join(abManagerTask.dirpath, 'chapters.txt')
      try {
        await toneHelpers.writeToneChaptersFile(libraryItem.media.chapters, chaptersFilePath)
      } catch (error) {
        Logger.error(`[AbMergeManager] Write chapters.txt failed`, error)
        chaptersFilePath = null
      }
    }

    const toneMetadataObject = toneHelpers.getToneMetadataObject(libraryItem, chaptersFilePath)
    toneMetadataObject.TrackNumber = 1
    abManagerTask.toneMetadataObject = toneMetadataObject

    Logger.debug(`[AbMergeManager] Book "${libraryItem.media.metadata.title}" tone metadata object=`, toneMetadataObject)

    var workerData = {
      inputs: ffmpegInputs,
      options: ffmpegOptions,
      outputOptions: ffmpegOutputOptions,
      output: abManagerTask.path,
    }

    var worker = null
    try {
      var workerPath = Path.join(global.appRoot, 'server/utils/downloadWorker.js')
      worker = new workerThreads.Worker(workerPath, { workerData })
    } catch (error) {
      Logger.error(`[AbMergeManager] Start worker thread failed`, error)
      if (abManagerTask.userId) {
        var taskJson = abManagerTask.toJSON()
        this.clientEmitter(abManagerTask.userId, 'abmerge_failed', taskJson)
      }
      this.removeTask(abManagerTask)
      return
    }

    worker.on('message', (message) => {
      if (message != null && typeof message === 'object') {
        if (message.type === 'RESULT') {
          if (!abManagerTask.isTimedOut) {
            this.sendResult(abManagerTask, message)
          }
        } else if (message.type === 'FFMPEG') {
          if (Logger[message.level]) {
            Logger[message.level](message.log)
          }
        }
      } else {
        Logger.error('Invalid worker message', message)
      }
    })
    this.pendingTasks.push({
      id: abManagerTask.id,
      abManagerTask,
      worker
    })
  }

  async sendResult(abManagerTask, result) {
    abManagerTask.clearTimeoutTimer()

    // Remove pending task
    this.pendingTasks = this.pendingTasks.filter(d => d.id !== abManagerTask.id)

    if (result.isKilled) {
      if (abManagerTask.userId) {
        this.clientEmitter(abManagerTask.userId, 'abmerge_killed', abManagerTask.toJSON())
      }
      return
    }

    if (!result.success) {
      if (abManagerTask.userId) {
        this.clientEmitter(abManagerTask.userId, 'abmerge_failed', abManagerTask.toJSON())
      }
      this.removeTask(abManagerTask)
      return
    }

    // Write metadata to merged file
    const success = await toneHelpers.tagAudioFile(abManagerTask.path, abManagerTask.toneMetadataObject)
    if (!success) {
      Logger.error(`[AbMergeManager] Failed to write metadata to file "${abManagerTask.path}"`)
      if (abManagerTask.userId) {
        this.clientEmitter(abManagerTask.userId, 'abmerge_failed', abManagerTask.toJSON())
      }
      this.removeTask(abManagerTask)
      return
    }

    // Move library item tracks to cache
    const itemCacheDir = Path.join(global.MetadataPath, `cache/items/${abManagerTask.libraryItemId}`)
    await fs.ensureDir(itemCacheDir)
    for (const trackPath of abManagerTask.originalTrackPaths) {
      const trackFilename = Path.basename(trackPath)
      const moveToPath = Path.join(itemCacheDir, trackFilename)
      Logger.debug(`[AbMergeManager] Backing up original track "${trackPath}" to ${moveToPath}`)
      await fs.move(trackPath, moveToPath, { overwrite: true }).catch((err) => {
        Logger.error(`[AbMergeManager] Failed to move track "${trackPath}" to "${moveToPath}"`, err)
      })
    }

    // Set file permissions and ownership
    await filePerms.setDefault(abManagerTask.path)
    await filePerms.setDefault(itemCacheDir)

    // Move merged file to library item
    const moveToPath = Path.join(abManagerTask.libraryItemPath, abManagerTask.filename)
    Logger.debug(`[AbMergeManager] Moving merged audiobook to library item at "${moveToPath}"`)
    const moveSuccess = await fs.move(abManagerTask.path, moveToPath, { overwrite: true }).then(() => true).catch((err) => {
      Logger.error(`[AbMergeManager] Failed to move merged audiobook from "${abManagerTask.path}" to "${moveToPath}"`, err)
      return false
    })
    if (!moveSuccess) {
      // TODO: Revert cached og files?
    }

    var filesize = await getFileSize(abManagerTask.path)
    abManagerTask.setComplete(filesize)
    if (abManagerTask.userId) {
      this.clientEmitter(abManagerTask.userId, 'abmerge_ready', abManagerTask.toJSON())
    }
    // abManagerTask.setExpirationTimer(this.downloadExpired.bind(this))

    // this.tasks.push(abManagerTask)
    await this.removeTask(abManagerTask)
    Logger.info(`[AbMergeManager] Ab task finished ${abManagerTask.id}`)
  }

  // async downloadExpired(abManagerTask) {
  //   Logger.info(`[AbMergeManager] Download ${abManagerTask.id} expired`)

  //   if (abManagerTask.userId) {
  //     this.clientEmitter(abManagerTask.userId, 'abmerge_expired', abManagerTask.toJSON())
  //   }
  //   this.removeTask(abManagerTask)
  // }

  async downloadTimedOut(abManagerTask) {
    Logger.info(`[AbMergeManager] Download ${abManagerTask.id} timed out (${abManagerTask.timeoutTimeMs}ms)`)

    if (abManagerTask.userId) {
      var taskJson = abManagerTask.toJSON()
      taskJson.isTimedOut = true
      this.clientEmitter(abManagerTask.userId, 'abmerge_failed', taskJson)
    }
    this.removeTask(abManagerTask)
  }

  async removeTask(abManagerTask) {
    Logger.info('[AbMergeManager] Removing task ' + abManagerTask.id)

    abManagerTask.clearTimeoutTimer()
    // abManagerTask.clearExpirationTimer()

    var pendingDl = this.pendingTasks.find(d => d.id === abManagerTask.id)

    if (pendingDl) {
      this.pendingTasks = this.pendingTasks.filter(d => d.id !== abManagerTask.id)
      Logger.warn(`[AbMergeManager] Removing download in progress - stopping worker`)
      if (pendingDl.worker) {
        try {
          pendingDl.worker.postMessage('STOP')
        } catch (error) {
          Logger.error('[AbMergeManager] Error posting stop message to worker', error)
        }
      }
    }

    await fs.remove(abManagerTask.dirpath).then(() => {
      Logger.info('[AbMergeManager] Deleted download', abManagerTask.dirpath)
    }).catch((err) => {
      Logger.error('[AbMergeManager] Failed to delete download', err)
    })
    this.tasks = this.tasks.filter(d => d.id !== abManagerTask.id)
  }
}
module.exports = AbMergeManager
