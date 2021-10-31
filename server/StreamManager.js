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

  async openStream(client, audiobook) {
    var stream = new Stream(this.StreamsPath, client, audiobook)

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
        if (dirname !== 'streams' && dirname !== 'books' && dirname !== 'downloads' && dirname !== 'backups' && dirname !== 'logs') {
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

  async openStreamSocketRequest(socket, audiobookId) {
    Logger.info('Open Stream Request', socket.id, audiobookId)
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