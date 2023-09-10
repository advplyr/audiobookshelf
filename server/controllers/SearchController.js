const Logger = require("../Logger")
const BookFinder = require('../finders/BookFinder')
const PodcastFinder = require('../finders/PodcastFinder')
const AuthorFinder = require('../finders/AuthorFinder')
const MusicFinder = require('../finders/MusicFinder')

class SearchController {
  constructor() { }

  async findBooks(req, res) {
    const provider = req.query.provider || 'google'
    const title = req.query.title || ''
    const author = req.query.author || ''
    const results = await BookFinder.search(provider, title, author)
    res.json(results)
  }

  async findCovers(req, res) {
    const query = req.query
    const podcast = query.podcast == 1

    if (!query.title) {
      Logger.error(`[SearchController] findCovers: No title sent in query`)
      return res.sendStatus(400)
    }

    let results = null
    if (podcast) results = await PodcastFinder.findCovers(query.title)
    else results = await BookFinder.findCovers(query.provider || 'google', query.title, query.author || null)
    res.json({
      results
    })
  }

  async findPodcasts(req, res) {
    const term = req.query.term
    const results = await PodcastFinder.search(term)
    res.json(results)
  }

  async findAuthor(req, res) {
    const query = req.query.q
    const author = await AuthorFinder.findAuthorByName(query)
    res.json(author)
  }

  async findChapters(req, res) {
    const asin = req.query.asin
    const region = (req.query.region || 'us').toLowerCase()
    const chapterData = await BookFinder.findChapters(asin, region)
    if (!chapterData) {
      return res.json({ error: 'Chapters not found' })
    }
    res.json(chapterData)
  }

  async findMusicTrack(req, res) {
    const tracks = await MusicFinder.searchTrack(req.query || {})
    res.json({
      tracks
    })
  }
}
module.exports = new SearchController()