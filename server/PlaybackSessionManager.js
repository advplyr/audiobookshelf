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

  async startSessionRequest(req, res) {
    var user = req.user
    var libraryItem = req.libraryItem
    var options = req.query || {}
    const session = await this.startSession(user, libraryItem, options)
    res.json(session)
  }

  async startSession(user, libraryItem, options) {
    // TODO: Determine what play method to use and setup playback session
    //    temporary client can pass direct=1 in query string for direct play
    if (options.direct) {
      var tracks = libraryItem.media.getDirectPlayTracklist(options)
    }

    const newPlaybackSession = new PlaybackSession()
    newPlaybackSession.setData(libraryItem, user)
    this.sessions.push(newPlaybackSession)
    return newPlaybackSession
  }
}
module.exports = PlaybackSessionManager