const http = require('http')
const AudiobookDB = require('../../../server/providers/AudiobookDB')
const AudiobookDBError = require('../../../server/providers/AudiobookDBError')
const bookFinder = require('../../../server/finders/BookFinder')
const Logger = require('../../../server/Logger')
const { expect } = require('chai')
const sinon = require('sinon')

async function expectProviderFailure(promise, code) {
  try {
    await promise
    expect.fail('Expected an AudiobookDB provider failure')
  } catch (error) {
    expect(error).to.be.instanceOf(AudiobookDBError)
    expect(error.code).to.equal(code)
    return error
  }
}

// BookDTO shape from GET /books/{id}: genres/tags are {id,title}, releases are
// BookReleaseRef entries that carry isbn when the release has one and omit it
// when blank. Two released editions of the same book (The Martian).
const bookWithReleases = {
  id: 'WQQDcMBQ3qUT',
  title: 'The Martian',
  description: '<p>Andy Weir</p>',
  coverImage: {
    url: 'https://cdn.audiobookdb.org/5b9dd618d7526bf4d08384d1506ca36e93515d8154df3f8485c6a93dc10c4045',
    sourceUrl: 'https://cdn.audiobookdb.org/5b9dd618d7526bf4d08384d1506ca36e93515d8154df3f8485c6a93dc10c4045/source.jpg:book',
    width: 2400,
    height: 2400
  },
  genres: [{ id: 'g1', title: 'Science' }],
  tags: [{ id: 't1', title: 'Astronomy' }],
  people: [{ role: { name: 'Author' }, person: { id: 'p1', name: 'Andy Weir' } }],
  series: [{ ordinal: '3', position: { value: '3', label: '3' }, series: { id: 's1', title: 'Mars' } }],
  releases: [
    {
      id: 'dPL9fC7YnK8X',
      duration: '10:53:35',
      releaseDate: '2013-03-22T00:00:00Z',
      publisher: { id: 'pub1', name: 'Podium Publishing' },
      language: { name: 'English' },
      people: [{ role: { name: 'Narrator' }, person: { id: 'n1', name: 'R.C. Bray' } }],
      external: [{ id: 'e1', itemId: 'B00B5HZGUG', category: { title: 'Audible' } }],
      isbn: '9781927628591'
    },
    {
      id: 'RAffFyqchypK',
      duration: '10:59:29',
      releaseDate: '2014-09-09T00:00:00Z',
      publisher: { id: 'pub2', name: 'Audible Studios' },
      language: { name: 'English' },
      people: [{ role: { name: 'Narrator' }, person: { id: 'n2', name: 'Wil Wheaton' } }],
      images: [{ id: 'img1', url: 'https://cdn.audiobookdb.org/rel2cover' }]
    }
  ]
}

// Multi-author book: comma-joined in ABS display, structured per-person in the DTO
const multiAuthorBook = {
  id: 'M2UTHORBOOK1',
  title: 'Co-Authored Work',
  people: [
    { role: { name: 'Author' }, person: { id: 'a1', name: 'Andy Weir' } },
    { role: { name: 'Author' }, person: { id: 'a2', name: "Jane O'Brian-Smith" } }
  ],
  releases: [{ id: 'relM1', duration: '05:00:00' }]
}

// Search hits are full documents (people in string form); book detail fills releases
const searchHits = [
  { id: 'WQQDcMBQ3qUT', title: 'The Martian', people: [{ role: { name: 'Author' }, person: { name: 'Andy Weir' } }] }
]

const matchedReleaseId = 'dPL9fC7YnK8X'
const includeSuffix = '?include=releasesExternal,people,series,genres,tags,externalItems,images'

