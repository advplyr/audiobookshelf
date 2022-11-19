class SearchController {
  constructor() { }

  async findBooks(req, res) {
    var provider = req.query.provider || 'google'
    var title = req.query.title || ''
    var author = req.query.author || ''
    var results = await this.bookFinder.search(provider, title, author)
    res.json(results)
  }

  async findCovers(req, res) {
    var query = req.query
    var podcast = query.podcast == 1

    var result = null
    if (podcast) result = await this.podcastFinder.findCovers(query.title)
    else result = await this.bookFinder.findCovers(query.provider, query.title, query.author || null)
    res.json(result)
  }

  async findPodcasts(req, res) {
    var term = req.query.term
    var results = await this.podcastFinder.search(term)
    res.json(results)
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