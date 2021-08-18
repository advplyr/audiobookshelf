const Ffmpeg = require('fluent-ffmpeg')
const EventEmitter = require('events')
const Path = require('path')
const fs = require('fs-extra')
const Logger = require('./Logger')
const { secondsToTimestamp } = require('./utils/fileUtils')
const hlsPlaylistGenerator = require('./utils/hlsPlaylistGenerator')

class Stream extends EventEmitter {
  constructor(streamPath, client, audiobook) {
    super()

    this.id = (Date.now() + Math.trunc(Math.random() * 1000)).toString(36)
    this.client = client
    this.audiobook = audiobook

    this.segmentLength = 6
    this.segmentBasename = 'output-%d.ts'
    this.streamPath = Path.join(streamPath, this.id)
    this.concatFilesPath = Path.join(this.streamPath, 'files.txt')
    this.playlistPath = Path.join(this.streamPath, 'output.m3u8')
    this.fakePlaylistPath = Path.join(this.streamPath, 'fake-output.m3u8')
    this.startTime = 0

    this.ffmpeg = null
    this.loop = null
    this.isResetting = false
    this.isClientInitialized = false
    this.isTranscodeComplete = false
    this.segmentsCreated = new Set()
    this.furthestSegmentCreated = 0
    this.clientCurrentTime = 0

    this.init()
  }

  get socket() {
    return this.client.socket
  }

  get audiobookId() {
    return this.audiobook.id
  }

  get totalDuration() {
    return this.audiobook.totalDuration
  }

  get segmentStartNumber() {
    if (!this.startTime) return 0
    return Math.floor(this.startTime / this.segmentLength)
  }

  get numSegments() {
    var numSegs = Math.floor(this.totalDuration / this.segmentLength)
    if (this.totalDuration - (numSegs * this.segmentLength) > 0) {
      numSegs++
    }
    return numSegs
  }

  get tracks() {
    return this.audiobook.tracks
  }

  get clientPlaylistUri() {
    return `/hls/${this.id}/output.m3u8`
  }

  get clientProgress() {
    if (!this.clientCurrentTime) return 0
    return Number((this.clientCurrentTime / this.totalDuration).toFixed(3))
  }

  toJSON() {
    return {
      id: this.id,
      clientId: this.client.id,
      userId: this.client.user.id,
      audiobook: this.audiobook.toJSONMinified(),
      segmentLength: this.segmentLength,
      playlistPath: this.playlistPath,
      clientPlaylistUri: this.clientPlaylistUri,
      clientCurrentTime: this.clientCurrentTime,
      startTime: this.startTime,
      segmentStartNumber: this.segmentStartNumber,
      isTranscodeComplete: this.isTranscodeComplete
    }
  }

  init() {
    var clientUserAudiobooks = this.client.user ? this.client.user.audiobooks || {} : {}
    var userAudiobook = clientUserAudiobooks[this.audiobookId] || null
    if (userAudiobook) {
      var timeRemaining = this.totalDuration - userAudiobook.currentTime
      Logger.info('[STREAM] User has progress for audiobook', userAudiobook, `Time Remaining: ${timeRemaining}s`)
      if (timeRemaining > 15) {
        this.startTime = userAudiobook.currentTime
        this.clientCurrentTime = this.startTime
      }
    }
  }

  async checkSegmentNumberRequest(segNum) {
    var segStartTime = segNum * this.segmentLength
    if (this.startTime > segStartTime) {
      Logger.warn(`[STREAM] Segment #${segNum} Request @${secondsToTimestamp(segStartTime)} is before start time (${secondsToTimestamp(this.startTime)}) - Reset Transcode`)
      await this.reset(segStartTime - (this.segmentLength * 2))
      return segStartTime
    } else if (this.isTranscodeComplete) {
      return false
    }

    var distanceFromFurthestSegment = segNum - this.furthestSegmentCreated
    if (distanceFromFurthestSegment > 10) {
      Logger.info(`Segment #${segNum} requested is ${distanceFromFurthestSegment} segments from latest (${secondsToTimestamp(segStartTime)}) - Reset Transcode`)
      await this.reset(segStartTime - (this.segmentLength * 2))
      return segStartTime
    }

    return false
  }

