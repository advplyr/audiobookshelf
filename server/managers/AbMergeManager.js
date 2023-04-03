
const Path = require('path')
const fs = require('../libs/fsExtra')

const workerThreads = require('worker_threads')
const Logger = require('../Logger')
const Task = require('../objects/Task')
const filePerms = require('../utils/filePerms')
const { writeConcatFile } = require('../utils/ffmpegHelpers')
const toneHelpers = require('../utils/toneHelpers')

class AbMergeManager {
  constructor(db, taskManager) {
    this.db = db
    this.taskManager = taskManager

    this.itemsCacheDir = Path.join(global.MetadataPath, 'cache/items')

    this.pendingTasks = []
  }

  getPendingTaskByLibraryItemId(libraryItemId) {
    return this.pendingTasks.find(t => t.task.data.libraryItemId === libraryItemId)
  }

  cancelEncode(task) {
    return this.removeTask(task, true)
  }

  async startAudiobookMerge(user, libraryItem, options = {}) {
    const task = new Task()

    const audiobookDirname = Path.basename(libraryItem.path)
    const targetFilename = audiobookDirname + '.m4b'
    const itemCachePath = Path.join(this.itemsCacheDir, libraryItem.id)
    const tempFilepath = Path.join(itemCachePath, targetFilename)
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryItemPath: libraryItem.path,
      userId: user.id,
      originalTrackPaths: libraryItem.media.tracks.map(t => t.metadata.path),
      tempFilepath,
      targetFilename,
      targetFilepath: Path.join(libraryItem.path, targetFilename),
      itemCachePath,
      toneJsonObject: null
    }
    const taskDescription = `Encoding audiobook "${libraryItem.media.metadata.title}" into a single m4b file.`
    task.setData('encode-m4b', 'Encoding M4b', taskDescription, taskData)
    this.taskManager.addTask(task)
    Logger.info(`Start m4b encode for ${libraryItem.id} - TaskId: ${task.id}`)

    if (!await fs.pathExists(taskData.itemCachePath)) {
      await fs.mkdir(taskData.itemCachePath)
    }

