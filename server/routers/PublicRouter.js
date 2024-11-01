const express = require('express')
const ShareController = require('../controllers/ShareController')

class PublicRouter {
  constructor(playbackSessionManager) {
    /** @type {import('../managers/PlaybackSessionManager')} */
    this.playbackSessionManager = playbackSessionManager

    this.router = express()
    this.router.disable('x-powered-by')
    this.init()
  }

  init() {
    this.router.get('/share/:slug', ShareController.getMediaItemShareBySlug.bind(this))
    this.router.get('/share/:slug/track/:index', ShareController.getMediaItemShareAudioTrack.bind(this))
    this.router.get('/share/:slug/cover', ShareController.getMediaItemShareCoverImage.bind(this))
    this.router.patch('/share/:slug/progress', ShareController.updateMediaItemShareProgress.bind(this))
  }
}
module.exports = PublicRouter
