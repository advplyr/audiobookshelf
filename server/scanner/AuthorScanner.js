const AuthorFinder = require('../AuthorFinder')

class AuthorScanner {
  constructor(db, MetadataPath) {
    this.db = db
    this.MetadataPath = MetadataPath
    this.authorFinder = new AuthorFinder(MetadataPath)
  }

  getUniqueAuthors() {
    var authorFls = this.db.audiobooks.map(b => b.book.authorFL)
    var authors = []
    authorFls.forEach((auth) => {
      authors = authors.concat(auth.split(', ').map(a => a.trim()))
    })
    return [...new Set(authors)]
  }

  async scanAuthors() {
    var authors = this.getUniqueAuthors()
    for (let i = 0; i < authors.length; i++) {
      var authorName = authors[i]
      var author = await this.authorFinder.getAuthorByName(authorName)
      if (!author) {
        return res.status(500).send('Failed to create author')
      }

      await this.db.insertEntity('author', author)
      this.emitter('author_added', author.toJSON())
    }
  }
}
module.exports = AuthorScanner