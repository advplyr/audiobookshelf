const express = require('express')
const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const fs = require('../libs/fsExtra')


class HlsRouter {
  constructor(auth, playbackSessionManager) {
    this.auth = auth
    this.playbackSessionManager = playbackSessionManager

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    this.router.get('/:stream/:file', this.streamFileRequest.bind(this))
  }

  parseSegmentFilename(filename) {
    var basename = Path.basename(filename, Path.extname(filename))
    var num_part = basename.split('-')[1]
    return Number(num_part)
  }

  /**
   * Ensure filepath is inside streamDir
   * Used to prevent arbitrary file reads
   * @see https://nodejs.org/api/path.html#pathrelativefrom-to
   * 
   * @param {string} streamDir 
   * @param {string} filepath 
   * @returns {boolean}
   */
  validateStreamFilePath(streamDir, filepath) {
    const relative = Path.relative(streamDir, filepath)
    return relative && !relative.startsWith('..') && !Path.isAbsolute(relative)
  }

  /**
   * GET /hls/:stream/:file
   * File must have extname .ts or .m3u8
   * 
   * @param {express.Request} req 
   * @param {express.Response} res 
   */
  async streamFileRequest(req, res) {
    const streamId = req.params.stream
    // Ensure stream is open
    const stream = this.playbackSessionManager.getStream(streamId)
    if (!stream) {
      Logger.error(`[HlsRouter] Stream "${streamId}" does not exist`)
      return res.sendStatus(404)
    }

    // Ensure stream filepath is valid
    const streamDir = Path.join(this.playbackSessionManager.StreamsPath, streamId)
    const fullFilePath = Path.join(streamDir, req.params.file)
    if (!this.validateStreamFilePath(streamDir, fullFilePath)) {
      Logger.error(`[HlsRouter] Invalid file parameter "${req.params.file}"`)
      return res.sendStatus(400)
    }

    const fileExt = Path.extname(req.params.file)
    if (fileExt !== '.ts' && fileExt !== '.m3u8') {
      Logger.error(`[HlsRouter] Invalid file parameter "${req.params.file}" extname. Must be .ts or .m3u8`)
      return res.sendStatus(400)
    }

    if (!(await fs.pathExists(fullFilePath))) {
      Logger.warn('File path does not exist', fullFilePath)

      if (fileExt === '.ts') {
        const segNum = this.parseSegmentFilename(req.params.file)

        if (stream.isResetting) {
          Logger.info(`[HlsRouter] Stream ${streamId} is currently resetting`)
        } else {
          const startTimeForReset = await stream.checkSegmentNumberRequest(segNum)
          if (startTimeForReset) {
            // HLS.js will restart the stream at the new time
            Logger.info(`[HlsRouter] Resetting Stream - notify client @${startTimeForReset}s`)
            SocketAuthority.emitter('stream_reset', {
              startTime: startTimeForReset,
              streamId: stream.id
            })
          }
        }
      }
      return res.sendStatus(404)
    }

    res.sendFile(fullFilePath)
  }
}
module.exports = HlsRouter