const express = require('express')
const Path = require('path')

const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')

const fs = require('../libs/fsExtra')


class HlsRouter {
  constructor(db, auth, playbackSessionManager) {
    this.db = db
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

  async streamFileRequest(req, res) {
    var streamId = req.params.stream
    var fullFilePath = Path.join(this.playbackSessionManager.StreamsPath, streamId, req.params.file)

    var exists = await fs.pathExists(fullFilePath)
    if (!exists) {
      Logger.warn('File path does not exist', fullFilePath)

      var fileExt = Path.extname(req.params.file)
      if (fileExt === '.ts' || fileExt === '.m4s') {
        var segNum = this.parseSegmentFilename(req.params.file)
        var stream = this.playbackSessionManager.getStream(streamId)
        if (!stream) {
          Logger.error(`[HlsRouter] Stream ${streamId} does not exist`)
          return res.sendStatus(500)
        }

        if (stream.isResetting) {
          Logger.info(`[HlsRouter] Stream ${streamId} is currently resetting`)
          return res.sendStatus(404)
        } else {
          var startTimeForReset = await stream.checkSegmentNumberRequest(segNum)
          if (startTimeForReset) {
            // HLS.js will restart the stream at the new time
            Logger.info(`[HlsRouter] Resetting Stream - notify client @${startTimeForReset}s`)
            SocketAuthority.emitter('stream_reset', {
              startTime: startTimeForReset,
              streamId: stream.id
            })
            return res.sendStatus(500)
          }
        }
      }
    }

    // Logger.info('Sending file', fullFilePath)
    res.sendFile(fullFilePath)
  }
}
module.exports = HlsRouter