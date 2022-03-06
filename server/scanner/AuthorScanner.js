const AuthorFinder = require('../finders/AuthorFinder')

class AuthorScanner {
  constructor(db) {
    this.db = db
    this.authorFinder = new AuthorFinder()
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