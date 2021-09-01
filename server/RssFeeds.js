const Podcast = require('podcast')
const express = require('express')
const ip = require('ip')
const Logger = require('./Logger')

// Not functional at the moment - just an idea
class RssFeeds {
  constructor(Port, db) {
    this.Port = Port
    this.db = db
    this.feeds = {}

    this.router = express()
    this.init()
  }

  init() {
    this.router.get('/:id', this.getFeed.bind(this))
  }

  getFeed(req, res) {
    var feed = this.feeds[req.params.id]
    if (!feed) return null
    var xml = feed.buildXml()
    res.set('Content-Type', 'text/xml')
    res.send(xml)
  }

  openFeed(audiobook) {
    var serverAddress = 'http://' + ip.address('public', 'ipv4') + ':' + this.Port
    Logger.info('Open RSS Feed', 'Server address', serverAddress)

    var feedId = (Date.now() + Math.floor(Math.random() * 1000)).toString(36)
    const feed = new Podcast({
      title: audiobook.title,
      description: 'AudioBookshelf RSS Feed',
      feedUrl: `${serverAddress}/feeds/${feedId}`,
      imageUrl: `${serverAddress}/Logo.png`,
      author: 'advplyr',
      language: 'en'
    })
    audiobook.tracks.forEach((track) => {
      feed.addItem({
        title: `Track ${track.index}`,
        description: `AudioBookshelf Audiobook Track #${track.index}`,
        url: `${serverAddress}/feeds/${feedId}?track=${track.index}`,
        author: 'advplyr'
      })
    })
    this.feeds[feedId] = feed
    return feed
  }
}
module.exports = RssFeeds