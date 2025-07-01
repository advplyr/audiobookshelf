const express = require('express')
const ShareController = require('../controllers/ShareController')
const SessionController = require('../controllers/SessionController')
const KOReaderController = require('../controllers/KOReaderController')

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
    this.router.get('/share/:slug/download', ShareController.downloadMediaItemShare.bind(this))
    this.router.patch('/share/:slug/progress', ShareController.updateMediaItemShareProgress.bind(this))
    this.router.get('/session/:id/track/:index', SessionController.getTrack.bind(this))

    //
    // KOReader Routes
    //
    this.router.get('/users/auth', KOReaderController.authenticateUser.bind(this))
    this.router.post('/users/create', KOReaderController.createUser.bind(this))
    this.router.put('/syncs/progress', KOReaderController.updateProgress.bind(this))
    this.router.get('/syncs/progress/:documentHash', KOReaderController.getProgress.bind(this))
  }
}
module.exports = PublicRouter