  updateClientCurrentTime(currentTime) {
    Logger.debug('[Stream] Updated client current time', secondsToTimestamp(currentTime))
    this.clientCurrentTime = currentTime
  }

  async generatePlaylist() {
    fs.ensureDirSync(this.streamPath)
    await hlsPlaylistGenerator(this.playlistPath, 'output', this.totalDuration, this.segmentLength)
    console.log('Playlist generated')
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
        this.socket.emit('stream_open', this.toJSON())
      }

      var chunks = []
      var current_chunk = []
      var last_seg_in_chunk = -1

      var segments = Array.from(this.segmentsCreated).sort((a, b) => a - b);
      var lastSegment = segments[segments.length - 1]
      if (lastSegment > this.furthestSegmentCreated) {
        this.furthestSegmentCreated = lastSegment
      }

      // console.log('SORT', [...this.segmentsCreated].slice(0, 200).join(', '), segments.slice(0, 200).join(', '))
      segments.forEach((seg) => {
        if (!current_chunk.length || last_seg_in_chunk + 1 === seg) {
          last_seg_in_chunk = seg
          current_chunk.push(seg)
        } else {
          // console.log('Last Seg is not equal to - 1', last_seg_in_chunk, seg)
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

      var perc = (this.segmentsCreated.size * 100 / this.numSegments).toFixed(2) + '%'
      Logger.info('[STREAM-CHECK] Check Files', this.segmentsCreated.size, 'of', this.numSegments, perc, `Furthest Segment: ${this.furthestSegmentCreated}`)
      Logger.info('[STREAM-CHECK] Chunks', chunks.join(', '))

      this.socket.emit('stream_progress', {
        stream: this.id,
        percentCreated: perc,
        chunks,
        numSegments: this.numSegments
      })
    } catch (error) {
      Logger.error('Failed checkign files', error)
    }
  }

  startLoop() {
    this.socket.emit('stream_progress', { chunks: [], numSegments: 0 })
    this.loop = setInterval(() => {
      if (!this.isTranscodeComplete) {
        this.checkFiles()
      } else {
        this.socket.emit('stream_ready')
        clearTimeout(this.loop)
      }
    }, 2000)
  }

  escapeSingleQuotes(path) {
    // return path.replace(/'/g, '\'\\\'\'')
    return path.replace(/\\/g, '/').replace(/ /g, '\\ ').replace(/'/g, '\\\'')
  }

  async start() {
    Logger.info(`[STREAM] START STREAM - Num Segments: ${this.numSegments}`)

    this.ffmpeg = Ffmpeg()
    var currTrackEnd = 0
    var startingTrack = this.tracks.find(t => {
      currTrackEnd += t.duration
      return this.startTime < currTrackEnd
    })
    var trackStartTime = currTrackEnd - startingTrack.duration

    var tracksToInclude = this.tracks.filter(t => t.index >= startingTrack.index)
    var trackPaths = tracksToInclude.map(t => {
      var line = 'file ' + this.escapeSingleQuotes(t.fullPath) + '\n' + `duration ${t.duration}`
      return line
    })
    var inputstr = trackPaths.join('\n\n')
    await fs.writeFile(this.concatFilesPath, inputstr)

    this.ffmpeg.addInput(this.concatFilesPath)
    this.ffmpeg.inputFormat('concat')
    this.ffmpeg.inputOption('-safe 0')

    if (this.startTime > 0) {
      const shiftedStartTime = this.startTime - trackStartTime
      Logger.info(`[STREAM] Starting Stream at startTime ${secondsToTimestamp(this.startTime)} and Segment #${this.segmentStartNumber}`)
      this.ffmpeg.inputOption(`-ss ${shiftedStartTime}`)
      this.ffmpeg.inputOption('-noaccurate_seek')
    }

    this.ffmpeg.addOption([
      '-loglevel warning',
      '-map 0:a',
      '-c:a copy'
    ])
    this.ffmpeg.addOption([
      '-f hls',
      "-copyts",
      "-avoid_negative_ts disabled",
      "-max_delay 5000000",
      "-max_muxing_queue_size 2048",
      `-hls_time 6`,
      "-hls_segment_type mpegts",
      `-start_number ${this.segmentStartNumber}`,
      "-hls_playlist_type vod",
      "-hls_list_size 0",
      "-hls_allow_cache 0"
    ])
    var segmentFilename = Path.join(this.streamPath, this.segmentBasename)
    this.ffmpeg.addOption(`-hls_segment_filename ${segmentFilename}`)
    this.ffmpeg.output(this.fakePlaylistPath)

    this.ffmpeg.on('start', (command) => {
      Logger.info('[INFO] FFMPEG transcoding started with command: ' + command)
      if (this.isResetting) {
        setTimeout(() => {
          Logger.info('[STREAM] Clearing isResetting')
          this.isResetting = false
        }, 500)
      }
      this.startLoop()
    })

    this.ffmpeg.on('stderr', (stdErrline) => {
      Logger.info(stdErrline)
    })

    this.ffmpeg.on('error', (err, stdout, stderr) => {
      if (err.message && err.message.includes('SIGKILL')) {
        // This is an intentional SIGKILL
        Logger.info('[FFMPEG] Transcode Killed')
        this.ffmpeg = null
      } else {
        Logger.error('Ffmpeg Err', err.message)
      }
    })

    this.ffmpeg.on('end', (stdout, stderr) => {
      Logger.info('[FFMPEG] Transcoding ended')
      this.isTranscodeComplete = true
      this.ffmpeg = null
    })

    this.ffmpeg.run()
  }

  async startConcat() {
    Logger.info(`[STREAM] START STREAM - Num Segments: ${this.numSegments}`)


    var concatOutput = null
    if (this.tracks.length > 1) {
      var start = Date.now()
      await new Promise(async (resolve) => {
        Logger.info('Concatenating here', this.tracks.length)

        this.ffmpeg = Ffmpeg()
        var trackExt = this.tracks[0].ext
        concatOutput = Path.join(this.streamPath, `concat${trackExt}`)
        Logger.info('Concat OUTPUT', concatOutput)
        var trackPaths = this.tracks.map(t => {
          var line = 'file ' + this.escapeSingleQuotes(t.fullPath) + '\n' + `duration ${t.duration}`
          return line
        })
        var inputstr = trackPaths.join('\n\n')
        await fs.writeFile(this.concatFilesPath, inputstr)
        this.ffmpeg.addInput(this.concatFilesPath)
        this.ffmpeg.inputFormat('concat')
        this.ffmpeg.inputOption('-safe 0')
        this.ffmpeg.addOption([
          '-loglevel warning',
          '-map 0:a',
          '-c:a copy'
        ])
        this.ffmpeg.output(concatOutput)

        this.ffmpeg.on('start', (command) => {
          Logger.info('[CONCAT] FFMPEG transcoding started with command: ' + command)
        })
        this.ffmpeg.on('error', (err, stdout, stderr) => {
          Logger.info('[CONCAT] ERROR', err, stderr)
        })

        this.ffmpeg.on('end', (stdout, stderr) => {
          Logger.info('[CONCAT] Concat is done')
          resolve()
        })
        this.ffmpeg.run()
      })
      var elapsed = ((Date.now() - start) / 1000).toFixed(1)
      Logger.info(`[CONCAT] Final elapsed is ${elapsed}s`)
    } else {
      concatOutput = this.tracks[0].fullPath
    }


    this.ffmpeg = Ffmpeg()

    // var currTrackEnd = 0
    // var startingTrack = this.tracks.find(t => {
    //   currTrackEnd += t.duration
    //   return this.startTime < currTrackEnd
    // })
    // var trackStartTime = currTrackEnd - startingTrack.duration
    // var currInpoint = this.startTime - trackStartTime

    // var tracksToInclude = this.tracks.filter(t => t.index >= startingTrack.index)

    // var trackPaths = tracksToInclude.map(t => {
    //   var line = 'file ' + this.escapeSingleQuotes(t.fullPath) + '\n' + `duration ${t.duration}`
    //   if (t.index === startingTrack.index) {
    //     line += `\ninpoint ${currInpoint}`
    //   }
    //   return line
    // })
    // var inputstr = trackPaths.join('\n\n')
    // await fs.writeFile(this.concatFilesPath, inputstr)

    this.ffmpeg.addInput(concatOutput)
    // this.ffmpeg.inputFormat('concat')
    // this.ffmpeg.inputOption('-safe 0')

    if (this.startTime > 0) {
      Logger.info(`[STREAM] Starting Stream at startTime ${secondsToTimestamp(this.startTime)} and Segment #${this.segmentStartNumber}`)
      this.ffmpeg.inputOption(`-ss ${this.startTime}`)
      this.ffmpeg.inputOption('-noaccurate_seek')
    }

    this.ffmpeg.addOption([
      '-loglevel warning',
      '-map 0:a',
      '-c:a copy'
    ])
    this.ffmpeg.addOption([
      '-f hls',
      "-copyts",
      "-avoid_negative_ts disabled",
      "-max_delay 5000000",
      "-max_muxing_queue_size 2048",
      `-hls_time 6`,
      "-hls_segment_type mpegts",
      `-start_number ${this.segmentStartNumber}`,
      "-hls_playlist_type vod",
      "-hls_list_size 0",
      "-hls_allow_cache 0"
    ])
    var segmentFilename = Path.join(this.streamPath, this.segmentBasename)
    this.ffmpeg.addOption(`-hls_segment_filename ${segmentFilename}`)
    this.ffmpeg.output(this.playlistPath)

    this.ffmpeg.on('start', (command) => {
      Logger.info('[INFO] FFMPEG transcoding started with command: ' + command)
      if (this.isResetting) {
        setTimeout(() => {
          Logger.info('[STREAM] Clearing isResetting')
          this.isResetting = false
        }, 500)
      }
      this.startLoop()
    })

    this.ffmpeg.on('stderr', (stdErrline) => {
      Logger.info(stdErrline)
    })

    this.ffmpeg.on('error', (err, stdout, stderr) => {
      if (err.message && err.message.includes('SIGKILL')) {
        // This is an intentional SIGKILL
        Logger.info('[FFMPEG] Transcode Killed')
        this.ffmpeg = null
      } else {
        Logger.error('Ffmpeg Err', err.message)
      }
    })

    this.ffmpeg.on('end', (stdout, stderr) => {
      Logger.info('[FFMPEG] Transcoding ended')
      this.isTranscodeComplete = true
      this.ffmpeg = null
    })

    this.ffmpeg.run()
  }

  async close() {
    clearInterval(this.loop)

    Logger.info('Closing Stream', this.id)
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGKILL')
    }

    await fs.remove(this.streamPath).then(() => {
      Logger.info('Deleted session data', this.streamPath)
    }).catch((err) => {
      Logger.error('Failed to delete session data', err)
    })

    this.client.socket.emit('stream_closed', this.id)

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
    this.clientCurrentTime = this.startTime
    Logger.info(`Stream Reset New Start Time ${secondsToTimestamp(this.startTime)}`)
    this.start()
  }
}
module.exports = Stream