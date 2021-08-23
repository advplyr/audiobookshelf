const express = require('express')
const Logger = require('./Logger')

class ApiController {
  constructor(db, scanner, auth, streamManager, rssFeeds, emitter) {
    this.db = db
    this.scanner = scanner
    this.auth = auth
    this.streamManager = streamManager
    this.rssFeeds = rssFeeds
    this.emitter = emitter

    this.router = express()
    this.init()
  }

  init() {
    this.router.get('/find/covers', this.findCovers.bind(this))
    this.router.get('/find/:method', this.find.bind(this))

    this.router.get('/audiobooks', this.getAudiobooks.bind(this))
    this.router.delete('/audiobooks', this.deleteAllAudiobooks.bind(this))

    this.router.get('/audiobook/:id', this.getAudiobook.bind(this))
    this.router.delete('/audiobook/:id', this.deleteAudiobook.bind(this))
    this.router.patch('/audiobook/:id/tracks', this.updateAudiobookTracks.bind(this))
    this.router.patch('/audiobook/:id', this.updateAudiobook.bind(this))

    this.router.get('/metadata/:id/:trackIndex', this.getMetadata.bind(this))
    this.router.patch('/match/:id', this.match.bind(this))

    this.router.get('/users', this.getUsers.bind(this))
    this.router.delete('/user/audiobook/:id', this.resetUserAudiobookProgress.bind(this))
    this.router.patch('/user/password', this.userChangePassword.bind(this))

    this.router.post('/authorize', this.authorize.bind(this))

    this.router.get('/genres', this.getGenres.bind(this))

    this.router.post('/feed', this.openRssFeed.bind(this))
  }

  find(req, res) {
    this.scanner.find(req, res)
  }

  findCovers(req, res) {
    this.scanner.findCovers(req, res)
  }

  async getMetadata(req, res) {
    var metadata = await this.scanner.fetchMetadata(req.params.id, req.params.trackIndex)
    res.json(metadata)
  }

  authorize(req, res) {
    if (!req.user) {
      Logger.error('Invalid user in authorize')
      return res.sendStatus(401)
    }
    res.json({ user: req.user })
  }

  getAudiobooks(req, res) {
    var audiobooks = []
    if (req.query.q) {
      audiobooks = this.db.audiobooks.filter(ab => {
        return ab.isSearchMatch(req.query.q)
      }).map(ab => ab.toJSONMinified())
    } else {
      audiobooks = this.db.audiobooks.map(ab => ab.toJSONMinified())
    }
    res.json(audiobooks)
  }

  async deleteAllAudiobooks(req, res) {
    Logger.info('Removing all Audiobooks')
    var success = await this.db.recreateAudiobookDb()
    if (success) res.sendStatus(200)
    else res.sendStatus(500)
  }

  getAudiobook(req, res) {
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)
    res.json(audiobook.toJSONExpanded())
  }

  async deleteAudiobook(req, res) {
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)

    // Remove audiobook from users
    for (let i = 0; i < this.db.users.length; i++) {
      var user = this.db.users[i]
      var madeUpdates = user.resetAudiobookProgress(audiobook.id)
      if (madeUpdates) {
        await this.db.updateEntity('user', user)
      }
    }

    // remove any streams open for this audiobook
    var streams = this.streamManager.streams.filter(stream => stream.audiobookId === audiobook.id)
    for (let i = 0; i < streams.length; i++) {
      var stream = streams[i]
      var client = stream.client
      await stream.close()
      if (client && client.user) {
        client.user.stream = null
        client.stream = null
        this.db.updateUserStream(client.user.id, null)
      }
    }

    await this.db.removeEntity('audiobook', audiobook.id)

    this.emitter('audiobook_removed', audiobook.toJSONMinified())
    res.sendStatus(200)
  }

  async updateAudiobookTracks(req, res) {
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)
    var files = req.body.files
    Logger.info(`Updating audiobook tracks called ${audiobook.id}`)
    audiobook.updateAudioTracks(files)
    await this.db.updateAudiobook(audiobook)
    this.emitter('audiobook_updated', audiobook.toJSONMinified())
    res.json(audiobook.toJSON())
  }

  async updateAudiobook(req, res) {
    var audiobook = this.db.audiobooks.find(a => a.id === req.params.id)
    if (!audiobook) return res.sendStatus(404)
    var hasUpdates = audiobook.update(req.body)
    if (hasUpdates) {
      await this.db.updateAudiobook(audiobook)
    }
    this.emitter('audiobook_updated', audiobook.toJSONMinified())
    res.json(audiobook.toJSON())
  }

  async match(req, res) {
    var body = req.body
    var audiobookId = req.params.id
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    var bookData = {
      olid: body.id,
      publish_year: body.first_publish_year,
      description: body.description,
      title: body.title,
      author: body.author,
      cover: body.cover
    }
    audiobook.setBook(bookData)
    await this.db.updateAudiobook(audiobook)

    this.emitter('audiobook_updated', audiobook.toJSONMinified())

    res.sendStatus(200)
  }

  getUsers(req, res) {
    if (req.user.type !== 'root') return res.sendStatus(403)
    return res.json(this.db.users.map(u => u.toJSONForBrowser()))
  }

  async resetUserAudiobookProgress(req, res) {
    req.user.resetAudiobookProgress(req.params.id)
    await this.db.updateEntity('user', req.user)
    this.emitter('user_updated', req.user.toJSONForBrowser())
    res.sendStatus(200)
  }

  userChangePassword(req, res) {
    this.auth.userChangePassword(req, res)
  }

  async openRssFeed(req, res) {
    var audiobookId = req.body.audiobookId
    var audiobook = this.db.audiobooks.find(ab => ab.id === audiobookId)
    if (!audiobook) return res.sendStatus(404)
    var feed = await this.rssFeeds.openFeed(audiobook)
    console.log('Feed open', feed)
    res.json(feed)
  }

  getGenres(req, res) {
    res.json({
      genres: this.db.getGenres()
    })
  }
}
module.exports = ApiController