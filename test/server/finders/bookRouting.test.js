const { expect } = require('chai')
const sinon = require('sinon')
const finder = require('../../../server/finders/BookFinder')
const Logger = require('../../../server/Logger')

describe('BookFinder provider routing compatibility', () => {
  beforeEach(() => { sinon.stub(Logger, 'debug'); sinon.stub(Logger, 'error') })
  afterEach(() => sinon.restore())
  it('keeps custom-provider bypass and failure swallowing', async () => {
    const search = sinon.stub(finder.customProviderAdapter, 'search').resolves([{ title: 'Custom' }])
    expect(await finder.search(null, 'custom-1', '', '', 'isbn', '')).to.deep.equal([{ title: 'Custom' }])
    expect(search.firstCall.args).to.deep.equal(['', '', 'isbn', 'custom-1', 'book', 10000])
    search.rejects(new Error('offline'))
    expect(await finder.search(null, 'custom-1', 'Title', '', '', '')).to.deep.equal([])
  })
  it('keeps provider result mutation and default Google routing', async () => {
    const book = { title: 'Title', description: '<p>Text</p><script>bad</script>' }
    sinon.stub(finder.googleBooks, 'search').resolves([book])
    expect(await finder.runSearch('Title', '', 'unknown', '', 4, 4)).to.deep.equal([{ title: 'Title', description: '<p>Text</p>', descriptionPlain: 'Text' }])
    expect(book.description).to.equal('<p>Text</p>')
  })
  it('keeps legacy cover argument position and stable cover deduplication', async () => {
    const options = { maxFuzzySearches: 0 }
    const search = sinon.stub(finder, 'search').resolves([{ covers: ['a', 'b'], cover: 'a' }, { cover: 'c' }])
    expect(await finder.findCovers('google', 'Title', 'Writer', options)).to.deep.equal(['a', 'b', 'c'])
    expect(search.firstCall.args).to.deep.equal([null, 'google', 'Title', 'Writer', options])
  })
  it('retains failure for a Google null entry instead of silently dropping it', async () => {
    sinon.stub(finder.googleBooks, 'search').resolves([null])
    let thrown
    try { await finder.runSearch('Title', '', 'google', '', 4, 4) } catch (error) { thrown = error }
    expect(thrown).to.be.instanceOf(TypeError)
  })
})