describe('AudiobookDB', () => {
  let provider
  let requestStub
  let previousApiKey

  beforeEach(() => {
    previousApiKey = process.env.AUDIOBOOKDB_API_KEY
    process.env.AUDIOBOOKDB_API_KEY = 'test-account-key'
    provider = new AudiobookDB()
    requestStub = sinon.stub(provider, '_request')
    requestStub.resolves(null)
  })

  afterEach(() => {
    if (previousApiKey === undefined) delete process.env.AUDIOBOOKDB_API_KEY
    else process.env.AUDIOBOOKDB_API_KEY = previousApiKey
    sinon.restore()
  })

  describe('parseDurationToMinutes', () => {
    ;[
      ['10:53:35', 654],
      ['10:53:00', 653],
      ['01:00:00', 60],
      ['00:01:30', 2]
    ].forEach(([input, expected]) => {
      it(`converts ${JSON.stringify(input)} to ${expected} minutes`, () => {
        expect(provider.parseDurationToMinutes(input)).to.equal(expected)
      })
    })
    ;[undefined, null, '', 'not:a-duration'].forEach((input) => {
      it(`returns undefined for ${JSON.stringify(input)}`, () => {
        expect(provider.parseDurationToMinutes(input)).to.equal(undefined)
      })
    })
  })

  describe('buildCoverUrl', () => {
    it('appends the largest derivative (/detail.jpg) to a bare storage key', () => {
      expect(provider.buildCoverUrl('https://cdn.audiobookdb.org/abcd')).to.equal('https://cdn.audiobookdb.org/abcd/detail.jpg')
    })
    it('keeps an already-varianted URL as is', () => {
      expect(provider.buildCoverUrl('https://cdn.audiobookdb.org/abcd/large.jpg')).to.equal('https://cdn.audiobookdb.org/abcd/large.jpg')
    })
    ;[undefined, null, 42].forEach((input) => {
      it(`returns undefined for ${JSON.stringify(input)}`, () => {
        expect(provider.buildCoverUrl(input)).to.equal(undefined)
      })
    })
  })

  describe('buildCandidates', () => {
    it('returns one candidate per release', () => {
      const candidates = provider.buildCandidates(bookWithReleases)
      expect(candidates).to.have.length(2)
      expect(candidates.map((c) => c.releaseId)).to.deep.equal(['dPL9fC7YnK8X', 'RAffFyqchypK'])
    })

    it('keeps book-scoped fields book-scoped', () => {
      const [a, b] = provider.buildCandidates(bookWithReleases)
      for (const c of [a, b]) {
        expect(c.title).to.equal('The Martian')
        expect(c.author).to.equal('Andy Weir')
        expect(c.genres).to.deep.equal(['Science'])
        expect(c.tags).to.deep.equal(['Astronomy'])
        expect(c.series).to.deep.equal([{ series: 'Mars', sequence: '3' }])
      }
    })

    it('separates release-scoped fields per candidate', () => {
      const [a, b] = provider.buildCandidates(bookWithReleases)
      expect(a.narrator).to.equal('R.C. Bray')
      expect(a.publisher).to.equal('Podium Publishing')
      expect(a.publishedYear).to.equal('2013')
      expect(a.language).to.equal('English')
      expect(a.duration).to.equal(654)

      expect(b.narrator).to.equal('Wil Wheaton')
      expect(b.publisher).to.equal('Audible Studios')
      expect(b.publishedYear).to.equal('2014')
      expect(b.duration).to.equal(659)
    })

    it('maps ASIN and ISBN from the release ref', () => {
      const [a, b] = provider.buildCandidates(bookWithReleases)
      expect(a.asin).to.equal('B00B5HZGUG')
      expect(a.isbn).to.equal('9781927628591')
      expect(b).to.not.have.property('isbn')
    })

    it('uses the release cover when present and the book cover otherwise', () => {
      const [a, b] = provider.buildCandidates(bookWithReleases)
      expect(a.cover).to.equal('https://cdn.audiobookdb.org/5b9dd618d7526bf4d08384d1506ca36e93515d8154df3f8485c6a93dc10c4045/source.jpg:book')
      expect(b.cover).to.equal('https://cdn.audiobookdb.org/rel2cover/detail.jpg')
    })

    it('prefers the full-resolution sourceUrl over the storage-key derivative', () => {
      const candidates = provider.buildCandidates({
        id: 'b1',
        title: 'Source Preferred',
        coverImage: {
          url: 'https://cdn.audiobookdb.org/covsrc',
          sourceUrl: 'https://cdn.audiobookdb.org/covsrc/source.jpg:book',
          width: 2400,
          height: 2400
        }
      })
      expect(candidates[0].cover).to.equal('https://cdn.audiobookdb.org/covsrc/source.jpg:book')
    })

    it('ignores a sourceUrl that is not an absolute http(s) URL', () => {
      for (const sourceUrl of ['/relative/source.jpg', 'ftp://cdn.audiobookdb.org/x/source.jpg', 42]) {
        const candidates = provider.buildCandidates({
          id: 'b1',
          title: 'Relative Source',
          coverImage: { url: 'https://cdn.audiobookdb.org/relsrc', sourceUrl }
        })
        expect(candidates[0].cover).to.equal('https://cdn.audiobookdb.org/relsrc/detail.jpg')
      }
    })

    it('falls back to the first book image when coverImage is absent', () => {
      const candidates = provider.buildCandidates({
        id: 'b1',
        title: 'Images Only',
        images: [{ id: 'img9', url: 'https://cdn.audiobookdb.org/bookimg' }]
      })
      expect(candidates[0].cover).to.equal('https://cdn.audiobookdb.org/bookimg/detail.jpg')
    })

    it('maps the document image field (SearchDocumentBook image.url) into cover', () => {
      const candidates = provider.buildCandidates({
        id: 'b1',
        title: 'Document Image',
        image: { id: 'imgd', url: 'https://cdn.audiobookdb.org/docimg' }
      })
      expect(candidates[0].cover).to.equal('https://cdn.audiobookdb.org/docimg/detail.jpg')

      // coverImage still takes precedence over the document image.
      const withBoth = provider.buildCandidates({
        id: 'b2',
        title: 'Both Images',
        coverImage: { url: 'https://cdn.audiobookdb.org/doccov' },
        image: { url: 'https://cdn.audiobookdb.org/docimg' }
      })
      expect(withBoth[0].cover).to.equal('https://cdn.audiobookdb.org/doccov/detail.jpg')
    })

    it('never puts a book or release ID into asin or isbn', () => {
      for (const c of provider.buildCandidates(bookWithReleases)) {
        expect(String(c.id)).to.not.match(/^[A-Z0-9]{10}$/)
        expect(String(c.releaseId)).to.not.match(/^[A-Z0-9]{10}$/)
        if (c.asin) expect(c.asin).to.not.equal(c.id)
        if (c.isbn) expect(c.isbn).to.not.equal(c.releaseId)
      }
    })

    it('falls back to a single work-level candidate when there are no releases', () => {
      const candidates = provider.buildCandidates({ id: 'b1', title: 'Work Only', people: [] })
      expect(candidates).to.have.length(1)
      expect(candidates[0]).to.include({ id: 'b1', title: 'Work Only' })
      expect(candidates[0].releaseId).to.equal(undefined)
    })

    it('omits missing optional values instead of leaving undefined/empty values', () => {
      const candidates = provider.buildCandidates({
        id: 'b1',
        title: 'Sparse',
        people: [{ role: { name: 'Narrator' }, person: { name: 'Nobody' } }],
        releases: [{ id: 'r1', duration: 'bad' }]
      })
      expect(candidates).to.have.length(1)
      const c = candidates[0]
      for (const key of Object.keys(c)) {
        expect(c[key]).to.not.equal(undefined)
        expect(c[key]).to.not.equal('')
        expect(c[key]).to.not.deep.equal([])
      }
      for (const key of ['author', 'narrator', 'publisher', 'publishedYear', 'language', 'duration', 'cover', 'genres', 'tags', 'series', 'subtitle', 'description', 'asin', 'isbn']) {
        expect(c, key).to.not.have.property(key)
      }
    })

    it('omits sequence when the series position is absent', () => {
      const candidates = provider.buildCandidates({
        id: 'b1',
        title: 'T',
        series: [{ series: { title: 'Mars' }, ordinal: undefined, position: undefined }]
      })
      expect(candidates[0].series).to.deep.equal([{ series: 'Mars' }])
    })
  })

  describe('resolveByASIN', () => {
    it('returns only the matchedReleaseId recording from its release ref', async () => {
      requestStub
        .withArgs(`/audiobooks/external/audible/B00B5HZGUG`, 'GET', null, sinon.match.number)
        .resolves({ ...bookWithReleases, matchedReleaseId })

      const results = await provider.resolveByASIN('B00B5HZGUG', Date.now() + 10000)
      expect(results).to.have.length(1)
      expect(results[0].releaseId).to.equal(matchedReleaseId)
      expect(results[0].narrator).to.equal('R.C. Bray')
      expect(results[0].id).to.equal('WQQDcMBQ3qUT')
      expect(results[0].asin).to.equal('B00B5HZGUG')
      expect(results[0].isbn).to.equal('9781927628591')
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/audiobooks/external/audible/B00B5HZGUG'])
    })

    it('returns an empty array when matchedReleaseId is absent', async () => {
      requestStub.resolves(bookWithReleases)
      expect(await provider.resolveByASIN('B00B5HZGUG', Date.now() + 10000)).to.deep.equal([])
    })

    it('returns an empty array when no release matches the matchedReleaseId', async () => {
      requestStub.resolves({ ...bookWithReleases, matchedReleaseId: 'UNKNOWNREL1' })
      expect(await provider.resolveByASIN('B00B5HZGUG', Date.now() + 10000)).to.deep.equal([])
    })

    it('returns an empty array on API error', async () => {
      requestStub.resolves(null)
      expect(await provider.resolveByASIN('B00B5HZGUG', Date.now() + 10000)).to.deep.equal([])
    })
  })

  describe('search', () => {
    it('prefers exact ASIN resolution over title search', async () => {
      requestStub
        .withArgs(`/audiobooks/external/audible/B00B5HZGUG`, 'GET', null, sinon.match.number)
        .resolves({ ...bookWithReleases, matchedReleaseId })

      const results = await provider.search('The Martian', 'Andy Weir', 'B00B5HZGUG')
      expect(results).to.have.length(1)
      expect(results[0].releaseId).to.equal(matchedReleaseId)
      expect(results[0].asin).to.equal('B00B5HZGUG')
      expect(results[0].isbn).to.equal('9781927628591')
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/audiobooks/external/audible/B00B5HZGUG'])
    })

    it('returns no candidates when the exact ASIN does not resolve (no title fallback)', async () => {
      requestStub.withArgs(`/audiobooks/external/audible/B00B5HZGUG`, 'GET', null, sinon.match.number).resolves(null) // 404 upstream

      const results = await provider.search('The Martian', 'Andy Weir', 'B00B5HZGUG')
      expect(results).to.deep.equal([])
      // A valid ASIN that does not resolve must never fall back to a title
      // search: substituting a different recording is wrong.
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/audiobooks/external/audible/B00B5HZGUG'])
    })

    it('rejects an invalid explicit ASIN without any request', async () => {
      expect(await provider.search('The Martian', 'Andy Weir', 'not an asin')).to.deep.equal([])
      expect(await provider.search('The Martian', 'Andy Weir', 'B00B5HZGU')).to.deep.equal([]) // 9 chars
      sinon.assert.notCalled(requestStub)
    })

    it('resolves an explicit ASIN with an empty title', async () => {
      requestStub
        .withArgs(`/audiobooks/external/audible/B00B5HZGUG`, 'GET', null, sinon.match.number)
        .resolves({ ...bookWithReleases, matchedReleaseId })

      const results = await provider.search('', '', 'B00B5HZGUG')
      expect(results).to.have.length(1)
      expect(results[0].releaseId).to.equal(matchedReleaseId)
    })

    it('resolves an ASIN-looking title exactly on first lookup and falls back when the ASIN is unknown', async () => {
      requestStub
        .withArgs(`/audiobooks/external/audible/B00B5HZGUG`, 'GET', null, sinon.match.number)
        .resolves({ ...bookWithReleases, matchedReleaseId })

      const resolved = await provider.search('b00b5hzgug', '')
      expect(resolved).to.have.length(1)
      expect(resolved[0].releaseId).to.equal(matchedReleaseId)

      // Second, independent scenario: the same ASIN-shaped title is probed
      // and this time misses, so the provider must fall back to a normal
      // title search, which finds nothing.
      requestStub.reset()
      requestStub.resolves(null)
      requestStub
        .withArgs(`/audiobooks/external/audible/B00B5HZGUG`, 'GET', null, sinon.match.number)
        .resolves(null)
      requestStub.withArgs('/search', 'POST', { q: 'b00b5hzgug', type: 'books' }, sinon.match.number).resolves([])
      const fellBack = await provider.search('b00b5hzgug', '')
      expect(fellBack).to.deep.equal([])
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal([
        '/audiobooks/external/audible/B00B5HZGUG',
        '/search'
      ])
    })

    it('treats an ASIN-shaped title as a probe only: a miss falls through to the title search', async () => {
      // "Foundation" (uppercased to FOUNDATION) is a valid 10-character ASIN
      // shape under the existing validator, but no ASIN was supplied, so the
      // exact-ASIN endpoint is only probed opportunistically: a miss must
      // fall through to the normal title search and return the title
      // candidate, not abstain.
      const foundationBook = {
        id: 'FOUNDATN0001',
        title: 'Foundation',
        people: [{ role: { name: 'Author' }, person: { id: 'ia1', name: 'Isaac Asimov' } }],
        releases: [{ id: 'relF1', duration: '15:00:00' }]
      }
      requestStub.withArgs('/audiobooks/external/audible/FOUNDATION', 'GET', null, sinon.match.number).resolves(null)
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves([
        { id: foundationBook.id, title: 'Foundation', people: [{ role: { name: 'Author' }, person: { name: 'Isaac Asimov' } }] }
      ])
      requestStub.withArgs(`/books/${foundationBook.id}${includeSuffix}`, 'GET', null, sinon.match.number).resolves(foundationBook)

      const results = await provider.search('Foundation', 'Isaac Asimov')
      expect(results).to.have.length(1)
      expect(results[0].id).to.equal(foundationBook.id)
      expect(results[0].title).to.equal('Foundation')
      expect(results[0].author).to.equal('Isaac Asimov')
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal([
        '/audiobooks/external/audible/FOUNDATION',
        '/search',
        `/books/${foundationBook.id}${includeSuffix}`
      ])
    })

    it('does not title-search when a valid explicit ASIN does not resolve', async () => {
      requestStub
        .withArgs(`/audiobooks/external/audible/B00EXTLNK7`, 'GET', null, sinon.match.number)
        .resolves(null)

      await provider.search('Foundation', 'Isaac Asimov', 'B00EXTLNK7')
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/audiobooks/external/audible/B00EXTLNK7'])
      expect(requestStub.getCalls().map((c) => c.args[0])).to.not.include('/audiobooks/external/audible/FOUNDATION')
      expect(requestStub.getCalls().map((c) => c.args[0])).to.not.include('/search')
    })

    it('searches by title and hydrates book detail for each hit, matching a single author locally', async () => {
      requestStub.withArgs('/search', 'POST', { q: 'The Martian', type: 'books' }, sinon.match.number).resolves(searchHits)
      requestStub.withArgs(`/books/WQQDcMBQ3qUT${includeSuffix}`, 'GET', null, sinon.match.number).resolves(bookWithReleases)

      const results = await provider.search('The Martian', 'Andy Weir')
      expect(results).to.have.length(2)
      expect(results.map((c) => c.title)).to.deep.equal(['The Martian', 'The Martian'])
      expect(results.map((c) => c.narrator)).to.deep.equal(['R.C. Bray', 'Wil Wheaton'])
      expect(results[0].isbn).to.equal('9781927628591')
      expect(results[1]).to.not.have.property('isbn')
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal([
        '/search',
        `/books/WQQDcMBQ3qUT${includeSuffix}`
      ])
    })

    it('matches a comma-joined multi-author display string without an exact person filter', async () => {
      const hits = [
        {
          id: multiAuthorBook.id,
          title: 'Co-Authored Work',
          people: [
            { role: { name: 'Author' }, person: { name: 'Andy Weir' } },
            { role: { name: 'Author' }, person: { name: "Jane O'Brian-Smith" } }
          ]
        }
      ]
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves(hits)
      requestStub.withArgs(`/books/${multiAuthorBook.id}${includeSuffix}`, 'GET', null, sinon.match.number).resolves(multiAuthorBook)

      const results = await provider.search('Co-Authored Work', "Andy Weir, Jane O'Brian-Smith")
      expect(results).to.have.length(1)
      expect(results[0].author).to.equal("Andy Weir, Jane O'Brian-Smith")
      const searchBody = requestStub.getCalls().find((c) => c.args[0] === '/search').args[2]
      expect(searchBody.filters).to.equal(undefined)
    })

    it('does not drop a multi-author book whose author name contains a comma', async () => {
      const book = {
        id: 'COMMAAUTHOR12',
        title: 'Comma Named Author',
        people: [{ role: { name: 'Author' }, person: { id: 'c1', name: 'Smith, John' } }],
        releases: [{ id: 'relC1', duration: '01:00:00' }]
      }
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves([
        { id: book.id, title: book.title, people: [{ role: { name: 'Author' }, person: { name: 'Smith, John' } }] }
      ])
      requestStub.withArgs(`/books/${book.id}${includeSuffix}`, 'GET', null, sinon.match.number).resolves(book)

      const results = await provider.search('Comma Named Author', 'Smith, John')
      expect(results).to.have.length(1)
      expect(results[0].author).to.equal('Smith, John')
    })

    it('keeps the exact Andorra author "devon c ford" as a candidate when the API credits "Devon C. Ford"', async () => {
      // Full search pipeline: the requested author (lowercased, no middle
      // initial) must match the API's credit through both the pre-hydration
      // hit filter and the post-hydration guard, so the candidate is kept
      // with its author string intact.
      const andorraBook = {
        id: 'ANDORRADEVON1',
        title: 'Andorra',
        people: [{ role: { name: 'Author' }, person: { id: 'dv1', name: 'Devon C. Ford' } }],
        releases: [{ id: 'relD1', duration: '01:00:00' }]
      }
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves([
        { id: andorraBook.id, title: 'Andorra', people: [{ role: { name: 'Author' }, person: { name: 'Devon C. Ford' } }] }
      ])
      requestStub.withArgs(`/books/${andorraBook.id}${includeSuffix}`, 'GET', null, sinon.match.number).resolves(andorraBook)

      const results = await provider.search('Andorra', 'devon c ford')
      expect(results).to.have.length(1)
      expect(results[0].id).to.equal(andorraBook.id)
      expect(results[0].title).to.equal('Andorra')
      expect(results[0].author).to.equal('Devon C. Ford')
    })

    it('drops a book whose authors do not contain the requested author', async () => {
      const otherBook = {
        id: 'OTHERBOOK123',
        title: 'Someone Else',
        people: [{ role: { name: 'Author' }, person: { id: 'e1', name: 'Totally Different' } }],
        releases: [{ id: 'relO1', duration: '01:00:00' }]
      }
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves([{ id: otherBook.id }])
      requestStub.withArgs(`/books/${otherBook.id}${includeSuffix}`, 'GET', null, sinon.match.number).resolves(otherBook)

      const results = await provider.search('Someone Else', 'Andy Weir')
      expect(results).to.deep.equal([])
    })

    it('filters hits by requested author before the hydration cap, finding the 6th hit', async () => {
      const decoyAuthor = [{ role: { name: 'Author' }, person: { name: 'Someone Else' } }]
      const target = { id: 'TARGETBOOK6', title: 'Martian', people: [{ role: { name: 'Author' }, person: { name: 'Andy Weir' } }] }
      const hits = [...Array.from({ length: 5 }, (_, i) => ({ id: `decoy${i}`, title: 'Martian', people: decoyAuthor })), target]
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves(hits)
      requestStub.withArgs(`/books/${target.id}${includeSuffix}`, 'GET', null, sinon.match.number).resolves({
        ...target,
        releases: [{ id: 'relT1', duration: '01:00:00' }]
      })

      const results = await provider.search('Martian', 'Andy Weir')
      expect(results).to.have.length(1)
      expect(results[0].id).to.equal(target.id)
      const bookRequests = requestStub.getCalls().filter((c) => String(c.args[0]).startsWith('/books/'))
      expect(bookRequests.map((c) => c.args[0])).to.deep.equal([`/books/${target.id}${includeSuffix}`])
    })

    it('bounds the detail hydration fanout', async () => {
      const manyHits = Array.from({ length: 10 }, (_, i) => ({ id: `book${i}`, title: `T${i}` }))
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves(manyHits)
      requestStub.withArgs(sinon.match(/^\/books\//), 'GET', null, sinon.match.number).resolves({ id: 'x', title: 'X' })

      const results = await provider.search('martian', '')
      expect(results).to.have.length(5)
      const bookRequests = requestStub.getCalls().filter((c) => String(c.args[0]).startsWith('/books/'))
      expect(bookRequests).to.have.length(5)
    })

    it('keeps fulfilled candidates and stops hydrating when the aggregate deadline exhausts', () => {
      const clock = sinon.useFakeTimers({ now: Date.parse('2026-01-01T00:00:00Z') })
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves([
        { id: 'bookA' },
        { id: 'bookB' },
        { id: 'bookC' }
      ])
      let detailCalls = 0
      requestStub.withArgs(sinon.match(/^\/books\//), 'GET', null, sinon.match.number).callsFake(() => {
        detailCalls += 1
        clock.tick(12000)
        return Promise.resolve({ id: `detail${detailCalls}`, title: `D${detailCalls}` })
      })

      return provider.search('martian', '', null, 20000).then((results) => {
        expect(detailCalls).to.equal(2)
        expect(results.map((c) => c.id)).to.deep.equal(['detail1', 'detail2'])
      })
    })

    it('resolves by the deadline even when the throttle queue would not run the request', async () => {
      const clock = sinon.useFakeTimers({ now: Date.parse('2026-01-01T00:00:00Z') })
      // The beforeEach stub intercepts _request; this test must exercise the
      // real throttle/deadline implementation, not the stub's echo.
      requestStub.restore()
      const captured = []
      provider.limiter = (fn) => {
        captured.push(fn)
        // p-throttle returns a throttled function (not a promise); _request
        // invokes it. The throttled call enqueues and never settles here, so
        // the queued closure is never invoked, no request is issued, and only
        // the deadline timer resolves the request.
        return () => new Promise(() => {})
      }
      const started = Date.now()
      const pending = provider._request('/search', 'POST', { q: 'x' }, started + 500)
      clock.tick(500)
      expect(await pending).to.equal(null)
      expect(captured).to.have.length(1)
      expect(clock.now).to.equal(started + 500)
      // The queued closure, finally invoked past the deadline, must not issue
      // the network call.
      expect(await captured[0]()).to.equal(null)
    })

    it('propagates provider failures without trying another search', async () => {
      requestStub.rejects(new AudiobookDBError('audiobookdb_rate_limited', 60))
      await expectProviderFailure(provider.search('The Martian', 'Andy Weir'), 'audiobookdb_rate_limited')
      sinon.assert.calledOnce(requestStub)
    })

    ;['I', 'It'].forEach((title) => {
      it(`searches and hydrates short title "${title}" using its indexed author`, async () => {
        const people = [{ role: { name: 'Author' }, person: { name: 'Stephen King' } }]
        requestStub.withArgs('/search', 'POST', { q: `${title} Stephen King`, type: 'books' }, sinon.match.number).resolves([
          { id: 'SHORTBOOK1', title, people },
          { id: 'WRONGAUTHOR', title, people: [{ role: { name: 'Author' }, person: { name: 'Other Writer' } }] }
        ])
        requestStub.withArgs(`/books/SHORTBOOK1${includeSuffix}`, 'GET', null, sinon.match.number).resolves({
          id: 'SHORTBOOK1', title, people, releases: [{ id: 'SHORTRELEASE1', duration: '10:00:00' }]
        })

        const results = await provider.search(title, 'Stephen King')
        expect(results).to.have.length(1)
        expect(results[0]).to.include({ title, author: 'Stephen King', releaseId: 'SHORTRELEASE1' })
        expect(requestStub.getCalls().map((call) => call.args[0])).to.deep.equal(['/search', `/books/SHORTBOOK1${includeSuffix}`])
      })
    })

    it('returns an empty array for a title that is too short with no author', async () => {
      expect(await provider.search('ab', '')).to.deep.equal([])
      sinon.assert.notCalled(requestStub)
    })

    it('serves covers from search hits without any release or book detail fanout', async () => {
      const hitCover = 'https://cdn.audiobookdb.org/coverkey'
      const hits = [
        {
          id: 'COVERBOOK1',
          title: 'Cover Book',
          coverImage: { url: hitCover, sourceUrl: `${hitCover}/source.jpg:book` },
          people: [{ role: { name: 'Author' }, person: { name: 'Andy Weir' } }]
        },
        { id: 'OTHERBOOK123', title: 'Someone Else', people: [{ role: { name: 'Author' }, person: { name: 'Totally Different' } }] }
      ]
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves(hits)

      const results = await provider.search('Cover Book', 'Andy Weir', null, 10000, { coversOnly: true })
      expect(results).to.have.length(1)
      expect(results[0].id).to.equal('COVERBOOK1')
      expect(results[0].cover).to.equal(`${hitCover}/source.jpg:book`)
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/search'])
    })

    it('maps a covers-only hit to one work-level candidate and drops no-cover hits', async () => {
      // SearchDocumentBook hits are full documents that can carry release
      // refs; covers-only must not fan out to them, so the hit maps to a
      // single work-level candidate, and a hit with no usable cover source
      // (coverImage / image / images[0], with or without a sourceUrl) is
      // dropped entirely.
      const hitCover = 'https://cdn.audiobookdb.org/dockey'
      const hits = [
        {
          id: 'COVERBOOK1',
          title: 'Cover Book',
          image: { id: 'imgd', url: hitCover },
          people: [{ role: { name: 'Author' }, person: { name: 'Totally Different' } }],
          releases: [
            { id: 'relC1', duration: '10:00:00' },
            { id: 'relC2', duration: '11:00:00' }
          ]
        },
        { id: 'NOCOVER1', title: 'No Cover Book', releases: [{ id: 'relC3', duration: '09:00:00' }] }
      ]
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves(hits)

      const results = await provider.search('Cover Book', 'Andy Weir', null, 10000, { coversOnly: true })
      expect(results).to.have.length(1)
      expect(results[0].id).to.equal('COVERBOOK1')
      expect(results[0].releaseId).to.equal(undefined)
      expect(results[0].cover).to.equal(`${hitCover}/detail.jpg`)
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/search'])
    })

    it('serves covers from hits whose stored author is wrong (covers-only keeps them)', async () => {
      // Cover-only lookups fetch images, not metadata: a hit whose stored
      // author does not match the requested author is served with its
      // actual SearchDocumentBook image and zero /books/ fanout, instead of
      // being rejected like a normal search hit.
      const hitCover = 'https://cdn.audiobookdb.org/wrongauthork'
      const hits = [
        { id: 'COVERBOOK1', title: 'Cover Book', coverImage: { url: hitCover }, people: [{ role: { name: 'Author' }, person: { name: 'Totally Different' } }] }
      ]
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves(hits)

      const results = await provider.search('Cover Book', 'Andy Weir', null, 10000, { coversOnly: true })
      expect(results).to.have.length(1)
      expect(results[0].id).to.equal('COVERBOOK1')
      expect(results[0].cover).to.equal(`${hitCover}/detail.jpg`)
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/search'])
    })

    it('serves covers from document image fields when coverImage is absent', async () => {
      const documentImageUrl = 'https://cdn.audiobookdb.org/docimg'
      const hits = [
        { id: 'COVERBOOK1', title: 'Cover Book', image: { id: 'imgd', url: documentImageUrl } },
        { id: 'COVERBOOK2', title: 'Cover Book 2', images: [{ id: 'img1', url: 'https://cdn.audiobookdb.org/docimgs' }] }
      ]
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves(hits)

      const results = await provider.search('Cover Book', '', null, 10000, { coversOnly: true })
      expect(results.map((r) => r.cover)).to.deep.equal([
        `${documentImageUrl}/detail.jpg`,
        'https://cdn.audiobookdb.org/docimgs/detail.jpg'
      ])
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/search'])
    })

    it('keeps author filtering for normal (non covers-only) searches', async () => {
      // A hit with no author credit that does not contain the requested
      // author is still dropped by the pre-hydration filter: the
      // covers-only exemption does not leak into normal matching.
      requestStub.withArgs('/search', 'POST', sinon.match.object, sinon.match.number).resolves([
        { id: 'COVERBOOK1', title: 'Cover Book', coverImage: { url: 'https://cdn.audiobookdb.org/coverkey' } }
      ])

      const results = await provider.search('Cover Book', 'Andy Weir')
      expect(results).to.deep.equal([])
      expect(requestStub.getCalls().map((c) => c.args[0])).to.deep.equal(['/search'])
    })

    describe('metadata mapping', () => {
      it('maps isAdult true/false to explicit and treats null/absent as unknown', () => {
        const trueBook = { id: 'B1', title: 'T', isAdult: true }
        const falseBook = { id: 'B2', title: 'T', isAdult: false }
        const nullBook = { id: 'B3', title: 'T', isAdult: null }
        const absentBook = { id: 'B4', title: 'T' }

        const trueCandidates = provider.buildCandidates(trueBook)
        expect(trueCandidates[0].explicit).to.equal(true)
        expect(provider.buildCandidates(falseBook)[0].explicit).to.equal(false)
        expect(provider.buildCandidates(nullBook)[0]).to.not.have.property('explicit')
        expect(provider.buildCandidates(absentBook)[0]).to.not.have.property('explicit')
      })

      it('never maps an abridged flag (the DTO has no such field)', () => {
        const candidates = provider.buildCandidates(bookWithReleases)
        candidates.forEach((c) => expect(c).to.not.have.property('abridged'))
      })

      it('omits the published year when the release date is invalid', () => {
        const book = {
          id: 'BADYEAR123',
          title: 'Bad Year',
          releases: [{ id: 'relY1', releaseDate: 'not-a-date', duration: '01:00:00' }]
        }
        const candidates = provider.buildCandidates(book)
        expect(candidates).to.have.length(1)
        expect(candidates[0]).to.not.have.property('publishedYear')
      })
    })

    describe('bookAuthorsContain', () => {
      const bookWith = (names) => ({
        people: names.map((name) => ({ role: { name: 'Author' }, person: { name } }))
      })

      it('matches an initial the backend dropped', () => {
        expect(provider.bookAuthorsContain(bookWith(['Devon C. Ford']), ['devon c ford'])).to.equal(true)
        expect(provider.bookAuthorsContain(bookWith(['Devon Ford']), ['devon c ford'])).to.equal(true)
        expect(provider.bookAuthorsContain(bookWith(['Devon C. Ford']), ['devon ford'])).to.equal(true)
      })

      it('is tolerant of diacritics, punctuation and spacing', () => {
        expect(provider.bookAuthorsContain(bookWith(['José García']), ['jose garcia'])).to.equal(true)
        expect(provider.bookAuthorsContain(bookWith(['José García']), ['jose g. garcia'])).to.equal(true)
        expect(provider.bookAuthorsContain(bookWith(['O\'Brien, Patrick']), ['patrick obrien'])).to.equal(true)
      })

      it('keeps non-Latin script names (normalization must not erase them)', () => {
        expect(provider.bookAuthorsContain(bookWith(['刘慈欣']), ['刘慈欣'])).to.equal(true)
        expect(provider.bookAuthorsContain(bookWith(['Liú Cíxīn']), ['刘慈欣'])).to.equal(false)
        expect(provider.bookAuthorsContain(bookWith(['Андрей Платонов']), ['андрей'])).to.equal(true)
      })

      it('rejects unrelated author names', () => {
        expect(provider.bookAuthorsContain(bookWith(['Andy Weir']), ['kate reading'])).to.equal(false)
        expect(provider.bookAuthorsContain(bookWith(['Kate Reading']), ['kate reeding'])).to.equal(false)
        expect(provider.bookAuthorsContain(bookWith([]), ['andrew'])).to.equal(false)
      })
    })
  })

  describe('request logging', () => {
    let provider
    let errorStub

    beforeEach(() => {
      provider = new AudiobookDB()
      errorStub = sinon.stub(Logger, 'error')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('logs an API failure when the request errors', async () => {
      provider.limiter = (fn) => () => fn()
      // Port 1 is closed on loopback: a real transport failure (ECONNREFUSED).
      provider.baseUrl = 'http://127.0.0.1:1/api'
      await expectProviderFailure(provider._request('/search', 'POST', { q: 'x' }), 'audiobookdb_unavailable')
      sinon.assert.calledWithMatch(errorStub, '[AudiobookDB] request failed: audiobookdb_unavailable')
    })

    ;[undefined, '', '   ', 'anonymous'].forEach((key) => {
      it(`requires an account key before queueing an API request (${JSON.stringify(key)})`, async () => {
        if (key === undefined) delete process.env.AUDIOBOOKDB_API_KEY
        else process.env.AUDIOBOOKDB_API_KEY = key
        const limiter = sinon.spy(provider, 'limiter')
        await expectProviderFailure(provider.search('The Martian', 'Andy Weir'), 'audiobookdb_key_required')
        sinon.assert.notCalled(limiter)
      })
    })

    ;[401, 403, 429, 500, 503].forEach((status) => {
      it(`propagates HTTP ${status} without anonymous fallback or further API calls`, async () => {
        provider.limiter = (fn) => () => fn()
        const keys = []
        const server = http.createServer((req, res) => {
          keys.push(req.headers['x-api-key'])
          res.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': '31' })
          res.end(JSON.stringify({ message: 'unsafe upstream text test-account-key' }))
        })
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
        provider.baseUrl = `http://127.0.0.1:${server.address().port}/api`
        try {
          const code = status === 401 || status === 403 ? 'audiobookdb_auth' : status === 429 ? 'audiobookdb_rate_limited' : 'audiobookdb_unavailable'
          const error = await expectProviderFailure(provider.search('The Martian', 'Andy Weir'), code)
          expect(keys).to.deep.equal(['test-account-key'])
          expect(error.message).not.to.include('test-account-key')
          if (status === 429) expect(error.retryAfter).to.equal(31)
        } finally {
          await new Promise((resolve) => server.close(resolve))
        }
      })
    })

    it('does not log a genuine empty hit list as an error', async () => {
      provider._request = async () => []
      expect(await provider.search('The Martian', 'Andy Weir')).to.deep.equal([])
      sinon.assert.notCalled(errorStub)
    })

    it('logs a 404 on the exact-ASIN endpoint as an expected identifier miss, not an error', async () => {
      const debugStub = sinon.stub(Logger, 'debug')
      provider.limiter = (fn) => () => fn()
      const server = http.createServer((req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'not found' }))
      })
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      provider.baseUrl = `http://127.0.0.1:${server.address().port}/api`
      try {
        const asinResults = await provider.search('The Martian', 'Andy Weir', 'B00EXTLNK7')
        expect(asinResults).to.deep.equal([])
        sinon.assert.notCalled(errorStub)
        sinon.assert.calledWithMatch(debugStub, '[AudiobookDB] GET /audiobooks/external/audible/B00EXTLNK7 not found (expected identifier miss)')
      } finally {
        await new Promise((resolve) => server.close(resolve))
        debugStub.restore()
      }
    })

    ;[false, true].forEach((hasSurvivingBook) => {
      it(`skips a removed book during hydration${hasSurvivingBook ? ' and preserves other recordings' : ' without reporting an outage'}`, async () => {
        provider.limiter = (fn) => () => fn()
        const server = http.createServer((req, res) => {
          req.resume()
          const missing = req.url.startsWith('/api/books/removed-book?')
          res.writeHead(missing ? 404 : 200, { 'Content-Type': 'application/json' })
          const hits = [{ ...searchHits[0], id: 'removed-book' }, ...(hasSurvivingBook ? searchHits : [])]
          res.end(JSON.stringify(req.url === '/api/search' ? hits : missing ? { message: 'not found' } : bookWithReleases))
        })
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
        provider.baseUrl = `http://127.0.0.1:${server.address().port}/api`
        try {
          const results = await provider.search('The Martian', 'Andy Weir')
          expect(results.map((candidate) => candidate.releaseId)).to.deep.equal(hasSurvivingBook ? ['dPL9fC7YnK8X', 'RAffFyqchypK'] : [])
          sinon.assert.notCalled(errorStub)
        } finally {
          await new Promise((resolve) => server.close(resolve))
        }
      })
    })

    it('reports a missing search endpoint as a provider failure', async () => {
      provider.limiter = (fn) => () => fn()
      const server = http.createServer((req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'not found' }))
      })
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      provider.baseUrl = `http://127.0.0.1:${server.address().port}/api`
      try {
        await expectProviderFailure(provider.search('The Martian', 'Andy Weir'), 'audiobookdb_unavailable')
        sinon.assert.calledOnce(errorStub)
      } finally {
        await new Promise((resolve) => server.close(resolve))
      }
    })

    it('still logs transport failures on the exact-ASIN endpoint as API errors', async () => {
      provider.limiter = (fn) => () => fn()
      // Port 1 is closed on loopback: a real transport failure (ECONNREFUSED),
      // which must not be swallowed by the expected-miss 404 handling.
      provider.baseUrl = 'http://127.0.0.1:1/api'
      await expectProviderFailure(provider.search('The Martian', 'Andy Weir', 'B00EXTLNK7'), 'audiobookdb_unavailable')
      sinon.assert.calledWithMatch(errorStub, '[AudiobookDB] request failed: audiobookdb_unavailable')
    })
  })

  describe('Retry-After', () => {
    it('accepts numeric seconds and HTTP dates', () => {
      sinon.useFakeTimers({ now: Date.parse('2026-01-01T00:00:00Z') })
      expect(AudiobookDBError.fromResponse({ status: 429, headers: { 'retry-after': '12' } }).retryAfter).to.equal(12)
      expect(AudiobookDBError.fromResponse({ status: 429, headers: { 'retry-after': 'Thu, 01 Jan 2026 00:01:00 GMT' } }).retryAfter).to.equal(60)
    })

    ;[undefined, '', '-1', 'Infinity', 'NaN', 'nonsense', ['12']].forEach((header) => {
      it(`omits invalid retry timing ${JSON.stringify(header)}`, () => {
        expect(AudiobookDBError.fromResponse({ status: 429, headers: { 'retry-after': header } })).not.to.have.property('retryAfter')
      })
    })
  })

  describe('request deadline', () => {
    let provider

    beforeEach(() => {
      provider = new AudiobookDB()
      provider.limiter = (fn) => {
        // A never-settling in-flight request simulates a slow server.
        return () => new Promise(() => {})
      }
    })

    afterEach(() => {
      sinon.restore()
    })

    it('aborts the in-flight request when the deadline expires', async () => {
      const clock = sinon.useFakeTimers({ now: Date.parse('2026-01-01T00:00:00Z') })
      const pending = provider._request('/search', 'POST', { q: 'x' }, Date.now() + 250)
      clock.tick(250)
      expect(await pending).to.equal(null)
    })

    it('does not log a deadline expiry as a server error', async () => {
      const clock = sinon.useFakeTimers({ now: Date.parse('2026-01-01T00:00:00Z') })
      const errorStub = sinon.stub(Logger, 'error')
      const pending = provider._request('/search', 'POST', { q: 'x' }, Date.now() + 250)
      clock.tick(250)
      expect(await pending).to.equal(null)
      sinon.assert.notCalled(errorStub)
    })
  })
})

