const Stream = require('./objects/Stream')
const StreamTest = require('./test/StreamTest')
const Logger = require('./Logger')
const fs = require('fs-extra')
const Path = require('path')

class StreamManager {
  constructor(db, STREAM_PATH) {
    this.db = db

    this.streams = []
    this.streamPath = STREAM_PATH
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
    var stream = new Stream(this.streamPath, client, audiobook)

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

  removeOrphanStreamFiles(streamId) {
    try {
      var streamPath = Path.join(this.streamPath, streamId)
      return fs.remove(streamPath)
    } catch (error) {
      Logger.debug('No orphan stream', streamId)
      return false
    }
  }

  async removeOrphanStreams() {
    try {
      var dirs = await fs.readdir(this.streamPath)
      if (!dirs || !dirs.length) return true

      await Promise.all(dirs.map(async (dirname) => {
        var fullPath = Path.join(this.streamPath, dirname)
        Logger.info(`Removing Orphan Stream ${dirname}`)
        return fs.remove(fullPath)
      }))
      return true
    } catch (error) {
      Logger.debug('No orphan stream', streamId)
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
  }

  async openTestStream(streamPath, audiobookId) {
    Logger.info('Open Stream Test Request', audiobookId)
    var audiobook = this.audiobooks.find(ab => ab.id === audiobookId)
    var stream = new StreamTest(streamPath, audiobook)

    stream.on('closed', () => {
      console.log('Stream closed')
    })

    var playlistUri = await stream.generatePlaylist()
    stream.start()

    Logger.info('Stream Playlist', playlistUri)
    Logger.info('Test Stream Opened for audiobook', audiobook.title, 'with streamId', stream.id)
    return playlistUri
  }

  streamUpdate(socket, { currentTime, streamId }) {
    var client = socket.sheepClient
    if (!client || !client.stream) {
      Logger.error('No stream for client', client.user.id)
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
    if (!client.user.updateAudiobookProgress) {
      Logger.error('Invalid User for client', client)
      return
    }
    client.user.updateAudiobookProgress(client.stream)
    this.db.updateEntity('user', client.user)
  }
}
module.exports = StreamManager