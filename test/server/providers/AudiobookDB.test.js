const http = require('http')
const { expect } = require('chai')

const provider = require('../../../server/providers/AudiobookDB')
const AudiobookDBError = require('../../../server/providers/AudiobookDBError')

const BOOK_ID = 'WQQDcMBQ3qUT'
const MATCHED_RELEASE = 'dPL9fC7YnK8X'
const COMPETING_RELEASE = 'RAffFyqchypK'
const ASIN = 'B00B5HZGUG'
const UNKNOWN_ASIN = 'B00NOPE999'

// BookDTO from GET /books/{id}: one candidate per BookReleaseRef recording.
// The description mixes safe Markdown with markup a full render must drop.
const book = {
  id: BOOK_ID,
  title: 'The Martian',
  description: 'The **Martian** log survives.\n\n<script>alert("unsafe")</script>\n\nA [link](javascript:alert(1)) and the rest.',
  people: [{ role: { name: 'Author' }, person: { id: 'a1', name: 'Andy Weir' } }],
  genres: [{ id: 'g1', title: 'Science' }],
  releases: [
    {
      id: MATCHED_RELEASE,
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
      external: [{ id: 'e2', itemId: 'B00COMPET1', category: { title: 'Audible' } }]
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

  beforeEach(async () => {
    savedBaseUrl = provider.baseUrl
    previousApiKey = process.env.AUDIOBOOKDB_API_KEY
    process.env.AUDIOBOOKDB_API_KEY = 'loopback-test-key'
    requests = []
    rateLimited = false
    omitMatchedRelease = false
    server = http.createServer((req, res) => {
      // Real transport: paths are recorded as the provider sent them.
      const url = new URL(req.url, 'http://127.0.0.1')
      const path = url.pathname.replace(/\/{2,}/g, '/')
      requests.push(`${req.method} ${path}`)
      const send = (status, body, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
        res.end(JSON.stringify(body))
      }
      if (path === '/api/search') {
        if (rateLimited) return send(429, { errors: [{ detail: 'quota exceeded' }] }, { 'Retry-After': '7' })
        return send(200, searchHits)
      }
      const exact = path.match(/^\/api\/audiobooks\/external\/audible\/([^/]+)$/)
      if (exact) {
        if (decodeURIComponent(exact[1]) !== ASIN) return send(404, { message: 'not found' })
        return send(200, omitMatchedRelease ? { ...book } : { ...book, matchedReleaseId: MATCHED_RELEASE })
      }
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
    if (server) {
      server.closeAllConnections?.()
      await new Promise((resolve) => server.close(resolve))
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
    expect(requests).to.deep.equal([`GET /api/audiobooks/external/audible/${ASIN}`])
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
    expect(requests).to.have.length(2)
    expect(requests[0]).to.equal('POST /api/search')
    expect(requests[1]).to.equal(`GET /api/books/${BOOK_ID}`)
  })

  it('skips a request with no time left for its slot and serves the next search', async () => {
    expect(await provider.search('', '', UNKNOWN_ASIN)).to.deep.equal([])

    const failure = await provider.search('', '', UNKNOWN_ASIN, 1).catch((error) => error)
    expect(failure).to.be.instanceOf(AudiobookDBError)
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
    expect(failure).to.be.instanceOf(AudiobookDBError)
    expect(failure.code).to.equal('audiobookdb_rate_limited')
    expect(failure.status).to.equal(429)
    expect(failure.retryAfter).to.equal(7)
  })
})
