const http = require('http')
const { expect } = require('chai')

const provider = require('../../../server/providers/AudiobookDB')

const BOOK_ID = 'WQQDcMBQ3qUT'
const MATCHED_RELEASE = 'dPL9fC7YnK8X'
const COMPETING_RELEASE = 'RAffFyqchypK'
const MERGED_BOOK = 'LoseBook0001'
const OTHER_BOOK = 'NextBook0001'
const ASIN = 'B00B5HZGUG'
const COMPETING_ASIN = 'B00COMPET1'
const UNKNOWN_ASIN = 'B00NOPE999'
const BOOK_INCLUDE = '?include=releasesExternal,people,series,genres,tags,externalItems,images'
const releaseCover = { sourceUrl: 'https://example.invalid/first-release.jpg' }

// BookDTO from GET /books/{id}: one candidate per BookReleaseRef recording.
// The description mixes safe Markdown with markup a full render must drop.
const book = {
  id: BOOK_ID,
  title: 'The Martian',
  description: 'The **Martian** log survives.\n\n<script>alert("unsafe")</script>\n\nA [link](javascript:alert(1)) and the rest.',
  people: [{ role: { name: 'Author' }, person: { id: 'a1', name: 'Andy Weir' } }],
  genres: [{ id: 'g1', title: 'Science' }],
  series: [{ series: { title: 'Mission logs' }, ordinal: '2.5', position: { label: 'Books 2.5–3', sortKey: 2.5 } }, { series: { title: 'Audio editions' }, position: { label: 'Book 7', sortKey: 7 } }],
  coverImage: releaseCover,
  images: [releaseCover],
  releases: [
    {
      id: MATCHED_RELEASE,
      images: [releaseCover],
      duration: '10:53:35',
      releaseDate: '2013-03-22T00:00:00Z',
      publishers: [{ id: 'p1', name: 'Podium Publishing', creditedName: 'Podium Publishing' }],
      language: { name: 'English' },
      people: [{ role: { name: 'Narrator' }, person: { id: 'n1', name: 'R.C. Bray' } }],
      external: [{ id: 'e1', itemId: ASIN, category: { title: 'Audible' } }],
      isbn: '9781927628591'
    },
    {
      id: COMPETING_RELEASE,
      duration: '10:59:29',
      releaseDate: '2014-09-09T00:00:00Z',
      publishers: [{ id: 'p2', name: 'Audible Studios' }],
      language: { name: 'English' },
      people: [{ role: { name: 'Narrator' }, person: { id: 'n2', name: 'Wil Wheaton' } }],
      external: [{ id: 'e2', itemId: COMPETING_ASIN, category: { title: 'Audible' } }]
    }
  ]
}

// Search hits carry indexed people in string form; book detail supplies releases.
const searchHits = [{ id: BOOK_ID, title: 'The Martian', people: [{ role: { name: 'Author' }, person: { name: 'Andy Weir' } }] }]

