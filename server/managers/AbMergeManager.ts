import Path from 'path'
import fsExtra from '../libs/fsExtra'
import type LibraryItem from '../models/LibraryItem'
import type Book from '../models/Book'
import type { AudioTrack, MergeEncodeOptions } from '../types/ffmpegHelpers'
const fs = fsExtra as typeof fsExtra & Pick<typeof import('fs/promises'), 'mkdir' | 'rename'> & { copy(source: string, destination: string): Promise<void> }
type AudioBookItem = Omit<LibraryItem, 'path' | 'media'> & { path: string; media: Book }
type MergeTaskData = {
  libraryItemId: string; libraryItemDir: string; userId: string; originalTrackPaths: string[]; inos: (string | null | undefined)[]
  tempFilepath: string; targetFilename: string; targetFilepath: string; itemCachePath: string
  ffmetadataObject: ReturnType<typeof ffmpegHelpers.getFFMetadataObject>; chapters: Book['chapters'] | undefined
  coverPath: string | null; ffmetadataPath: string; duration: number; encodeOptions: MergeEncodeOptions; ffmpeg?: Ffmpeg.FfmpegCommand
}
type MergeTask = Task & { data: MergeTaskData }

import Logger from '../Logger'
import TaskManager from './TaskManager'
import Task from '../objects/Task'
import ffmpegHelpers from '../utils/ffmpegHelpers'
import Ffmpeg from '../libs/fluentFfmpeg'
// Embedded fluent-ffmpeg supports construction as well as invocation.
const FfmpegConstructor = Ffmpeg as typeof Ffmpeg & (new () => Ffmpeg.FfmpegCommand)
import SocketAuthority from '../SocketAuthority'
import fileUtils from '../utils/fileUtils'
const { isWritable, copyToExisting } = fileUtils
import TrackProgressMonitor from '../objects/TrackProgressMonitor'

/**
 * @typedef AbMergeEncodeOptions
 * @property {string} codec
 * @property {string} channels
 * @property {string} bitrate
 */

class AbMergeManager {
  declare itemsCacheDir: string
  declare pendingTasks: { id: string | null; task: MergeTask }[]
  constructor() {
    this.itemsCacheDir = Path.join(global.MetadataPath!, 'cache/items')

    /** @type {Task[]} */
    this.pendingTasks = []
  }

  /**
   *
   * @param {string} libraryItemId
   * @returns {Task|null}
   */
  getPendingTaskByLibraryItemId(libraryItemId: string) {
    return this.pendingTasks.find((t) => t.task.data.libraryItemId === libraryItemId)
  }

  /**
   * Cancel and fail running task
   *
   * @param {Task} task
   * @returns {Promise<void>}
   */
  cancelEncode(task: MergeTask) {
    const taskFailedString = {
      text: 'Task canceled by user',
      key: 'MessageTaskCanceledByUser'
    }
    task.setFailed(taskFailedString)
    return this.removeTask(task, true)
  }

  /**
   *
   * @param {string} userId
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {AbMergeEncodeOptions} [options={}]
   */
  async startAudiobookMerge(userId: string, libraryItem: AudioBookItem, options: MergeEncodeOptions = {}) {
    // setData initializes the merge payload before dispatch.
    const task = new Task() as MergeTask

    const audiobookBaseName = libraryItem.isFile ? Path.basename(libraryItem.path, Path.extname(libraryItem.path)) : Path.basename(libraryItem.path)
    const targetFilename = audiobookBaseName + '.m4b'
    const itemCachePath = Path.join(this.itemsCacheDir, libraryItem.id)
    const tempFilepath = Path.join(itemCachePath, targetFilename)
    const ffmetadataPath = Path.join(itemCachePath, 'ffmetadata.txt')
    const libraryItemDir = libraryItem.isFile ? Path.dirname(libraryItem.path) : libraryItem.path
    const taskData: MergeTaskData = {
      libraryItemId: libraryItem.id,
      libraryItemDir,
      userId,
      originalTrackPaths: libraryItem.media.includedAudioFiles.map((t) => t.metadata.path!),
      inos: libraryItem.media.includedAudioFiles.map((f) => f.ino),
      tempFilepath,
      targetFilename,
      targetFilepath: Path.join(libraryItemDir, targetFilename),
      itemCachePath,
      ffmetadataObject: ffmpegHelpers.getFFMetadataObject(libraryItem as Parameters<typeof ffmpegHelpers.getFFMetadataObject>[0], 1),
      chapters: libraryItem.media.chapters?.map((c) => ({ ...c })),
      coverPath: libraryItem.media.coverPath,
      ffmetadataPath,
      duration: libraryItem.media.duration!,
      encodeOptions: options
    }

    const taskTitleString = {
      text: 'Encoding M4b',
      key: 'MessageTaskEncodingM4b'
    }
    const taskDescriptionString = {
      text: `Encoding audiobook "${libraryItem.media.title}" into a single m4b file.`,
      key: 'MessageTaskEncodingM4bDescription',
      subs: [libraryItem.media.title!]
    }
    task.setData('encode-m4b', taskTitleString, taskDescriptionString, false, taskData)
    TaskManager.addTask(task)
    Logger.info(`Start m4b encode for ${libraryItem.id} - TaskId: ${task.id}`)

    if (!(await fs.pathExists(taskData.itemCachePath))) {
      await fs.mkdir(taskData.itemCachePath)
    }

    void this.runAudiobookMerge(libraryItem, task, options || {})
  }

