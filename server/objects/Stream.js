const EventEmitter = require('events')
const Path = require('path')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const fs = require('../libs/fsExtra')
const Ffmpeg = require('../libs/fluentFfmpeg')

const { secondsToTimestamp } = require('../utils/index')
const { writeConcatFile } = require('../utils/ffmpegHelpers')
const { AudioMimeType } = require('../utils/constants')
const hlsPlaylistGenerator = require('../utils/generators/hlsPlaylistGenerator')
const AudioTrack = require('./files/AudioTrack')

class Stream extends EventEmitter {
  constructor(sessionId, streamPath, user, libraryItem, episodeId, startTime, transcodeOptions = {}) {
    super()

    this.id = sessionId
    this.user = user
    this.libraryItem = libraryItem
    this.episodeId = episodeId

    this.transcodeOptions = transcodeOptions

    this.segmentLength = 6
    this.maxSeekBackTime = 30
    this.streamPath = Path.join(streamPath, this.id)
    this.concatFilesPath = Path.join(this.streamPath, 'files.txt')
    this.playlistPath = Path.join(this.streamPath, 'output.m3u8')
    this.finalPlaylistPath = Path.join(this.streamPath, 'final-output.m3u8')
    this.startTime = startTime

    this.ffmpeg = null
    this.loop = null
    this.isResetting = false
    this.isClientInitialized = false
    this.isTranscodeComplete = false
    this.segmentsCreated = new Set()
    this.furthestSegmentCreated = 0
  }