describe('AudiobookDB provider over loopback HTTP', function () {
  this.timeout(5000)
  let server
  let savedBaseUrl
  let previousApiKey
  let requests
  let rateLimited
  let omitMatchedRelease
  let mergedLocation
  let decoy

  beforeEach(async () => {
    savedBaseUrl = provider.baseUrl
    previousApiKey = process.env.AUDIOBOOKDB_API_KEY
    process.env.AUDIOBOOKDB_API_KEY = 'loopback-test-key'
    requests = []
    rateLimited = false
    omitMatchedRelease = false
    mergedLocation = null
    decoy = null
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      const path = url.pathname
      requests.push(`${req.method} ${path}${url.search}`)
      const send = (status, body, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
        res.end(JSON.stringify(body))
      }
      if (path === '/api/search') {
        if (rateLimited) return send(429, { errors: [{ detail: 'quota exceeded' }] }, { 'Retry-After': '7' })
        const hits = mergedLocation ? [{ id: MERGED_BOOK, title: book.title }, ...searchHits, { id: OTHER_BOOK, title: 'Another book' }] : searchHits
        return send(200, hits)
      }
      const exact = path.match(/^\/api\/audiobooks\/external\/audible\/([^/]+)$/)
      if (exact) {
        const asin = decodeURIComponent(exact[1])
        const matchedReleaseId = asin === ASIN ? MATCHED_RELEASE : asin === COMPETING_ASIN ? COMPETING_RELEASE : null
        if (!matchedReleaseId) return send(404, { message: 'not found' })
        return send(200, omitMatchedRelease ? book : { ...book, matchedReleaseId })
      }
      if (path === `/api/books/${MERGED_BOOK}` && mergedLocation) return send(301, null, { Location: mergedLocation })
      if (path === `/api/books/${OTHER_BOOK}`) return send(200, { id: OTHER_BOOK, title: 'Another book' })
      if (path === `/api/books/${BOOK_ID}`) return send(200, book)
      return send(404, { message: 'not found' })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    provider.baseUrl = `http://127.0.0.1:${server.address().port}/api`
  })

  afterEach(async () => {
    provider.baseUrl = savedBaseUrl
    if (previousApiKey === undefined) delete process.env.AUDIOBOOKDB_API_KEY
    else process.env.AUDIOBOOKDB_API_KEY = previousApiKey
    for (const listener of [server, decoy]) {
      if (!listener) continue
      listener.closeAllConnections()
      await new Promise((resolve) => listener.close(resolve))
    }
  })

  it('maps an exact ASIN only to its matched release when a competing release exists', async () => {
    const results = await provider.search('The Martian', 'Andy Weir', ASIN)
    expect(results).to.have.length(1)
    expect(results[0]).to.include({
      id: BOOK_ID,
      releaseId: MATCHED_RELEASE,
      asin: ASIN,
      isbn: '9781927628591',
      narrator: 'R.C. Bray',
      publisher: 'Podium Publishing'
    })
    expect(results[0].releaseId).to.not.equal(COMPETING_RELEASE)
    expect(results[0].narrator).to.not.contain('Wil Wheaton')
    expect(results[0].cover).to.equal(releaseCover.sourceUrl)
    expect(requests).to.deep.equal([`GET /api/audiobooks/external/audible/${ASIN}`])
  })

  it('does not give an exact recording another release’s fallback cover', async () => {
    const results = await provider.search('', '', COMPETING_ASIN)
    expect(results.map(({ releaseId }) => releaseId)).to.deep.equal([COMPETING_RELEASE])
    expect(results[0]).not.to.have.property('cover')
  })

  it('returns no candidate when the exact ASIN names no matched release, and does not title-search', async () => {
    omitMatchedRelease = true
    expect(await provider.search('The Martian', 'Andy Weir', ASIN)).to.deep.equal([])
    expect(requests).to.deep.equal([`GET /api/audiobooks/external/audible/${ASIN}`])
  })

  it('treats an unknown exact ASIN 404 as a miss, without error or title fallback', async () => {
    expect(await provider.search('The Martian', 'Andy Weir', UNKNOWN_ASIN)).to.deep.equal([])
    expect(requests).to.deep.equal([`GET /api/audiobooks/external/audible/${UNKNOWN_ASIN}`])
  })

  it('keeps a title match for human selection when the author differs, with release fields and a safe full description', async () => {
    const results = await provider.search('The Martian', 'Not Andy Weir')
    expect(results.map(({ releaseId }) => releaseId)).to.have.members([MATCHED_RELEASE, COMPETING_RELEASE])
    const candidate = results.find(({ releaseId }) => releaseId === MATCHED_RELEASE)
    expect(candidate).to.include({
      id: BOOK_ID,
      releaseId: MATCHED_RELEASE,
      author: 'Andy Weir',
      narrator: 'R.C. Bray',
      publisher: 'Podium Publishing'
    })
    expect(candidate.asin).to.equal(ASIN)
    // The full description survives as sanitized HTML, so the human can read it.
    expect(candidate.description).to.include('<strong>Martian</strong>')
    expect(candidate.description).to.include('and the rest.')
    expect(candidate.description).to.not.include('<script')
    expect(candidate.description).to.not.include('javascript:')
    expect(candidate.descriptionPlain).to.include('The Martian log survives.').and.include('and the rest.').and.not.include('<')
    expect(candidate.series).to.deep.equal([{ series: 'Mission logs', sequence: '2.5' }, { series: 'Audio editions', sequence: '7' }])
    expect(requests).to.deep.equal(['POST /api/search', `GET /api/books/${BOOK_ID}${BOOK_INCLUDE}`])
  })

  it('uses the merged book once and keeps the other search results', async () => {
    mergedLocation = `/api/books/${BOOK_ID}`
    const results = await provider.search('The Martian')
    expect(results.map(({ id, releaseId }) => [id, releaseId])).to.deep.equal([[BOOK_ID, MATCHED_RELEASE], [BOOK_ID, COMPETING_RELEASE], [OTHER_BOOK, undefined]])
    expect(requests).to.deep.equal(['POST /api/search', `GET /api/books/${MERGED_BOOK}${BOOK_INCLUDE}`, `GET /api/books/${BOOK_ID}${BOOK_INCLUDE}`, `GET /api/books/${OTHER_BOOK}${BOOK_INCLUDE}`])
  })

  it('does not send a request to a different redirect origin', async () => {
    const redirectedKeys = []
    decoy = http.createServer((req, res) => {
      redirectedKeys.push(req.headers['x-api-key'])
      res.end('{}')
    })
    await new Promise((resolve) => decoy.listen(0, '127.0.0.1', resolve))
    mergedLocation = `http://127.0.0.1:${decoy.address().port}/api/books/${BOOK_ID}`

    const failure = await provider.search('The Martian').catch((error) => error)
    expect(failure).to.be.instanceOf(provider.Error).and.include({ code: 'audiobookdb_unavailable', status: 503 })
    expect(redirectedKeys).to.deep.equal([])
    expect(requests).to.deep.equal(['POST /api/search', `GET /api/books/${MERGED_BOOK}${BOOK_INCLUDE}`])
  })

  it('does not follow a second merge redirect', async () => {
    mergedLocation = `/api/books/${MERGED_BOOK}`
    const failure = await provider.search('The Martian').catch((error) => error)
    expect(failure).to.be.instanceOf(provider.Error).and.include({ code: 'audiobookdb_unavailable', status: 503 })
    expect(requests).to.deep.equal(['POST /api/search', `GET /api/books/${MERGED_BOOK}${BOOK_INCLUDE}`, `GET /api/books/${MERGED_BOOK}${BOOK_INCLUDE}`])
  })

  it('skips a request with no time left for its slot and serves the next search', async () => {
    expect(await provider.search('', '', UNKNOWN_ASIN)).to.deep.equal([])

    const failure = await provider.search('', '', UNKNOWN_ASIN, 1).catch((error) => error)
    expect(failure).to.be.instanceOf(provider.Error)
    expect(failure.code).to.equal('audiobookdb_timeout')
    expect(failure.status).to.equal(504)
    expect((await provider.search('', '', ASIN)).map((candidate) => candidate.releaseId)).to.deep.equal([MATCHED_RELEASE])
    expect(requests).to.deep.equal([
      `GET /api/audiobooks/external/audible/${UNKNOWN_ASIN}`,
      `GET /api/audiobooks/external/audible/${ASIN}`
    ])
  })

  it('treats a 404 as a miss but a 429 as a typed rate-limit error carrying Retry-After', async () => {
    expect(await provider.search('', '', UNKNOWN_ASIN)).to.deep.equal([])

    rateLimited = true
    let failure
    try {
      await provider.search('The Martian', 'Andy Weir')
    } catch (error) {
      failure = error
    }
    expect(failure).to.be.instanceOf(provider.Error)
    expect(failure.code).to.equal('audiobookdb_rate_limited')
    expect(failure.status).to.equal(429)
    expect(failure.retryAfter).to.equal(7)
  })
})
