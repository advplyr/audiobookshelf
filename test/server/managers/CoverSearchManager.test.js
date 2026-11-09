const http = require('http')
const sinon = require('sinon')
const { expect } = require('chai')
const CoverSearchManager = require('../../../server/managers/CoverSearchManager')
const BookFinder = require('../../../server/finders/BookFinder')
const { LogLevel } = require('../../../server/utils/constants')
const Logger = require('../../../server/Logger')
Logger.setLogLevel(LogLevel.INFO)

// Permanent transport regression: CoverSearchManager over the real
// BookFinder.audiobookdb instance against a real loopback HTTP server, so a
// cover lookup is proven through the real axios stack and the real
// p-throttle limiter, with the cover-only contract verified against the
// requests the server actually receives.
describe('CoverSearchManager (AudiobookDB loopback transport)', () => {
  let server
  let requests
  let onResult
  let onComplete
  let onError
  let savedApiKey
  const savedBaseUrl = BookFinder.audiobookdb.baseUrl
  // A bare storage key plus the full-resolution sourceUrl, as the API
  // returns it: the manager must stream the full-size original, not a
  // resized CDN derivative.
  const coverKey = 'https://cdn.example.org/9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a'
  const coverUrl = `${coverKey}/source.jpg:book`

  beforeEach(async () => {
    savedApiKey = process.env.AUDIOBOOKDB_API_KEY
    process.env.AUDIOBOOKDB_API_KEY = 'test-loopback-key'
    requests = []
    onResult = sinon.spy()
    onComplete = sinon.spy()
    onError = sinon.spy()

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
        // Real SearchDocumentBook shape: the cover lives in image.url. The
        // stored author credit is deliberately wrong; a cover-only lookup
        // must keep the hit (and stream the cover) despite it, while normal
        // matching would filter it out.
        send(200, [
          {
            id: 'LOOPBOOK1',
            title: 'The Martian',
            image: { url: coverKey, sourceUrl: coverUrl },
            people: [{ role: { name: 'Author' }, person: { name: 'Some Other Author' } }]
          }
        ])
        return
      }
      // Any detail fanout (books/releases) is a contract violation for a
      // cover-only lookup; it must not happen.
      send(404, { message: 'not found' })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    BookFinder.audiobookdb.baseUrl = `http://127.0.0.1:${server.address().port}/api`
  })

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
    BookFinder.audiobookdb.baseUrl = savedBaseUrl
    if (savedApiKey === undefined) delete process.env.AUDIOBOOKDB_API_KEY
    else process.env.AUDIOBOOKDB_API_KEY = savedApiKey
  })

  it('streams the cover from a /search hit without detail fanout, keeping a wrong-author hit', async () => {
    await CoverSearchManager.startSearch(
      'req-loopback-1',
      { title: 'The Martian', author: 'Andy Weir', provider: 'audiobookdb' },
      onResult,
      onComplete,
      onError
    )

    expect(onResult.calledOnce).to.be.true
    expect(onResult.firstCall.args[0]).to.deep.equal({
      provider: 'audiobookdb',
      covers: [coverUrl],
      total: 1
    })
    sinon.assert.calledOnce(onComplete)
    sinon.assert.notCalled(onError)
    // Cover-only: exactly one /search POST, no /books/ or /releases/ detail fanout.
    expect(requests).to.deep.equal(['POST /api/search'])
  })

  it('emits no result and completes without error when the search returns no hits', async () => {
    server.removeAllListeners('request')
    server.on('request', (req, res) => {
      requests.push(req.method)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
    })

    await CoverSearchManager.startSearch(
      'req-loopback-2',
      { title: 'The Martian', author: 'Andy Weir', provider: 'audiobookdb' },
      onResult,
      onComplete,
      onError
    )

    sinon.assert.notCalled(onResult)
    sinon.assert.calledOnce(onComplete)
    sinon.assert.notCalled(onError)
  })
})
