const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')
const Logger = require('../../../server/Logger')
const GoogleBooks = require('../../../server/providers/GoogleBooks')
const AudiobookCovers = require('../../../server/providers/AudiobookCovers')
const iTunes = require('../../../server/providers/iTunes')

describe('provider response compatibility', () => {
  let get
  beforeEach(() => {
    get = sinon.stub(axios, 'get')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'debug')
  })
  afterEach(() => sinon.restore())

  it('keeps Google ISBN preference, last cover and publisherDate mapping', async () => {
    const item = { id: 'g', volumeInfo: { title: 'Book', authors: ['A', 'B'], publisherDate: '2001-02', publishedDate: '1999', industryIdentifiers: [{ type: 'ISBN_10', identifier: '10' }, { type: 'ISBN_13', identifier: '13' }], imageLinks: { small: 'http://small', large: 'http://large' }, categories: ['Fiction'] } }
    get.resolves({ data: { items: [item, { id: 'empty' }] } })
    const results = await new GoogleBooks().search('A & B', 'Writer', 0)
    expect(results[0]).to.include({ id: 'g', title: 'Book', author: 'A, B', publishedYear: '2001', isbn: '13', cover: 'https://large' })
    expect(results[1]).to.equal(null)
    expect(get.firstCall.args).to.deep.equal(['https://www.googleapis.com/books/v1/volumes?q=intitle:A%20%26%20B+inauthor:Writer', { timeout: 10000 }])
  })
  it('keeps Google absent-volume fields and failures', async () => {
    const provider = new GoogleBooks()
    expect(provider.cleanResult({ volumeInfo: {} })).to.include({ subtitle: null, author: null, isbn: null, cover: null, genres: null })
    get.resolves({ data: {} })
    expect(await provider.search('Book', '')).to.deep.equal([])
    get.rejects(new Error('offline'))
    expect(await provider.search('Book', '')).to.deep.equal([])
  })
  it('maps original PNG covers and uses query params', async () => {
    get.resolves({ data: [{ versions: { png: { original: 'cover' } } }] })
    expect(await new AudiobookCovers().search('A & B', NaN)).to.deep.equal([{ cover: 'cover' }])
    expect(get.firstCall.args[1].params.get('q')).to.equal('A & B')
    expect(get.firstCall.args[1].timeout).to.equal(10000)
    get.rejects(new Error('offline'))
    expect(await new AudiobookCovers().search('Book')).to.deep.equal([])
  })
  it('retains malformed cover response rejection', async () => {
    get.resolves({ data: [{}] })
    let error
    try { await new AudiobookCovers().search('Book') } catch (err) { error = err }
    expect(error).to.be.instanceOf(TypeError)
  })
  it('preserves iTunes synchronous empty term and request errors', async () => {
    const provider = new iTunes()
    expect(provider.search({ term: '' })).to.deep.equal([])
    expect(get.called).to.equal(false)
    expect(() => provider.searchAudiobooks('')).to.throw(TypeError)
    expect(() => provider.searchPodcasts('')).to.throw(TypeError)
    get.rejects(new Error('offline'))
    expect(await provider.searchAudiobooks('Book')).to.deep.equal([])
  })
  it('keeps artwork order and square fallback', () => {
    const provider = new iTunes()
    expect(provider.getCoverArtwork({ artworkUrl600: '600', artworkUrl1000: '1000' })).to.equal('600')
    expect(provider.getCoverArtwork({ artworkUrl1000: '1000', artworkUrl800: '800' })).to.equal('1000')
    expect(provider.getCoverArtwork({ artworkUrl100: 'image/100x100bb.jpg' })).to.equal('image/600x600bb.jpg')
    expect(provider.getCoverArtwork({ artworkUrl100: 'a', artworkUrl200: 'b' })).to.equal('b')
    expect(provider.getCoverArtwork({})).to.equal(null)
  })
  it('maps audiobook and podcast response fields without changing numeric IDs', async () => {
    const provider = new iTunes()
    const data = { collectionId: 42, artistId: 7, collectionName: 'Title', artistName: 'A & B', description: '<p>Text</p><script>bad</script>', releaseDate: '2004-01', primaryGenreName: 'Fiction', artworkUrl600: 'cover', feedUrl: 'feed', collectionViewUrl: 'page', trackCount: 5, trackExplicitness: 'explicit' }
    expect(provider.cleanAudiobook(data)).to.include({ id: 42, artistId: 7, author: 'A, B', publishedYear: '2004', cover: 'cover' })
    get.resolves({ data: { results: [data] } })
    const [podcast] = await provider.searchPodcasts('Title', { country: 'NZ' })
    expect(podcast).to.include({ id: 42, artistId: 7, description: '<p>Text</p>', descriptionPlain: 'Text', trackCount: 5, explicit: true, feedUrl: 'feed', pageUrl: 'page' })
    expect(get.firstCall.args[1].params).to.include({ country: 'NZ', term: 'Title', entity: 'podcast' })
  })
})
