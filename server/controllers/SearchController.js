const Logger = require("../Logger")

class SearchController {
  constructor() { }

  async findBooks(req, res) {
    const provider = req.query.provider || 'google'
    const title = req.query.title || ''
    const author = req.query.author || ''
    const results = await this.bookFinder.search(provider, title, author)
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
    if (podcast) results = await this.podcastFinder.findCovers(query.title)
    else results = await this.bookFinder.findCovers(query.provider || 'google', query.title, query.author || null)
    res.json({
      results
    })
  }

  async findPodcasts(req, res) {
    const term = req.query.term
    const results = await this.podcastFinder.search(term)
    res.json(results)
  }

  async findAuthor(req, res) {
    const query = req.query.q
    const author = await this.authorFinder.findAuthorByName(query)
    res.json(author)
  }

  async findChapters(req, res) {
    const asin = req.query.asin
    const region = (req.query.region || 'us').toLowerCase()
    const chapterData = await this.bookFinder.findChapters(asin, region)
    if (!chapterData) {
      return res.json({ error: 'Chapters not found' })
    }
    res.json(chapterData)
  }
}
module.exports = new SearchController()