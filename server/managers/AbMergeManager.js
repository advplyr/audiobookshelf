const Path = require('path')
const fs = require('../libs/fsExtra')
const Logger = require('../Logger')
const TaskManager = require('./TaskManager')
const Task = require('../objects/Task')
const { writeConcatFile } = require('../utils/ffmpegHelpers')
const ffmpegHelpers = require('../utils/ffmpegHelpers')
const Ffmpeg = require('../libs/fluentFfmpeg')
const SocketAuthority = require('../SocketAuthority')
const fileUtils = require('../utils/fileUtils')
const TrackProgressMonitor = require('../objects/TrackProgressMonitor')

class AbMergeManager {
  constructor() {
    this.itemsCacheDir = Path.join(global.MetadataPath, 'cache/items')

    this.pendingTasks = []
  }

  getPendingTaskByLibraryItemId(libraryItemId) {
    return this.pendingTasks.find((t) => t.task.data.libraryItemId === libraryItemId)
  }

  cancelEncode(task) {
    task.setFailed('Task canceled by user')
    return this.removeTask(task, true)
  }

  async startAudiobookMerge(user, libraryItem, options = {}) {
    const task = new Task()

    const audiobookDirname = Path.basename(libraryItem.path)
    const targetFilename = audiobookDirname + '.m4b'
    const itemCachePath = Path.join(this.itemsCacheDir, libraryItem.id)
    const tempFilepath = Path.join(itemCachePath, targetFilename)
    const ffmetadataPath = Path.join(itemCachePath, 'ffmetadata.txt')
    const taskData = {
      libraryItemId: libraryItem.id,
      libraryItemPath: libraryItem.path,
      userId: user.id,
      originalTrackPaths: libraryItem.media.tracks.map((t) => t.metadata.path),
      inos: libraryItem.media.includedAudioFiles.map((f) => f.ino),
      tempFilepath,
      targetFilename,
      targetFilepath: Path.join(libraryItem.path, targetFilename),
      itemCachePath,
      ffmetadataObject: ffmpegHelpers.getFFMetadataObject(libraryItem, 1),
      chapters: libraryItem.media.chapters?.map((c) => ({ ...c })),
      coverPath: libraryItem.media.coverPath,
      ffmetadataPath,
      duration: libraryItem.media.duration
    }
    const taskDescription = `Encoding audiobook "${libraryItem.media.metadata.title}" into a single m4b file.`
    task.setData('encode-m4b', 'Encoding M4b', taskDescription, false, taskData)
    TaskManager.addTask(task)
    Logger.info(`Start m4b encode for ${libraryItem.id} - TaskId: ${task.id}`)

    if (!(await fs.pathExists(taskData.itemCachePath))) {
      await fs.mkdir(taskData.itemCachePath)
    }

    this.runAudiobookMerge(libraryItem, task, options || {})
  }

