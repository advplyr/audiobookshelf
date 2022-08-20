const os = require('os')
const Path = require('path')
const { EventEmitter } = require('events')
const { Worker } = require("worker_threads")
const Logger = require('../Logger')
const AudioFile = require('../objects/files/AudioFile')
const VideoFile = require('../objects/files/VideoFile')
const MediaProbeData = require('./MediaProbeData')

class LibraryItemBatch extends EventEmitter {
  constructor(libraryItem, libraryFiles, scanData) {
    super()

    this.id = libraryItem.id
    this.mediaType = libraryItem.mediaType
    this.mediaMetadataFromScan = scanData.media.metadata || null
    this.libraryFilesToScan = libraryFiles

    // Results
    this.totalElapsed = 0
    this.totalProbed = 0
    this.audioFiles = []
    this.videoFiles = []
  }

  done() {
    this.emit('done', {
      videoFiles: this.videoFiles,
      audioFiles: this.audioFiles,
      averageTimePerMb: Math.round(this.totalElapsed / this.totalProbed)
    })
  }
}

class MediaProbePool {
  constructor() {
    this.MaxThreads = 0
    this.probeWorkerScript = null

    this.itemBatchMap = {}

    this.probesRunning = []
    this.probeQueue = []
  }

  tick() {
    if (this.probesRunning.length < this.MaxThreads) {
      if (this.probeQueue.length > 0) {
        const pw = this.probeQueue.shift()
        // console.log('Unqueued probe - Remaining is', this.probeQueue.length, 'Currently running is', this.probesRunning.length)
        this.startTask(pw)
      } else if (!this.probesRunning.length) {
        // console.log('No more probes to run')
      }
    }
  }

  async startTask(task) {
    this.probesRunning.push(task)

    const itemBatch = this.itemBatchMap[task.batchId]

    await task.start().then((taskResult) => {
      itemBatch.libraryFilesToScan = itemBatch.libraryFilesToScan.filter(lf => lf.ino !== taskResult.libraryFile.ino)

      var fileSizeMb = taskResult.libraryFile.metadata.size / (1024 * 1024)
      var elapsedPerMb = Math.round(taskResult.elapsed / fileSizeMb)

      const probeData = new MediaProbeData(taskResult.data)

      if (itemBatch.mediaType === 'video') {
        if (!probeData.videoStream) {
          Logger.error('[MediaProbePool] Invalid video file no video stream')
        } else {
          itemBatch.totalElapsed += elapsedPerMb
          itemBatch.totalProbed++

          var videoFile = new VideoFile()
          videoFile.setDataFromProbe(libraryFile, probeData)
          itemBatch.videoFiles.push(videoFile)
        }
      } else {
        if (!probeData.audioStream) {
          Logger.error('[MediaProbePool] Invalid audio file no audio stream')
        } else {
          itemBatch.totalElapsed += elapsedPerMb
          itemBatch.totalProbed++

          var audioFile = new AudioFile()
          audioFile.trackNumFromMeta = probeData.trackNumber
          audioFile.discNumFromMeta = probeData.discNumber
          if (itemBatch.mediaType === 'book') {
            const { trackNumber, discNumber } = this.getTrackAndDiscNumberFromFilename(itemBatch.mediaMetadataFromScan, taskResult.libraryFile)
            audioFile.trackNumFromFilename = trackNumber
            audioFile.discNumFromFilename = discNumber
          }
          audioFile.setDataFromProbe(taskResult.libraryFile, probeData)

          itemBatch.audioFiles.push(audioFile)
        }
      }

      this.probesRunning = this.probesRunning.filter(tq => tq.mediaPath !== task.mediaPath)
      this.tick()
    }).catch((error) => {
      itemBatch.libraryFilesToScan = itemBatch.libraryFilesToScan.filter(lf => lf.ino !== taskResult.libraryFile.ino)

      Logger.error('[MediaProbePool] Task failed', error)
      this.probesRunning = this.probesRunning.filter(tq => tq.mediaPath !== task.mediaPath)
      this.tick()
    })

    if (!itemBatch.libraryFilesToScan.length) {
      itemBatch.done()
      delete this.itemBatchMap[itemBatch.id]
    }
  }

  buildTask(libraryFile, batchId) {
    return {
      batchId,
      mediaPath: libraryFile.metadata.path,
      start: () => {
        return new Promise((resolve, reject) => {
          const startTime = Date.now()

          const worker = new Worker(this.probeWorkerScript)
          worker.on("message", ({ data }) => {
            if (data.error) {
              reject(data.error)
            } else {
              resolve({
                data,
                elapsed: Date.now() - startTime,
                libraryFile
              })
            }
          })
          worker.postMessage({
            mediaPath: libraryFile.metadata.path
          })
        })
      }
    }
  }

  initBatch(libraryItem, libraryFiles, scanData) {
    this.MaxThreads = global.ServerSettings.scannerMaxThreads || (os.cpus().length * 2)
    this.probeWorkerScript = Path.join(global.appRoot, 'server/utils/probeWorker.js')

    Logger.debug(`[MediaProbePool] Run item batch ${libraryItem.id} with`, libraryFiles.length, 'files and max concurrent of', this.MaxThreads)

    const itemBatch = new LibraryItemBatch(libraryItem, libraryFiles, scanData)
    this.itemBatchMap[itemBatch.id] = itemBatch

    return itemBatch
  }

  runBatch(itemBatch) {
    for (const libraryFile of itemBatch.libraryFilesToScan) {
      const probeTask = this.buildTask(libraryFile, itemBatch.id)

      if (this.probesRunning.length < this.MaxThreads) {
        this.startTask(probeTask)
      } else {
        this.probeQueue.push(probeTask)
      }
    }
  }

  getTrackAndDiscNumberFromFilename(mediaMetadataFromScan, audioLibraryFile) {
    const { title, author, series, publishedYear } = mediaMetadataFromScan
    const { filename, path } = audioLibraryFile.metadata
    var partbasename = Path.basename(filename, Path.extname(filename))

    // Remove title, author, series, and publishedYear from filename if there
    if (title) partbasename = partbasename.replace(title, '')
    if (author) partbasename = partbasename.replace(author, '')
    if (series) partbasename = partbasename.replace(series, '')
    if (publishedYear) partbasename = partbasename.replace(publishedYear)

    // Look for disc number
    var discNumber = null
    var discMatch = partbasename.match(/\b(disc|cd) ?(\d\d?)\b/i)
    if (discMatch && discMatch.length > 2 && discMatch[2]) {
      if (!isNaN(discMatch[2])) {
        discNumber = Number(discMatch[2])
      }

      // Remove disc number from filename
      partbasename = partbasename.replace(/\b(disc|cd) ?(\d\d?)\b/i, '')
    }

    // Look for disc number in folder path e.g. /Book Title/CD01/audiofile.mp3
    var pathdir = Path.dirname(path).split('/').pop()
    if (pathdir && /^cd\d{1,3}$/i.test(pathdir)) {
      var discFromFolder = Number(pathdir.replace(/cd/i, ''))
      if (!isNaN(discFromFolder) && discFromFolder !== null) discNumber = discFromFolder
    }

    var numbersinpath = partbasename.match(/\d{1,4}/g)
    var trackNumber = numbersinpath && numbersinpath.length ? parseInt(numbersinpath[0]) : null
    return {
      trackNumber,
      discNumber
    }
  }
}
module.exports = new MediaProbePool()