describe('BookFinder audiobookdb dispatch', () => {
  let searchStub
  let audnexusStub

  beforeEach(() => {
    searchStub = sinon.stub(bookFinder.audiobookdb, 'search')
    searchStub.resolves([])
    audnexusStub = sinon.stub(bookFinder.audnexus, 'authorASINsRequest')
    audnexusStub.resolves([])
  })

  afterEach(() => {
    sinon.restore()
  })

  it('propagates provider failures without fuzzy or anonymous fallback', async () => {
    searchStub.rejects(new AudiobookDBError('audiobookdb_rate_limited', 60))
    await expectProviderFailure(bookFinder.search(null, 'audiobookdb', 'The Martian', 'Andy Weir', null, null, { maxFuzzySearches: 5 }), 'audiobookdb_rate_limited')
    sinon.assert.calledOnce(searchStub)
    sinon.assert.notCalled(audnexusStub)
  })

  it('runs the audiobookdb provider on dispatch and keeps descriptions sanitized', async () => {
    searchStub.resolves([{ title: 'The Martian', author: 'Andy Weir', description: '<script>bad</script><p>ok</p>' }])
    const results = await bookFinder.search(null, 'audiobookdb', 'The Martian', 'Andy Weir')
    expect(results).to.have.length(1)
    expect(results[0].description).to.not.include('script>')
    expect(searchStub.firstCall.args.slice(0, 3)).to.deep.equal(['The Martian', 'Andy Weir', undefined])
  })

  it('does not trigger Audnexus fuzzy-author calls when the backend search returns nothing', async () => {
    searchStub.resolves([])
    const results = await bookFinder.search(null, 'audiobookdb', 'The Martian', 'Andy Weir', null, null, { maxFuzzySearches: 5 })
    expect(results).to.deep.equal([])
    // Bounded local fallback: with a single-part title every full-author
    // relaxed query duplicates the initial (tried) query, so the only search
    // that runs is the no-author one. No Audnexus author resolution is
    // consulted. The initial search keeps original case; the fallback
    // lowercases.
    expect(searchStub.getCalls().map((c) => [c.args[0], c.args[1]])).to.deep.equal([
      ['The Martian', 'Andy Weir'],
      ['the martian', '']
    ])
    sinon.assert.notCalled(audnexusStub)
  })

  it('recovers a contaminated quick-match author by relaxing to an empty author search', async () => {
    searchStub.resolves([])
    searchStub
      .withArgs('andorra', '', null, sinon.match.number, sinon.match({ coversOnly: false }))
      .resolves([{ title: 'Andorra' }])

    // maxFuzzySearches 2: the fallback query list deduplicates the
    // cleaned-author main title against the initial query (identical
    // normalized title and author), so the no-author main title is the
    // only additional search. No substitution to a different author
    // happens. The initial search keeps original case; the fallback
    // lowercases.
    const results = await bookFinder.search(null, 'audiobookdb', 'Andorra', 'Kate Reading', null, null, { maxFuzzySearches: 2 })
    expect(results).to.deep.equal([{ title: 'Andorra' }])
    expect(searchStub.getCalls().map((c) => [c.args[0], c.args[1]])).to.deep.equal([
      ['Andorra', 'Kate Reading'],
      ['andorra', '']
    ])
    sinon.assert.notCalled(audnexusStub)
  })

  it('keeps a matching author through the bounded audiobookdb fallback', async () => {
    searchStub.resolves([])
    searchStub
      .withArgs('devon', 'devon ford', null, sinon.match.number, sinon.match({ coversOnly: false }))
      .resolves([{ title: 'Devon' }])

    // "Devon C. Ford" normalizes to "devon ford" (the "c." middle initial
    // is dropped, never substituted), so the relaxed author search finds the
    // match. The initial search keeps original case; the fallback lowercases.
    const results = await bookFinder.search(null, 'audiobookdb', 'Devon', 'Devon C. Ford', null, null, { maxFuzzySearches: 3 })
    expect(results).to.deep.equal([{ title: 'Devon' }])
    expect(searchStub.getCalls().map((c) => [c.args[0], c.args[1]])).to.deep.equal([
      ['Devon', 'Devon C. Ford'],
      ['devon', 'devon ford']
    ])
  })

  it('bounds the audiobookdb fuzzy fallback by maxFuzzySearches', async () => {
    searchStub.resolves([])

    // " - " separates parts: the main title ("the") leads with the item's
    // author, immediately followed by the no-author main title; the
    // remaining budget spends on title variants (each leading its author
    // level). Budget 5 = 5 fallback searches: the, great (both author
    // levels) and novel with the author.
    const results = await bookFinder.search(null, 'audiobookdb', 'The - Great - Novel', 'Someone', null, null, { maxFuzzySearches: 5 })
    expect(results).to.deep.equal([])
    expect(searchStub.getCalls().map((c) => [c.args[0], c.args[1]])).to.deep.equal([
      ['The - Great - Novel', 'Someone'],
      ['the', 'someone'],
      ['the', ''],
      ['great', 'someone'],
      ['great', ''],
      ['novel', 'someone']
    ])
  })

  it('searches by explicit ASIN only when the title is empty', async () => {
    searchStub.resolves([{ title: 'The Martian', releaseId: 'dPL9fC7YnK8X' }])
    const results = await bookFinder.search(null, 'audiobookdb', '', '', null, 'B00B5HZGUG')
    expect(results).to.have.length(1)
    expect(searchStub.firstCall.args.slice(0, 3)).to.deep.equal(['', '', 'B00B5HZGUG'])
    sinon.assert.notCalled(audnexusStub)
  })

  it('prefers the recording closest to the library item runtime when there is no ASIN', async () => {
    searchStub.resolves([
      { title: 'The Martian', narrator: 'R.C. Bray', duration: 654, releaseId: 'dPL9fC7YnK8X' },
      { title: 'The Martian', narrator: 'Wil Wheaton', duration: 659, releaseId: 'RAffFyqchypK' }
    ])
    // ABS media.duration is seconds: 10:59:29 => 39569 s => 659.483 minutes.
    // Nearest-runtime ordering must pick the 659-minute recording (diff 0.52)
    // over the 654-minute one (diff 5.48), not the larger duration.
    const libraryItem = { media: { duration: 39569 } }
    const results = await bookFinder.search(libraryItem, 'audiobookdb', 'The Martian', 'Andy Weir')
    expect(results.map((r) => r.releaseId)).to.deep.equal(['RAffFyqchypK', 'dPL9fC7YnK8X'])

    // When the library runtime is closer to the shorter recording, the
    // shorter one wins: nearest-runtime, not largest-duration.
    searchStub.resolves([
      { title: 'The Martian', narrator: 'R.C. Bray', duration: 654, releaseId: 'dPL9fC7YnK8X' },
      { title: 'The Martian', narrator: 'Wil Wheaton', duration: 659, releaseId: 'RAffFyqchypK' }
    ])
    // 10:50:00 => 39000 s => 650 minutes: 654 (diff 4) is closer than 659 (diff 9).
    const shorterLibraryItem = { media: { duration: 39000 } }
    const shorterFirst = await bookFinder.search(shorterLibraryItem, 'audiobookdb', 'The Martian', 'Andy Weir')
    expect(shorterFirst.map((r) => r.releaseId)).to.deep.equal(['dPL9fC7YnK8X', 'RAffFyqchypK'])
  })
})

