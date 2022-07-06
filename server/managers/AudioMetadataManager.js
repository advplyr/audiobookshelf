const Path = require('path')
const fs = require('../libs/fsExtra')
const workerThreads = require('worker_threads')
const Logger = require('../Logger')
const filePerms = require('../utils/filePerms')
const { secondsToTimestamp } = require('../utils/index')
const { writeMetadataFile } = require('../utils/ffmpegHelpers')

class AudioMetadataMangaer {
  constructor(db, emitter, clientEmitter) {
    this.db = db
    this.emitter = emitter
    this.clientEmitter = clientEmitter
  }

  async updateAudioFileMetadataForItem(user, libraryItem) {
    var audioFiles = libraryItem.media.audioFiles

    const itemAudioMetadataPayload = {
      userId: user.id,
      libraryItemId: libraryItem.id,
      startedAt: Date.now(),
      audioFiles: audioFiles.map(af => ({ index: af.index, ino: af.ino, filename: af.metadata.filename }))
    }

    this.emitter('audio_metadata_started', itemAudioMetadataPayload)

    var downloadsPath = Path.join(global.MetadataPath, 'downloads')
    var outputDir = Path.join(downloadsPath, libraryItem.id)
    await fs.ensureDir(outputDir)

    var metadataFilePath = Path.join(outputDir, 'metadata.txt')
    await writeMetadataFile(libraryItem, metadataFilePath)

    if (libraryItem.media.coverPath != null) {
      var coverPath = libraryItem.media.coverPath.replace(/\\/g, '/')
    }

    // TODO: Split into batches
    const proms = audioFiles.map(af => {
      return this.updateAudioFileMetadata(libraryItem.id, af, outputDir, metadataFilePath, coverPath)
    })

    const results = await Promise.all(proms)

    Logger.debug(`[AudioMetadataManager] Finished`)

    await fs.remove(outputDir)

    const elapsed = Date.now() - itemAudioMetadataPayload.startedAt
    Logger.debug(`[AudioMetadataManager] Elapsed ${secondsToTimestamp(elapsed)}`)
    itemAudioMetadataPayload.results = results
    itemAudioMetadataPayload.elapsed = elapsed
    itemAudioMetadataPayload.finishedAt = Date.now()
    this.emitter('audio_metadata_finished', itemAudioMetadataPayload)
  }

  updateAudioFileMetadata(libraryItemId, audioFile, outputDir, metadataFilePath, coverPath = '') {
    return new Promise((resolve) => {
      const resultPayload = {
        libraryItemId,
        index: audioFile.index,
        ino: audioFile.ino,
        filename: audioFile.metadata.filename
      }
      this.emitter('audiofile_metadata_started', resultPayload)

      Logger.debug(`[AudioFileMetadataManager] Starting audio file metadata encode for "${audioFile.metadata.filename}"`)

      var outputPath = Path.join(outputDir, audioFile.metadata.filename)
      var inputPath = audioFile.metadata.path
      const isM4b = audioFile.metadata.format === 'm4b'
      const ffmpegInputs = [
        {
          input: inputPath,
          options: isM4b ? ['-f mp4'] : []
        },
        {
          input: metadataFilePath
        }
      ]

      /*
        Mp4 doesnt support writing custom tags by default. Supported tags are itunes tags: https://git.videolan.org/?p=ffmpeg.git;a=blob;f=libavformat/movenc.c;h=b6821d447c92183101086cb67099b2f4804293de;hb=HEAD#l2905

        Workaround -movflags use_metadata_tags found here: https://superuser.com/a/1208277      
        
        Ffmpeg premapped id3 tags: https://wiki.multimedia.cx/index.php/FFmpeg_Metadata
      */

      const ffmpegOptions = ['-c copy', '-map_chapters 1', '-map_metadata 1', `-metadata track=${audioFile.index}`, '-write_id3v2 1', '-movflags use_metadata_tags']

      if (coverPath != '') {
        var ffmpegCoverPathInput = {
          input: coverPath,
          options: ['-f image2pipe']
        }
        var ffmpegCoverPathOptions = [
          '-c:v copy',
          '-map 2:v',
          '-map 0:a'
        ]

        ffmpegInputs.push(ffmpegCoverPathInput)
        Logger.debug(`[AudioFileMetaDataManager] Cover found for "${audioFile.metadata.filename}". Cover will be merged to metadata`)
      } else {
        // remove the video stream to account for the user getting rid an existing cover in abs
        var ffmpegCoverPathOptions = [
          '-map 0',
          '-map -0:v'
        ]

        Logger.debug(`[AudioFileMetaDataManager] No cover found for "${audioFile.metadata.filename}". Cover will be skipped or removed from metadata`)
      }

      ffmpegOptions.push(...ffmpegCoverPathOptions)

      var workerData = {
        inputs: ffmpegInputs,
        options: ffmpegOptions,
        outputOptions: isM4b ? ['-f mp4'] : [],
        output: outputPath,
      }
      var workerPath = Path.join(global.appRoot, 'server/utils/downloadWorker.js')
      var worker = new workerThreads.Worker(workerPath, { workerData })

      worker.on('message', async (message) => {
        if (message != null && typeof message === 'object') {
          if (message.type === 'RESULT') {
            Logger.debug(message)

            if (message.success) {
              Logger.debug(`[AudioFileMetadataManager] Metadata encode SUCCESS for "${audioFile.metadata.filename}"`)

              await filePerms.setDefault(outputPath, true)

              fs.move(outputPath, inputPath, { overwrite: true }).then(() => {
                Logger.debug(`[AudioFileMetadataManager] Audio file replaced successfully "${inputPath}"`)

                resultPayload.success = true
                this.emitter('audiofile_metadata_finished', resultPayload)
                resolve(resultPayload)
              }).catch((error) => {
                Logger.error(`[AudioFileMetadataManager] Audio file failed to move "${inputPath}"`, error)
                resultPayload.success = false
                this.emitter('audiofile_metadata_finished', resultPayload)
                resolve(resultPayload)
              })
            } else {
              Logger.debug(`[AudioFileMetadataManager] Metadata encode FAILED for "${audioFile.metadata.filename}"`)

              resultPayload.success = false
              this.emitter('audiofile_metadata_finished', resultPayload)
              resolve(resultPayload)
            }
          } else if (message.type === 'FFMPEG') {
            if (message.level === 'debug' && process.env.NODE_ENV === 'production') {
              // stderr is not necessary in production
            } else if (Logger[message.level]) {
              Logger[message.level](message.log)
            }
          }
        } else {
          Logger.error('Invalid worker message', message)
        }
      })
    })
  }
}
module.exports = AudioMetadataMangaer
