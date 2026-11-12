import type PlaybackSessionManager from '../managers/PlaybackSessionManager'
import express from 'express'
import ShareController from '../controllers/ShareController'
import SessionController from '../controllers/SessionController'

class PublicRouter {
  declare playbackSessionManager: PlaybackSessionManager
  declare router: express.Express

  constructor(playbackSessionManager: PlaybackSessionManager) {
    this.playbackSessionManager = playbackSessionManager

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    this.router.get('/share/:slug', (req, res) => {
      void ShareController.getMediaItemShareBySlug.call(this, req, res)
    })
    this.router.get('/share/:slug/track/:index', (req, res) => {
      void ShareController.getMediaItemShareAudioTrack.call(this, req, res)
    })
    this.router.get('/share/:slug/cover', (req, res) => {
      void ShareController.getMediaItemShareCoverImage.call(this, req, res)
    })
    this.router.get('/share/:slug/download', (req, res) => {
      void ShareController.downloadMediaItemShare.call(this, req, res)
    })
    this.router.patch('/share/:slug/progress', (req, res) => {
      void ShareController.updateMediaItemShareProgress.call(this, req, res)
    })
    this.router.get('/session/:id/track/:index', (req, res) => {
      void SessionController.getTrack.call(this, req, res)
    })
  }
}
export = PublicRouter