  get isPodcast() {
    return this.libraryItem.mediaType === 'podcast'
  }
  get episode() {
    if (!this.isPodcast) return null
    return this.libraryItem.media.episodes.find((ep) => ep.id === this.episodeId)
  }
  get libraryItemId() {
    return this.libraryItem.id
  }
  get mediaTitle() {
    if (this.episode) return this.episode.title || ''
    return this.libraryItem.media.metadata.title || ''
  }
  get totalDuration() {
    if (this.episode) return this.episode.duration
    return this.libraryItem.media.duration
  }
  get tracks() {
    if (this.episode) return this.episode.tracks
    return this.libraryItem.media.tracks
  }
  get tracksAudioFileType() {
    if (!this.tracks.length) return null
    return this.tracks[0].metadata.format
  }
  get tracksMimeType() {
    if (!this.tracks.length) return null
    return this.tracks[0].mimeType
  }
  get tracksCodec() {
    if (!this.tracks.length) return null
    return this.tracks[0].codec
  }
  get mimeTypesToForceAAC() {
    return [AudioMimeType.FLAC, AudioMimeType.OPUS, AudioMimeType.WMA, AudioMimeType.AIFF, AudioMimeType.WEBM, AudioMimeType.WEBMA, AudioMimeType.AWB, AudioMimeType.CAF]
  }
  get codecsToForceAAC() {
    return ['alac']
  }
  get userToken() {
    return this.user.token
  }
  // Fmp4 does not work on iOS devices: https://github.com/advplyr/audiobookshelf-app/issues/85
  //   Workaround: Force AAC transcode for FLAC
  get hlsSegmentType() {
    return 'mpegts'
  }
  get segmentBasename() {
    return 'output-%d.ts'
  }
  get segmentStartNumber() {
    if (!this.startTime) return 0
    return Math.floor(Math.max(this.startTime - this.maxSeekBackTime, 0) / this.segmentLength)
  }
  get numSegments() {
    var numSegs = Math.floor(this.totalDuration / this.segmentLength)
    if (this.totalDuration - numSegs * this.segmentLength > 0) {
      numSegs++
    }
    return numSegs
  }
  get clientPlaylistUri() {
    return `/hls/${this.id}/output.m3u8`
  }
  get isAACEncodable() {
    return ['mp4', 'm4a', 'm4b'].includes(this.tracksAudioFileType)
  }
  get transcodeForceAAC() {
    return !!this.transcodeOptions.forceAAC
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.user.id,
      libraryItem: this.libraryItem.toJSONExpanded(),
      episode: this.episode ? this.episode.toJSONExpanded() : null,
      segmentLength: this.segmentLength,
      playlistPath: this.playlistPath,
      clientPlaylistUri: this.clientPlaylistUri,
      startTime: this.startTime,
      segmentStartNumber: this.segmentStartNumber,
      isTranscodeComplete: this.isTranscodeComplete
    }
  }

  async checkSegmentNumberRequest(segNum) {
    const segStartTime = segNum * this.segmentLength
    if (this.segmentStartNumber > segNum) {
      Logger.warn(`[STREAM] Segment #${segNum} Request is before starting segment number #${this.segmentStartNumber} - Reset Transcode`)
      await this.reset(segStartTime - this.segmentLength * 5)
      return segStartTime
    } else if (this.isTranscodeComplete) {
      return false
    }

    if (this.furthestSegmentCreated) {
      const distanceFromFurthestSegment = segNum - this.furthestSegmentCreated
      if (distanceFromFurthestSegment > 10) {
        Logger.info(`Segment #${segNum} requested is ${distanceFromFurthestSegment} segments from latest (${secondsToTimestamp(segStartTime)}) - Reset Transcode`)
        await this.reset(segStartTime - this.segmentLength * 5)
        return segStartTime
      }
    }

    return false
  }

  async generatePlaylist() {
    await fs.ensureDir(this.streamPath)
    await hlsPlaylistGenerator(this.playlistPath, 'output', this.totalDuration, this.segmentLength, this.hlsSegmentType, this.userToken)
    return this.clientPlaylistUri
  }

  async checkFiles() {
    try {
      var files = await fs.readdir(this.streamPath)
      files.forEach((file) => {
        var extname = Path.extname(file)
        if (extname === '.ts') {
          var basename = Path.basename(file, extname)
          var num_part = basename.split('-')[1]
          var part_num = Number(num_part)
          this.segmentsCreated.add(part_num)
        }
      })

      if (!this.segmentsCreated.size) {
        Logger.warn('No Segments')
        return
      }

      if (this.segmentsCreated.size > 6 && !this.isClientInitialized) {
        this.isClientInitialized = true
        Logger.info(`[STREAM] ${this.id} notifying client that stream is ready`)
        this.clientEmit('stream_open', this.toJSON())
      }

      var chunks = []
      var current_chunk = []
      var last_seg_in_chunk = -1

      var segments = Array.from(this.segmentsCreated).sort((a, b) => a - b)
      var lastSegment = segments[segments.length - 1]
      if (lastSegment > this.furthestSegmentCreated) {
        this.furthestSegmentCreated = lastSegment
      }

      segments.forEach((seg) => {
        if (!current_chunk.length || last_seg_in_chunk + 1 === seg) {
          last_seg_in_chunk = seg
          current_chunk.push(seg)
        } else {
          if (current_chunk.length === 1) chunks.push(current_chunk[0])
          else chunks.push(`${current_chunk[0]}-${current_chunk[current_chunk.length - 1]}`)
          last_seg_in_chunk = seg
          current_chunk = [seg]
        }
      })
      if (current_chunk.length) {
        if (current_chunk.length === 1) chunks.push(current_chunk[0])
        else chunks.push(`${current_chunk[0]}-${current_chunk[current_chunk.length - 1]}`)
      }

      var perc = ((this.segmentsCreated.size * 100) / this.numSegments).toFixed(2) + '%'
      Logger.info('[STREAM-CHECK] Check Files', this.segmentsCreated.size, 'of', this.numSegments, perc, `Furthest Segment: ${this.furthestSegmentCreated}`)
      // Logger.debug('[STREAM-CHECK] Chunks', chunks.join(', '))

      this.clientEmit('stream_progress', {
        stream: this.id,
        percent: perc,
        chunks,
        numSegments: this.numSegments
      })
    } catch (error) {
      Logger.error('Failed checking files', error)
    }
  }

  startLoop() {
    this.clientEmit('stream_progress', { stream: this.id, chunks: [], numSegments: 0, percent: '0%' })

    clearInterval(this.loop)
    var intervalId = setInterval(() => {
      if (!this.isTranscodeComplete) {
        this.checkFiles()
      } else {
        Logger.info(`[Stream] ${this.mediaTitle} sending stream_ready`)
        this.clientEmit('stream_ready')
        clearInterval(intervalId)
      }
    }, 2000)
    this.loop = intervalId
  }

  async start() {
    Logger.info(`[STREAM] START STREAM - Num Segments: ${this.numSegments}`)

    /** @type {import('../libs/fluentFfmpeg/index').FfmpegCommand} */
    this.ffmpeg = Ffmpeg()
    this.furthestSegmentCreated = 0

    const adjustedStartTime = Math.max(this.startTime - this.maxSeekBackTime, 0)
    const trackStartTime = await writeConcatFile(this.tracks, this.concatFilesPath, adjustedStartTime)
    if (trackStartTime == null) {
      // Close stream show error
      this.ffmpeg = null
      this.close('Failed to write stream concat file')
      return
    }

    this.ffmpeg.addInput(this.concatFilesPath)
    // seek_timestamp : https://ffmpeg.org/ffmpeg.html
    // the argument to the -ss option is considered an actual timestamp, and is not offset by the start time of the file
    //   fixes https://github.com/advplyr/audiobookshelf/issues/116
    this.ffmpeg.inputOption('-seek_timestamp 1')
    this.ffmpeg.inputFormat('concat')
    this.ffmpeg.inputOption('-safe 0')

    if (adjustedStartTime > 0) {
      const shiftedStartTime = adjustedStartTime - trackStartTime
      // Issues using exact fractional seconds i.e. 29.49814 - changing to 29.5s
      var startTimeS = Math.round(shiftedStartTime * 10) / 10 + 's'
      Logger.info(`[STREAM] Starting Stream at startTime ${secondsToTimestamp(adjustedStartTime)} (User startTime ${secondsToTimestamp(this.startTime)}) and Segment #${this.segmentStartNumber}`)
      this.ffmpeg.inputOption(`-ss ${startTimeS}`)

      this.ffmpeg.inputOption('-noaccurate_seek')
    }

    const logLevel = process.env.NODE_ENV === 'production' ? 'error' : 'warning'

    let audioCodec = 'copy'
    if (this.transcodeForceAAC || this.mimeTypesToForceAAC.includes(this.tracksMimeType) || this.codecsToForceAAC.includes(this.tracksCodec)) {
      Logger.debug(`[Stream] Forcing AAC for tracks with mime type ${this.tracksMimeType} and codec ${this.tracksCodec}`)
      audioCodec = 'aac'
    }

    this.ffmpeg.addOption([`-loglevel ${logLevel}`, '-map 0:a', `-c:a ${audioCodec}`])
    const hlsOptions = ['-f hls', '-copyts', '-avoid_negative_ts make_non_negative', '-max_delay 5000000', '-max_muxing_queue_size 2048', `-hls_time 6`, `-hls_segment_type ${this.hlsSegmentType}`, `-start_number ${this.segmentStartNumber}`, '-hls_playlist_type vod', '-hls_list_size 0', '-hls_allow_cache 0']
    if (this.hlsSegmentType === 'fmp4') {
      hlsOptions.push('-strict -2')
      var fmp4InitFilename = Path.join(this.streamPath, 'init.mp4')
      // var fmp4InitFilename = 'init.mp4'
      hlsOptions.push(`-hls_fmp4_init_filename ${fmp4InitFilename}`)
    }
    this.ffmpeg.addOption(hlsOptions)
    var segmentFilename = Path.join(this.streamPath, this.segmentBasename)
    this.ffmpeg.addOption(`-hls_segment_filename ${segmentFilename}`)
    this.ffmpeg.output(this.finalPlaylistPath)

    this.ffmpeg.on('start', (command) => {
      Logger.info('[INFO] FFMPEG transcoding started with command: ' + command)
      Logger.info('')
      if (this.isResetting) {
        // AAC encode is much slower
        const clearIsResettingTime = this.transcodeForceAAC ? 3000 : 500
        setTimeout(() => {
          Logger.info('[STREAM] Clearing isResetting')
          this.isResetting = false
          this.startLoop()
        }, clearIsResettingTime)
      } else {
        this.startLoop()
      }
    })

    this.ffmpeg.on('stderr', (stdErrline) => {
      Logger.info(stdErrline)
    })

    this.ffmpeg.on('error', (err, stdout, stderr) => {
      if (err.message && err.message.includes('SIGKILL')) {
        // This is an intentional SIGKILL
        Logger.info('[FFMPEG] Transcode Killed')
        this.ffmpeg = null
        clearInterval(this.loop)
      } else {
        Logger.error('Ffmpeg Err', '"' + err.message + '"')

        // Temporary workaround for https://github.com/advplyr/audiobookshelf/issues/172 and https://github.com/advplyr/audiobookshelf/issues/2157
        const aacErrorMsg = 'ffmpeg exited with code 1'
        const errorMessageSuggestsReEncode = err.message?.startsWith(aacErrorMsg) && !err.message?.includes('No such file or directory')
        if (audioCodec === 'copy' && this.isAACEncodable && errorMessageSuggestsReEncode) {
          Logger.info(`[Stream] Re-attempting stream with AAC encode`)
          this.transcodeOptions.forceAAC = true
          this.reset(this.startTime)
        } else {
          // Close stream show error
          this.close(err.message)
        }
      }
    })

    this.ffmpeg.on('end', (stdout, stderr) => {
      Logger.info('[FFMPEG] Transcoding ended')
      // For very small fast load
      if (!this.isClientInitialized) {
        this.isClientInitialized = true

        Logger.info(`[STREAM] ${this.id} notifying client that stream is ready`)
        this.clientEmit('stream_open', this.toJSON())
      }
      this.isTranscodeComplete = true
      this.ffmpeg = null
      clearInterval(this.loop)
    })

    this.ffmpeg.run()
  }

  async close(errorMessage = null) {
    clearInterval(this.loop)

    Logger.info('Closing Stream', this.id)
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGKILL')
    }

    await fs
      .remove(this.streamPath)
      .then(() => {
        Logger.info('Deleted session data', this.streamPath)
      })
      .catch((err) => {
        Logger.error('Failed to delete session data', err)
      })

    if (errorMessage) this.clientEmit('stream_error', { id: this.id, error: (errorMessage || '').trim() })
    else this.clientEmit('stream_closed', this.id)

    this.emit('closed')
  }

  cancelTranscode() {
    clearInterval(this.loop)
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGKILL')
    }
  }

  async waitCancelTranscode() {
    for (let i = 0; i < 20; i++) {
      if (!this.ffmpeg) return true
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    Logger.error('[STREAM] Transcode never closed...')
    return false
  }

  async reset(time) {
    if (this.isResetting) {
      return Logger.info(`[STREAM] Stream ${this.id} already resetting`)
    }
    time = Math.max(0, time)
    this.isResetting = true

    if (this.ffmpeg) {
      this.cancelTranscode()
      await this.waitCancelTranscode()
    }

    this.isTranscodeComplete = false
    this.startTime = time
    // this.clientCurrentTime = this.startTime
    Logger.info(`Stream Reset New Start Time ${secondsToTimestamp(this.startTime)}`)
    this.start()
  }

  clientEmit(evtName, data) {
    SocketAuthority.clientEmitter(this.user.id, evtName, data)
  }

  getAudioTrack() {
    var newAudioTrack = new AudioTrack()
    newAudioTrack.setFromStream(this.mediaTitle, this.totalDuration, this.clientPlaylistUri)
    return newAudioTrack
  }
}
module.exports = Stream