    this.runAudiobookMerge(libraryItem, task, options || {})
  }

  async runAudiobookMerge(libraryItem, task, encodingOptions) {
    const audioBitrate = encodingOptions.bitrate || '64k'
    const audioCodec = encodingOptions.codec || 'aac'
    const audioChannels = encodingOptions.channels || 2

    // If changing audio file type then encoding is needed
    const audioTracks = libraryItem.media.tracks

    // TODO: Updated in 2.2.11 to always encode even if merging multiple m4b. This is because just using the file extension as was being done before is not enough. This can be an option or do more to check if a concat is possible.
    // const audioRequiresEncode = audioTracks[0].metadata.ext !== '.m4b'
    const audioRequiresEncode = true

    const firstTrackIsM4b = audioTracks[0].metadata.ext.toLowerCase() === '.m4b'
    const isOneTrack = audioTracks.length === 1

    const ffmpegInputs = []

    if (!isOneTrack) {
      const concatFilePath = Path.join(task.data.itemCachePath, 'files.txt')
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
    let ffmpegOptions = [`-loglevel ${logLevel}`]
    const ffmpegOutputOptions = ['-f mp4']

    if (audioRequiresEncode) {
      ffmpegOptions = ffmpegOptions.concat([
        '-map 0:a',
        `-acodec ${audioCodec}`,
        `-ac ${audioChannels}`,
        `-b:a ${audioBitrate}`
      ])
    } else {
      ffmpegOptions.push('-max_muxing_queue_size 1000')

      if (isOneTrack && firstTrackIsM4b) {
        ffmpegOptions.push('-c copy')
      } else {
        ffmpegOptions.push('-c:a copy')
      }
    }

    let toneJsonPath = null
    try {
      toneJsonPath = Path.join(task.data.itemCachePath, 'metadata.json')
      await toneHelpers.writeToneMetadataJsonFile(libraryItem, libraryItem.media.chapters, toneJsonPath, 1)
    } catch (error) {
      Logger.error(`[AbMergeManager] Write metadata.json failed`, error)
      toneJsonPath = null
    }

    task.data.toneJsonObject = {
      'ToneJsonFile': toneJsonPath,
      'TrackNumber': 1,
    }

    if (libraryItem.media.coverPath) {
      task.data.toneJsonObject['CoverFile'] = libraryItem.media.coverPath
    }

    const workerData = {
      inputs: ffmpegInputs,
      options: ffmpegOptions,
      outputOptions: ffmpegOutputOptions,
      output: task.data.tempFilepath
    }

    let worker = null
    try {
      const workerPath = Path.join(global.appRoot, 'server/utils/downloadWorker.js')
      worker = new workerThreads.Worker(workerPath, { workerData })
    } catch (error) {
      Logger.error(`[AbMergeManager] Start worker thread failed`, error)
      task.setFailed('Failed to start worker thread')
      this.removeTask(task, true)
      return
    }

    worker.on('message', (message) => {
      if (message != null && typeof message === 'object') {
        if (message.type === 'RESULT') {
          this.sendResult(task, message)
        } else if (message.type === 'FFMPEG') {
          if (Logger[message.level]) {
            Logger[message.level](message.log)
          }
        }
      }
    })
    this.pendingTasks.push({
      id: task.id,
      task,
      worker
    })
  }

  async sendResult(task, result) {
    // Remove pending task
    this.pendingTasks = this.pendingTasks.filter(d => d.id !== task.id)

    if (result.isKilled) {
      task.setFailed('Ffmpeg task killed')
      this.removeTask(task, true)
      return
    }

    if (!result.success) {
      task.setFailed('Encoding failed')
      this.removeTask(task, true)
      return
    }

    // Write metadata to merged file
    const success = await toneHelpers.tagAudioFile(task.data.tempFilepath, task.data.toneJsonObject)
    if (!success) {
      Logger.error(`[AbMergeManager] Failed to write metadata to file "${task.data.tempFilepath}"`)
      task.setFailed('Failed to write metadata to m4b file')
      this.removeTask(task, true)
      return
    }

    // Move library item tracks to cache
    for (const trackPath of task.data.originalTrackPaths) {
      const trackFilename = Path.basename(trackPath)
      const moveToPath = Path.join(task.data.itemCachePath, trackFilename)
      Logger.debug(`[AbMergeManager] Backing up original track "${trackPath}" to ${moveToPath}`)
      await fs.move(trackPath, moveToPath, { overwrite: true }).catch((err) => {
        Logger.error(`[AbMergeManager] Failed to move track "${trackPath}" to "${moveToPath}"`, err)
      })
    }

    // Move m4b to target
    Logger.debug(`[AbMergeManager] Moving m4b from ${task.data.tempFilepath} to ${task.data.targetFilepath}`)
    await fs.move(task.data.tempFilepath, task.data.targetFilepath)

    // Set file permissions and ownership
    await filePerms.setDefault(task.data.targetFilepath)
    await filePerms.setDefault(task.data.itemCachePath)

    task.setFinished()
    await this.removeTask(task, false)
    Logger.info(`[AbMergeManager] Ab task finished ${task.id}`)
  }

  async removeTask(task, removeTempFilepath = false) {
    Logger.info('[AbMergeManager] Removing task ' + task.id)

    const pendingDl = this.pendingTasks.find(d => d.id === task.id)
    if (pendingDl) {
      this.pendingTasks = this.pendingTasks.filter(d => d.id !== task.id)
      if (pendingDl.worker) {
        Logger.warn(`[AbMergeManager] Removing download in progress - stopping worker`)
        try {
          pendingDl.worker.postMessage('STOP')
          return
        } catch (error) {
          Logger.error('[AbMergeManager] Error posting stop message to worker', error)
        }
      } else {
        Logger.debug(`[AbMergeManager] Removing download in progress - no worker`)
      }
    }

    if (removeTempFilepath) { // On failed tasks remove the bad file if it exists
      if (await fs.pathExists(task.data.tempFilepath)) {
        await fs.remove(task.data.tempFilepath).then(() => {
          Logger.info('[AbMergeManager] Deleted target file', task.data.tempFilepath)
        }).catch((err) => {
          Logger.error('[AbMergeManager] Failed to delete target file', err)
        })
      }
    }

    this.taskManager.taskFinished(task)
  }
}
module.exports = AbMergeManager