  async runAudiobookMerge(libraryItem, task, encodingOptions) {
    // Make sure the target directory is writable
    if (!(await fileUtils.isWritable(libraryItem.path))) {
      Logger.error(`[AbMergeManager] Target directory is not writable: ${libraryItem.path}`)
      task.setFailed('Target directory is not writable')
      this.removeTask(task, true)
      return
    }

    // Create ffmetadata file
    if (!(await ffmpegHelpers.writeFFMetadataFile(task.data.ffmetadataObject, task.data.chapters, task.data.ffmetadataPath))) {
      Logger.error(`[AudioMetadataManager] Failed to write ffmetadata file for audiobook "${task.data.libraryItemId}"`)
      task.setFailed('Failed to write metadata file.')
      this.removeTask(task, true)
      return
    }

    this.pendingTasks.push({
      id: task.id,
      task
    })

    const encodeFraction = 0.95
    const embedFraction = 1 - encodeFraction
    try {
      const trackProgressMonitor = new TrackProgressMonitor(
        libraryItem.media.tracks.map((t) => t.duration),
        (trackIndex) => SocketAuthority.adminEmitter('track_started', { libraryItemId: libraryItem.id, ino: task.data.inos[trackIndex] }),
        (trackIndex, progressInTrack, taskProgress) => {
          SocketAuthority.adminEmitter('track_progress', { libraryItemId: libraryItem.id, ino: task.data.inos[trackIndex], progress: progressInTrack })
          SocketAuthority.adminEmitter('task_progress', { libraryItemId: libraryItem.id, progress: taskProgress * encodeFraction })
        },
        (trackIndex) => SocketAuthority.adminEmitter('track_finished', { libraryItemId: libraryItem.id, ino: task.data.inos[trackIndex] })
      )
      task.data.ffmpeg = new Ffmpeg()
      await ffmpegHelpers.mergeAudioFiles(libraryItem.media.tracks, task.data.duration, task.data.itemCachePath, task.data.tempFilepath, encodingOptions, (progress) => trackProgressMonitor.update(progress), task.data.ffmpeg)
      delete task.data.ffmpeg
      trackProgressMonitor.finish()
    } catch (error) {
      if (error.message === 'FFMPEG_CANCELED') {
        Logger.info(`[AbMergeManager] Task cancelled ${task.id}`)
      } else {
        Logger.error(`[AbMergeManager] mergeAudioFiles failed`, error)
        task.setFailed('Failed to merge audio files')
        this.removeTask(task, true)
      }
      return
    }

    // Write metadata to merged file
    try {
      task.data.ffmpeg = new Ffmpeg()
      await ffmpegHelpers.addCoverAndMetadataToFile(
        task.data.tempFilepath,
        task.data.coverPath,
        task.data.ffmetadataPath,
        1,
        'audio/mp4',
        (progress) => {
          Logger.debug(`[AbMergeManager] Embedding metadata progress: ${100 * encodeFraction + progress * embedFraction}`)
          SocketAuthority.adminEmitter('task_progress', { libraryItemId: libraryItem.id, progress: 100 * encodeFraction + progress * embedFraction })
        },
        task.data.ffmpeg
      )
      delete task.data.ffmpeg
    } catch (error) {
      if (error.message === 'FFMPEG_CANCELED') {
        Logger.info(`[AbMergeManager] Task cancelled ${task.id}`)
      } else {
        Logger.error(`[AbMergeManager] Failed to write metadata to file "${task.data.tempFilepath}"`)
        task.setFailed('Failed to write metadata to m4b file')
        this.removeTask(task, true)
      }
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

    // Remove ffmetadata file
    await fs.remove(task.data.ffmetadataPath)

    task.setFinished()
    await this.removeTask(task, false)
    Logger.info(`[AbMergeManager] Ab task finished ${task.id}`)
  }

  async removeTask(task, removeTempFilepath = false) {
    Logger.info('[AbMergeManager] Removing task ' + task.id)

    const pendingTask = this.pendingTasks.find((d) => d.id === task.id)
    if (pendingTask) {
      this.pendingTasks = this.pendingTasks.filter((d) => d.id !== task.id)
      if (task.data.ffmpeg) {
        Logger.warn(`[AbMergeManager] Killing ffmpeg process for task ${task.id}`)
        task.data.ffmpeg.kill()
        // wait for ffmpeg to exit, so that the output file is unlocked
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    if (removeTempFilepath) {
      // On failed tasks remove the bad file if it exists
      if (await fs.pathExists(task.data.tempFilepath)) {
        await fs
          .remove(task.data.tempFilepath)
          .then(() => {
            Logger.info('[AbMergeManager] Deleted target file', task.data.tempFilepath)
          })
          .catch((err) => {
            Logger.error('[AbMergeManager] Failed to delete target file', err)
          })
      }
      if (await fs.pathExists(task.data.ffmetadataPath)) {
        await fs
          .remove(task.data.ffmetadataPath)
          .then(() => {
            Logger.info('[AbMergeManager] Deleted ffmetadata file', task.data.ffmetadataPath)
          })
          .catch((err) => {
            Logger.error('[AbMergeManager] Failed to delete ffmetadata file', err)
          })
      }
    }

    TaskManager.taskFinished(task)
  }
}
module.exports = AbMergeManager