  /**
   *
   * @param {import('../models/LibraryItem')} libraryItem
   * @param {Task} task
   * @param {AbMergeEncodeOptions} encodingOptions
   */
  async runAudiobookMerge(libraryItem: AudioBookItem, task: MergeTask, encodingOptions: MergeEncodeOptions) {
    // Make sure the target directory is writable
    if (!(await isWritable(task.data.libraryItemDir))) {
      Logger.error(`[AbMergeManager] Target directory is not writable: ${task.data.libraryItemDir}`)
      const taskFailedString = {
        text: 'Target directory is not writable',
        key: 'MessageTaskTargetDirectoryNotWritable'
      }
      task.setFailed(taskFailedString)
      void this.removeTask(task, true)
      return
    }

    // Create ffmetadata file
    if (!(await ffmpegHelpers.writeFFMetadataFile(task.data.ffmetadataObject, task.data.chapters!, task.data.ffmetadataPath))) {
      Logger.error(`[AudioMetadataManager] Failed to write ffmetadata file for audiobook "${task.data.libraryItemId}"`)
      const taskFailedString = {
        text: 'Failed to write metadata file',
        key: 'MessageTaskFailedToWriteMetadataFile'
      }
      task.setFailed(taskFailedString)
      void this.removeTask(task, true)
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
        libraryItem.media.includedAudioFiles.map((t) => t.duration!),
        (trackIndex) => SocketAuthority.adminEmitter('track_started', { libraryItemId: libraryItem.id, ino: task.data.inos[trackIndex] }),
        (trackIndex, progressInTrack, taskProgress) => {
          SocketAuthority.adminEmitter('track_progress', { libraryItemId: libraryItem.id, ino: task.data.inos[trackIndex], progress: progressInTrack })
          SocketAuthority.adminEmitter('task_progress', { libraryItemId: libraryItem.id, progress: taskProgress * encodeFraction })
        },
        (trackIndex) => SocketAuthority.adminEmitter('track_finished', { libraryItemId: libraryItem.id, ino: task.data.inos[trackIndex] })
      )
      task.data.ffmpeg = new FfmpegConstructor()
      await ffmpegHelpers.mergeAudioFiles(libraryItem.media.includedAudioFiles as AudioTrack[], task.data.duration, task.data.itemCachePath, task.data.tempFilepath, encodingOptions, (progress) => trackProgressMonitor.update(progress), task.data.ffmpeg)
      delete task.data.ffmpeg
      trackProgressMonitor.finish()
    } catch (error) {
      if ((error as Error).message === 'FFMPEG_CANCELED') {
        Logger.info(`[AbMergeManager] Task cancelled ${task.id}`)
      } else {
        Logger.error(`[AbMergeManager] mergeAudioFiles failed`, error)
        const taskFailedString = {
          text: 'Failed to merge audio files',
          key: 'MessageTaskFailedToMergeAudioFiles'
        }
        task.setFailed(taskFailedString)
        void this.removeTask(task, true)
      }
      return
    }

