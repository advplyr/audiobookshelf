import type { Request, Response } from 'express'
import type Auth from '../Auth'
import type PlaybackSessionManager from '../managers/PlaybackSessionManager'
import express from 'express'
import Path from 'path'

import Logger from '../Logger'
import SocketAuthority from '../SocketAuthority'

import fs from '../libs/fsExtra'


class HlsRouter {
  declare auth: Auth
  declare playbackSessionManager: PlaybackSessionManager
  declare router: express.Express

  constructor(auth: Auth, playbackSessionManager: PlaybackSessionManager) {
    this.auth = auth
    this.playbackSessionManager = playbackSessionManager

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    this.router.get('/:stream/:file', (req, res) => {
      void this.streamFileRequest(req, res)
    })
  }

  parseSegmentFilename(filename: string) {
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
  validateStreamFilePath(streamDir: string, filepath: string) {
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
  async streamFileRequest(req: Request<{ stream: string; file: string }>, res: Response) {
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
export = HlsRouter