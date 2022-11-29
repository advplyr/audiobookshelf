const Logger = require("../Logger")

class SearchController {
  constructor() { }

  async findBooks(req, res) {
    var provider = req.query.provider || 'google'
    var title = req.query.title || ''
    var author = req.query.author || ''
    res.json({
      results: await this.bookFinder.search(provider, title, author)
    })
  }

  async findCovers(req, res) {
    var query = req.query
    const podcast = query.podcast == 1

    if (!query.title) {
      Logger.error(`[SearchController] findCovers: No title sent in query`)
      return res.sendStatus(400)
    }

    var result = null
    if (podcast) result = await this.podcastFinder.findCovers(query.title)
    else result = await this.bookFinder.findCovers(query.provider || 'google', query.title, query.author || null)
    res.json({
      results: result
    })
  }

  async findPodcasts(req, res) {
    var term = req.query.term
    res.json({
      results: await this.podcastFinder.search(term)
    })
  }

  async findAuthor(req, res) {
    var query = req.query.q
    var author = await this.authorFinder.findAuthorByName(query)
    res.json(author)
  }

  async findChapters(req, res) {
    var asin = req.query.asin
    var region = (req.query.region || 'us').toLowerCase()
    var chapterData = await this.bookFinder.findChapters(asin, region)
    if (!chapterData) {
      return res.json({ error: 'Chapters not found' })
    }
    res.json(chapterData)
  }
}
module.exports = new SearchController()