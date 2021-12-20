const Stream = require('./objects/Stream')
// const StreamTest = require('./test/StreamTest')
const Logger = require('./Logger')
const fs = require('fs-extra')
const Path = require('path')

class StreamManager {
  constructor(db, MetadataPath, emitter, clientEmitter) {
    this.db = db

    this.emitter = emitter
    this.clientEmitter = clientEmitter

    this.MetadataPath = MetadataPath
    this.streams = []
    this.StreamsPath = Path.join(this.MetadataPath, 'streams')
  }

  get audiobooks() {
    return this.db.audiobooks
  }

  getStream(streamId) {
    return this.streams.find(s => s.id === streamId)
  }

  removeStream(stream) {
    this.streams = this.streams.filter(s => s.id !== stream.id)
  }

  async openStream(client, audiobook, transcodeOptions = {}) {
    if (!client || !client.user) {
      Logger.error('[StreamManager] Cannot open stream invalid client', client)
      return
    }
    var stream = new Stream(this.StreamsPath, client, audiobook, transcodeOptions)

    stream.on('closed', () => {
      this.removeStream(stream)
    })

    this.streams.push(stream)

    await stream.generatePlaylist()
    stream.start()

    Logger.info('Stream Opened for client', client.user.username, 'for audiobook', audiobook.title, 'with streamId', stream.id)

    client.stream = stream
    client.user.stream = stream.id

    return stream
  }

  ensureStreamsDir() {
    return fs.ensureDir(this.StreamsPath)
  }

  removeOrphanStreamFiles(streamId) {
    try {
      var StreamsPath = Path.join(this.StreamsPath, streamId)
      return fs.remove(StreamsPath)
    } catch (error) {
      Logger.debug('No orphan stream', streamId)
      return false
    }
  }

  async tempCheckStrayStreams() {
    try {
      var dirs = await fs.readdir(this.MetadataPath)
      if (!dirs || !dirs.length) return true

      await Promise.all(dirs.map(async (dirname) => {
        if (dirname !== 'streams' && dirname !== 'books' && dirname !== 'downloads' && dirname !== 'backups' && dirname !== 'logs' && dirname !== 'cache') {
          var fullPath = Path.join(this.MetadataPath, dirname)
          Logger.warn(`Removing OLD Orphan Stream ${dirname}`)
          return fs.remove(fullPath)
        }
      }))

      return true
    } catch (error) {
      Logger.debug('No old orphan streams', error)
      return false
    }
  }

  async removeOrphanStreams() {
    await this.tempCheckStrayStreams()
    try {
      var dirs = await fs.readdir(this.StreamsPath)
      if (!dirs || !dirs.length) return true

      await Promise.all(dirs.map(async (dirname) => {
        var fullPath = Path.join(this.StreamsPath, dirname)
        Logger.info(`Removing Orphan Stream ${dirname}`)
        return fs.remove(fullPath)
      }))
      return true
    } catch (error) {
      Logger.debug('No orphan stream', error)
      return false
    }
  }

  async openStreamApiRequest(res, user, audiobook) {
    Logger.info(`[StreamManager] User "${user.username}" open stream request for "${audiobook.title}"`)
    var client = {
      user
    }
    var stream = await this.openStream(client, audiobook)
    this.db.updateUserStream(client.user.id, stream.id)

    res.json({
      audiobookId: audiobook.id,
      startTime: stream.startTime,
      streamId: stream.id,
      streamUrl: stream.clientPlaylistUri
    })
  }

  async openStreamSocketRequest(socket, audiobookId) {
    Logger.info('[StreamManager] Open Stream Request', socket.id, audiobookId)
    var audiobook = this.audiobooks.find(ab => ab.id === audiobookId)
    var client = socket.sheepClient

    if (client.stream) {
      Logger.info('Closing client stream first', client.stream.id)
      await client.stream.close()
      client.user.stream = null
      client.stream = null
    }

    var stream = await this.openStream(client, audiobook)
    this.db.updateUserStream(client.user.id, stream.id)

    this.emitter('user_stream_update', client.user.toJSONForPublic(this.streams))
  }