// Permanent transport regression: provider.search over a real loopback HTTP
// server with the real axios stack and the real p-throttle limiter, so a
// request that never leaves _request (e.g. an uninvoked throttled function
// settling the Promise.race immediately) returns zero candidates instead of
// the matched metadata.
describe('AudiobookDB loopback transport', () => {
  let server
  let provider
  let requests
  let savedApiKey

  beforeEach(async () => {
    savedApiKey = process.env.AUDIOBOOKDB_API_KEY
    process.env.AUDIOBOOKDB_API_KEY = 'test-loopback-key'
    requests = []
    server = http.createServer((req, res) => {
      // Exercise the real transport: the provider must send its own
      // User-Agent; a bare client gets rejected, so this is not a mock echo.
      if (!req.headers['user-agent']) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'user agent required' }))
        return
      }
      const send = (code, payload) => {
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(payload))
      }
      // axios url-joins baseUrl with absolute paths, doubling the slash;
      // compare on the normalized path so the server exercises the provider
      // as-is.
      const url = new URL(req.url, 'http://127.0.0.1')
      const norm = url.pathname.replace(/\/{2,}/g, '/')
      requests.push(`${req.method} ${norm}`)
      if (req.method === 'POST' && norm === '/api/search') {
        send(200, [
          { id: 'LOOPBOOK1', title: 'The Martian', people: [{ role: { name: 'Author' }, person: { name: 'Andy Weir' } }] }
        ])
        return
      }
      if (req.method === 'GET' && norm === '/api/books/LOOPBOOK1' && url.search === includeSuffix) {
        send(200, {
          ...bookWithReleases,
          id: 'LOOPBOOK1',
          releases: [
            {
              id: matchedReleaseId,
              duration: '10:53:35',
              releaseDate: '2013-03-22T00:00:00Z',
              publisher: { id: 'pub1', name: 'Podium Publishing' },
              language: { name: 'English' },
              people: [{ role: { name: 'Narrator' }, person: { id: 'n1', name: 'R.C. Bray' } }],
              external: [{ id: 'e1', itemId: 'B00B5HZGUG', category: { title: 'Audible' } }],
              isbn: '9781927628591'
            }
          ]
        })
        return
      }
      // Exact-ASIN endpoint: names the matched release for the known ASIN and
      // 404s for anything else (the miss case).
      if (req.method === 'GET' && norm === '/api/audiobooks/external/audible/B00B5HZGUG') {
        send(200, { ...bookWithReleases, id: 'LOOPBOOK1', matchedReleaseId })
        return
      }
      send(404, { message: 'not found' })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    provider = new AudiobookDB()
    provider.baseUrl = `http://127.0.0.1:${server.address().port}/api`
  })

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
    if (savedApiKey === undefined) delete process.env.AUDIOBOOKDB_API_KEY
    else process.env.AUDIOBOOKDB_API_KEY = savedApiKey
  })

  it('returns the matched recording from a real local API over real axios and p-throttle', async () => {
    const results = await provider.search('The Martian', 'Andy Weir')
    expect(results).to.have.length(1)
    const [candidate] = results
    expect(candidate.id).to.equal('LOOPBOOK1')
    expect(candidate.releaseId).to.equal(matchedReleaseId)
    expect(candidate.author).to.equal('Andy Weir')
    expect(candidate.narrator).to.equal('R.C. Bray')
    expect(candidate.asin).to.equal('B00B5HZGUG')
    expect(candidate.isbn).to.equal('9781927628591')
    expect(candidate.cover).to.equal(
      'https://cdn.audiobookdb.org/5b9dd618d7526bf4d08384d1506ca36e93515d8154df3f8485c6a93dc10c4045/source.jpg:book'
    )
    expect(requests).to.deep.equal(['POST /api/search', 'GET /api/books/LOOPBOOK1'])
  })

  it('resolves an explicit ASIN exactly and never runs a title search', async () => {
    const results = await provider.search('The Martian', 'Andy Weir', 'B00B5HZGUG')
    expect(results).to.have.length(1)
    expect(results[0].releaseId).to.equal(matchedReleaseId)
    expect(results[0].isbn).to.equal('9781927628591')
    expect(requests).to.deep.equal(['GET /api/audiobooks/external/audible/B00B5HZGUG'])
  })

  it('returns no candidates when the explicit ASIN is unknown (no title search)', async () => {
    const results = await provider.search('The Martian', 'Andy Weir', 'B00NOPE999')
    expect(results).to.deep.equal([])
    expect(requests).to.deep.equal(['GET /api/audiobooks/external/audible/B00NOPE999'])
  })

  it('sends no request at all for an invalid explicit ASIN containing path characters', async () => {
    const results = await provider.search('The Martian', 'Andy Weir', '../../etc/passwd')
    expect(results).to.deep.equal([])
    expect(requests).to.deep.equal([])
  })
})
