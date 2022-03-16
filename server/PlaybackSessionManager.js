const Path = require('path')
const PlaybackSession = require('./objects/PlaybackSession')

class PlaybackSessionManager {
  constructor(db, emitter, clientEmitter) {
    this.db = db
    this.StreamsPath = Path.join(global.MetadataPath, 'streams')
    this.emitter = emitter
    this.clientEmitter = clientEmitter

    this.sessions = []
  }

  startSessionRequest(req, res) {
    var user = req.user
    var libraryItem = req.libraryItem
    var options = req.query
    const session = this.startSession(user, libraryItem, options)
    res.json(session)
  }

  startSession(user, libraryItem, options) {
    // TODO: Determine what play method to use and setup playback session
    const newPlaybackSession = new PlaybackSession()
    this.sessions.push(newPlaybackSession)
    return newPlaybackSession
  }
}
module.exports = PlaybackSessionManager