  async closeStreamRequest(socket) {
    Logger.info('Close Stream Request', socket.id)
    var client = socket.sheepClient
    if (!client || !client.stream) {
      Logger.error('No stream for client', (client && client.user) ? client.user.username : 'No Client')
      client.socket.emit('stream_closed', 'n/a')
      return
    }
    // var streamId = client.stream.id
    await client.stream.close()
    client.user.stream = null
    client.stream = null
    this.db.updateUserStream(client.user.id, null)

    this.emitter('user_stream_update', client.user.toJSONForPublic(this.streams))
  }

  streamSync(socket, syncData) {
    const client = socket.sheepClient
    if (!client || !client.stream) {
      Logger.error('[StreamManager] streamSync: No stream for client', (client && client.user) ? client.user.id : 'No Client')
      return
    }
    if (client.stream.id !== syncData.streamId) {
      Logger.error('[StreamManager] streamSync: Stream id mismatch on stream update', syncData.streamId, client.stream.id)
      return
    }
    if (!client.user) {
      Logger.error('[StreamManager] streamSync: No User for client', client)
      return
    }
    // const { timeListened, currentTime, streamId } = syncData
    var listeningSession = client.stream.syncStream(syncData)

    if (listeningSession && listeningSession.timeListening > 0) {
      // Save listening session
      var existingListeningSession = this.db.sessions.find(s => s.id === listeningSession.id)
      if (existingListeningSession) {
        this.db.updateEntity('session', listeningSession)
      } else {
        this.db.sessions.push(listeningSession.toJSON()) // Insert right away to prevent duplicate session
        this.db.insertEntity('session', listeningSession)
      }
    }

    var userAudiobook = client.user.updateAudiobookProgressFromStream(client.stream)
    this.db.updateEntity('user', client.user)

    if (userAudiobook) {
      this.clientEmitter(client.user.id, 'current_user_audiobook_update', {
        id: userAudiobook.audiobookId,
        data: userAudiobook.toJSON()
      })
    }
  }

  streamSyncFromApi(req, res) {
    var user = req.user
    var syncData = req.body

    var stream = this.streams.find(s => s.id === syncData.streamId)
    if (!stream) {
      Logger.error(`[StreamManager] streamSyncFromApi stream not found ${syncData.streamId}`)
      return res.status(404).send('Stream not found')
    }
    if (stream.userToken !== user.token) {
      Logger.error(`[StreamManager] streamSyncFromApi Invalid stream not owned by user`)
      return res.status(500).send('Invalid stream auth')
    }

    var listeningSession = stream.syncStream(syncData)

    if (listeningSession && listeningSession.timeListening > 0) {
      // Save listening session
      var existingListeningSession = this.db.sessions.find(s => s.id === listeningSession.id)
      if (existingListeningSession) {
        this.db.updateEntity('session', listeningSession)
      } else {
        this.db.sessions.push(listeningSession.toJSON()) // Insert right away to prevent duplicate session
        this.db.insertEntity('session', listeningSession)
      }
    }

    var userAudiobook = user.updateAudiobookProgressFromStream(stream)
    this.db.updateEntity('user', user)

    if (userAudiobook) {
      this.clientEmitter(user.id, 'current_user_audiobook_update', {
        id: userAudiobook.audiobookId,
        data: userAudiobook.toJSON()
      })
    }

    res.sendStatus(200)
  }

  streamUpdate(socket, { currentTime, streamId }) {
    var client = socket.sheepClient
    if (!client || !client.stream) {
      Logger.error('No stream for client', (client && client.user) ? client.user.id : 'No Client')
      return
    }
    if (client.stream.id !== streamId) {
      Logger.error('Stream id mismatch on stream update', streamId, client.stream.id)
      return
    }
    client.stream.updateClientCurrentTime(currentTime)
    if (!client.user) {
      Logger.error('No User for client', client)
      return
    }
    if (!client.user.updateAudiobookProgressFromStream) {
      Logger.error('Invalid User for client', client)
      return
    }
    var userAudiobook = client.user.updateAudiobookProgressFromStream(client.stream)
    this.db.updateEntity('user', client.user)

    if (userAudiobook) {
      this.clientEmitter(client.user.id, 'current_user_audiobook_update', {
        id: userAudiobook.audiobookId,
        data: userAudiobook.toJSON()
      })
    }
  }
}
module.exports = StreamManager