    // Write metadata to merged file
    try {
      task.data.ffmpeg = new FfmpegConstructor()
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
      if ((error as Error).message === 'FFMPEG_CANCELED') {
        Logger.info(`[AbMergeManager] Task cancelled ${task.id}`)
      } else {
        Logger.error(`[AbMergeManager] Failed to embed metadata in file "${task.data.tempFilepath}"`)
        const taskFailedString = {
          text: `Failed to embed metadata in file ${Path.basename(task.data.tempFilepath)}`,
          key: 'MessageTaskFailedToEmbedMetadataInFile',
          subs: [Path.basename(task.data.tempFilepath)]
        }
        task.setFailed(taskFailedString)
        void this.removeTask(task, true)
      }
      return
    }

    // Move library item tracks to cache
    for (const [index, trackPath] of task.data.originalTrackPaths.entries()) {
      const trackFilename = Path.basename(trackPath)
      let moveToPath = Path.join(task.data.itemCachePath, trackFilename)

      // If the track is the same as the temp file, we need to rename it to avoid overwriting it
      if (task.data.tempFilepath === moveToPath) {
        const trackExtname = Path.extname(task.data.tempFilepath)
        const newTrackFilename = Path.basename(task.data.tempFilepath, trackExtname) + '.backup' + trackExtname
        moveToPath = Path.join(task.data.itemCachePath, newTrackFilename)
      }

      Logger.debug(`[AbMergeManager] Backing up original track "${trackPath}" to ${moveToPath}`)
      if (index === 0) {
        // copy the first track to the cache directory
        await fs.copy(trackPath, moveToPath).catch((err: unknown) => {
          Logger.error(`[AbMergeManager] Failed to copy track "${trackPath}" to "${moveToPath}"`, err)
        })
      } else {
        // move the rest of the tracks to the cache directory
        await fs.move(trackPath, moveToPath, { overwrite: true }).catch((err: unknown) => {
          Logger.error(`[AbMergeManager] Failed to move track "${trackPath}" to "${moveToPath}"`, err)
        })
      }
    }

    // Move m4b to target, preserving the original track's permissions
    Logger.debug(`[AbMergeManager] Moving m4b from ${task.data.tempFilepath} to ${task.data.targetFilepath}`)
    try {
      await copyToExisting(task.data.tempFilepath, task.data.originalTrackPaths[0])
      await fs.rename(task.data.originalTrackPaths[0], task.data.targetFilepath)
      await fs.remove(task.data.tempFilepath)
    } catch (err) {
      Logger.error(`[AbMergeManager] Failed to move m4b from ${task.data.tempFilepath} to ${task.data.targetFilepath}`, err)
      const taskFailedString = {
        text: 'Failed to move m4b file',
        key: 'MessageTaskFailedToMoveM4bFile'
      }
      task.setFailed(taskFailedString)
      void this.removeTask(task, true)
      return
    }

    // Remove ffmetadata file
    await fs.remove(task.data.ffmetadataPath)

    task.setFinished()
    await this.removeTask(task, false)
    Logger.info(`[AbMergeManager] Ab task finished ${task.id}`)
  }

  /**
   * Remove ab merge task
   *
   * @param {Task} task
   * @param {boolean} [removeTempFilepath=false]
   */
  async removeTask(task: MergeTask, removeTempFilepath = false) {
    Logger.info('[AbMergeManager] Removing task ' + task.id)

    const pendingTask = this.pendingTasks.find((d) => d.id === task.id)
    if (pendingTask) {
      this.pendingTasks = this.pendingTasks.filter((d) => d.id !== task.id)
      if (task.data.ffmpeg) {
        Logger.warn(`[AbMergeManager] Killing ffmpeg process for task ${task.id}`)
        // The embedded implementation defaults the signal when omitted.
        const ffmpeg = task.data.ffmpeg as Ffmpeg.FfmpegCommand & { kill(): Ffmpeg.FfmpegCommand }
        ffmpeg.kill()
        // wait for ffmpeg to exit, so that the output file is unlocked
        await new Promise<void>((resolve) => setTimeout(resolve, 500))
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
          .catch((err: unknown) => {
            Logger.error('[AbMergeManager] Failed to delete target file', err)
          })
      }
      if (await fs.pathExists(task.data.ffmetadataPath)) {
        await fs
          .remove(task.data.ffmetadataPath)
          .then(() => {
            Logger.info('[AbMergeManager] Deleted ffmetadata file', task.data.ffmetadataPath)
          })
          .catch((err: unknown) => {
            Logger.error('[AbMergeManager] Failed to delete ffmetadata file', err)
          })
      }
    }

    TaskManager.taskFinished(task)
  }
}
export = AbMergeManager
