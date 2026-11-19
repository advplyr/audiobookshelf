const { expect } = require('chai')
const Database = require('../../server/Database')

describe('TextSearchQuery.matchExpression', () => {
  const fakeSequelize = { escape: (v) => `'${v}'` }

  it('escapes LIKE wildcards in the query', () => {
    const tsq = new Database.TextSearchQuery(fakeSequelize, false, 'Vol_me')
    expect(tsq.matchExpression('book.title')).to.equal("book.title LIKE '%Vol\\_me%' ESCAPE '\\'")
  })

  it('escapes %, _ and backslashes', () => {
    const tsq = new Database.TextSearchQuery(fakeSequelize, false, '100%_a\\b')
    expect(tsq.matchExpression('book.title')).to.equal("book.title LIKE '%100\\%\\_a\\\\b%' ESCAPE '\\'")
  })

  it('keeps plain queries working', () => {
    const tsq = new Database.TextSearchQuery(fakeSequelize, false, 'dune')
    expect(tsq.matchExpression('book.title')).to.equal("book.title LIKE '%dune%' ESCAPE '\\'")
  })

  it('matches the unaccent-normalized column when supported and the query has no accents', () => {
    const tsq = new Database.TextSearchQuery(fakeSequelize, true, 'Vol_me')
    tsq.hasAccents = false
    expect(tsq.matchExpression('book.title')).to.equal("unaccent(book.title) LIKE '%Vol\\_me%' ESCAPE '\\'")
  })

  it('matches the raw column when the query has accents', () => {
    const tsq = new Database.TextSearchQuery(fakeSequelize, true, 'café')
    tsq.hasAccents = true
    expect(tsq.matchExpression('book.title')).to.equal("book.title LIKE '%café%' ESCAPE '\\'")
  })

})
