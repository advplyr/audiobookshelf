const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')
const Logger = require('../../../server/Logger')
const utils = require('../../../server/utils/podcastUtils')

describe('podcastUtils compatibility', () => {
  let adapter
  let previousTimeout
  let previousFilter

  function feed(items = '<item><title>Episode</title><enclosure url="https://example.com/audio.mp3" /></item>', metadata = '<title>Podcast</title>') {
    return `<rss xmlns:itunes="urn:itunes" xmlns:media="urn:media" xmlns:content="urn:content" xmlns:psc="urn:psc" xmlns:podcast="urn:podcast" xmlns:atom="urn:atom"><channel>${metadata}${items}</channel></rss>`
  }

  function respond(body, headers = {}) {
    const response = { data: Buffer.isBuffer(body) ? body : Buffer.from(body), headers, status: 200, statusText: 'OK' }
    adapter.callsFake((config) => Promise.resolve({ ...response, config }))
  }

  async function rejected(promise) {
    let failure
    try { await promise } catch (error) { failure = error }
    return failure
  }

  beforeEach(() => {
    previousTimeout = global.PodcastDownloadTimeout
    previousFilter = global.DisableSsrfRequestFilter
    global.PodcastDownloadTimeout = 1234
    global.DisableSsrfRequestFilter = () => true
    adapter = sinon.stub(axios.defaults, 'adapter')
    for (const method of ['debug', 'error', 'warn', 'info']) sinon.stub(Logger, method)
  })

  afterEach(() => {
    for (const call of adapter.getCalls()) {
      call.args[0].httpAgent?.destroy()
      call.args[0].httpsAgent?.destroy()
    }
    sinon.restore()
    global.PodcastDownloadTimeout = previousTimeout
    global.DisableSsrfRequestFilter = previousFilter
  })

  it('preserves CommonJS exports and rejects empty, malformed and non-RSS documents', async () => {
    expect(Object.keys(utils)).to.deep.equal(['parsePodcastRssFeedXml', 'getPodcastFeed', 'findMatchingEpisodes', 'findMatchingEpisodesInFeed'])
    for (const xml of [null, undefined, '', '<rss>', '<other />', '<rss />', feed('')]) {
      expect(await utils.parsePodcastRssFeedXml(xml)).to.equal(null)
    }
  })

  it('parses channel metadata, nested categories and sanitized episode text', async () => {
    const metadata = '<title language="en">Podcast</title><language>en</language><itunes:author>Author</itunes:author><itunes:explicit>yes</itunes:explicit><itunes:type>serial</itunes:type><itunes:image href="https://example.com/cover.jpg" /><atom:link href="https://example.com/feed" /><description><![CDATA[<p>Show &amp; info</p>]]></description><itunes:category text="Arts"><itunes:category text="Books" /></itunes:category>'
    const item = '<item><title>Episode</title><itunes:subtitle><![CDATA[ <b>Subtitle</b> ]]></itunes:subtitle><enclosure url=" https://example.com/audio.mp3 " length="42" type="audio/mpeg" /><pubDate format="rfc">Wed, 01 Jan 2025 00:00:00 GMT</pubDate><guid isPermaLink="false">episode-id</guid><content:encoded><![CDATA[<p>Full</p><script>bad()</script>]]></content:encoded><description><![CDATA[<b>Plain &amp; text</b>]]></description><itunes:duration>01:00</itunes:duration><podcast:chapters url="https://example.com/chapters.json" /></item>'
    const result = await utils.parsePodcastRssFeedXml(feed(item, metadata), false, true)
    expect(result.rawJson.rss.channel).to.have.length(1)
    expect(result.podcast.metadata).to.include({ title: 'Podcast', language: 'en', author: 'Author', explicit: 'yes', type: 'serial', image: 'https://example.com/cover.jpg', feedUrl: 'https://example.com/feed', description: '<p>Show &amp; info</p>', descriptionPlain: 'Show & info' })
    expect(result.podcast.metadata.categories).to.deep.equal(['Arts:Books'])
    expect(result.podcast.episodes[0]).to.include({ title: 'Episode', subtitle: '<b>Subtitle</b>', description: '<p>Full</p>', descriptionPlain: 'Plain & text', durationSeconds: 60, guid: 'episode-id', publishedAt: Date.parse('2025-01-01T00:00:00Z'), chaptersType: 'application/json' })
    expect(result.podcast.episodes[0].enclosure).to.deep.equal({ url: 'https://example.com/audio.mp3', length: '42', type: 'audio/mpeg' })
  })

  it('preserves raw nested channel text and the legacy standard-image fallback', async () => {
    const metadata = '<title><span>Nested</span></title><image><url>https://example.com/standard.jpg</url></image><itunes:new-feed-url>https://example.com/new</itunes:new-feed-url><atom:link href="https://example.com/old" />'
    const result = await utils.parsePodcastRssFeedXml(feed(undefined, metadata))
    expect(result).not.to.have.property('rawJson')
    expect(result.podcast.metadata.title).to.deep.equal({ span: ['Nested'] })
    expect(result.podcast.metadata.image).to.equal(null)
    expect(result.podcast.metadata.feedUrl).to.equal('https://example.com/new')
  })

  it('skips missing enclosures but counts raw items in metadata-only mode', async () => {
    const xml = feed('<item><title>Invalid</title></item><item><media:content url="https://example.com/a.mp3" type="audio/mpeg" /></item>')
    const parsed = await utils.parsePodcastRssFeedXml(xml)
    expect(parsed.podcast.episodes).to.have.length(1)
    expect(parsed.podcast.episodes[0]).to.include({ title: '', guid: null, publishedAt: null, description: '', durationSeconds: null })
    const metadataOnly = await utils.parsePodcastRssFeedXml(xml, true)
    expect(metadataOnly.podcast.numEpisodes).to.equal(2)
    expect(metadataOnly.podcast).not.to.have.property('episodes')
  })

  it('preserves default values for invalid dates, empty GUIDs and zero durations', async () => {
    const item = '<item><enclosure url="https://example.com/a.mp3" /><pubDate>invalid</pubDate><guid /><itunes:duration>0</itunes:duration><description><p>Nested text</p></description></item>'
    const result = await utils.parsePodcastRssFeedXml(feed(item))
    expect(result.podcast.episodes[0]).to.include({ publishedAt: null, guid: null, durationSeconds: null, description: 'Nested text', descriptionPlain: 'Nested text' })
  })

  it('parses complete chapter lists and discards lists containing invalid chapters', async () => {
    const base = '<enclosure url="https://example.com/a.mp3" /><itunes:duration>10</itunes:duration>'
    const valid = '<psc:chapters><psc:chapter title="First" start="00:00:00" /><psc:chapter title="Second" start="00:00:05" /></psc:chapters>'
    const result = await utils.parsePodcastRssFeedXml(feed(`<item>${base}${valid}</item>`))
    expect(result.podcast.episodes[0].chapters).to.deep.equal([{ id: 0, title: 'First', start: 0, end: 5 }, { id: 1, title: 'Second', start: 5, end: 10 }])
    const invalid = valid.replace('00:00:05', 'invalid')
    const invalidResult = await utils.parsePodcastRssFeedXml(feed(`<item>${base}${invalid}</item>`))
    expect(invalidResult.podcast.episodes[0].chapters).to.deep.equal([])
    expect(Logger.warn.calledOnce).to.equal(true)
  })

  it('preserves rejection for the legacy media-content selection with an earlier URL-less audio item', async () => {
    const item = '<item><media:content type="audio/mpeg" /><media:content type="audio/mpeg" url="https://example.com/a.mp3" /></item>'
    expect(await rejected(utils.parsePodcastRssFeedXml(feed(item)))).to.be.instanceOf(TypeError)
  })

  it('requests feed buffers with the existing timeout, headers and SSRF agents', async () => {
    global.DisableSsrfRequestFilter = undefined
    respond(feed())
    const result = await utils.getPodcastFeed('https://example.com/private')
    const config = adapter.firstCall.args[0]
    expect(config).to.include({ url: 'https://example.com/private', timeout: 1234, responseType: 'arraybuffer', method: 'get' })
    expect(config.headers['User-Agent']).to.equal('audiobookshelf (+https://audiobookshelf.org; like iTMS)')
    expect(config.headers.Accept).to.equal('application/rss+xml, application/xhtml+xml, application/xml, */*;q=0.8')
    expect(config.httpAgent.createConnection).to.be.a('function')
    expect(config.httpsAgent.createConnection).to.be.a('function')
    expect(result.metadata.feedUrl).to.equal('https://example.com/private')
  })

  it('keeps the CBC user agent, SSRF bypass and latin1 decoding', async () => {
    respond(Buffer.from(feed(undefined, '<title>Caf\u00e9</title>'), 'latin1'), { 'content-type': 'text/xml; charset=ISO-8859-1' })
    const result = await utils.getPodcastFeed('https://www.cbc.ca/feed', true)
    expect(result.metadata.title).to.equal('Caf\u00e9')
    expect(result.numEpisodes).to.equal(1)
    const config = adapter.firstCall.args[0]
    expect(config.headers['User-Agent']).to.equal('audiobookshelf (+https://audiobookshelf.org; like iTMS) - CBC')
    expect(config.httpAgent).to.equal(null)
    expect(config.httpsAgent).to.equal(null)
  })

  it('uses live parser exports and mutates the decoded response as before', async () => {
    const response = { data: Buffer.from('xml'), headers: {}, status: 200, statusText: 'OK' }
    adapter.resolves(response)
    const podcast = { metadata: { feedUrl: 'advertised' }, episodes: [] }
    const parser = sinon.stub(utils, 'parsePodcastRssFeedXml').resolves({ podcast })
    expect(await utils.getPodcastFeed('https://example.com/feed', true)).to.equal(podcast)
    expect(parser.calledOnceWithExactly('xml', true)).to.equal(true)
    expect(response.data).to.equal('xml')
  })

  it('returns null for failed requests, empty responses and invalid RSS', async () => {
    adapter.rejects(new Error('offline'))
    expect(await utils.getPodcastFeed('https://example.com/feed')).to.equal(null)
    for (const body of ['', '<other />']) {
      respond(body)
      expect(await utils.getPodcastFeed('https://example.com/feed')).to.equal(null)
    }
  })

  it('retries HTTP-to-HTTPS redirect protocol failures through the live export', async () => {
    respond(feed())
    adapter.onFirstCall().rejects({ code: 'ERR_FR_REDIRECTION_FAILURE', cause: { code: 'ERR_INVALID_PROTOCOL' }, request: { _options: { protocol: 'https:', href: 'https://example.com/feed' } } })
    const request = utils.getPodcastFeed
    const spy = sinon.spy(utils, 'getPodcastFeed')
    const result = await request('http://example.com/feed', true)
    expect(spy.calledOnceWithExactly('https://example.com/feed', true)).to.equal(true)
    expect(adapter.callCount).to.equal(2)
    expect(result.metadata.feedUrl).to.equal('https://example.com/feed')
  })

  it('keeps malformed redirect error objects as rejections', async () => {
    adapter.rejects({ code: 'ERR_FR_REDIRECTION_FAILURE' })
    expect(await rejected(utils.getPodcastFeed('http://example.com/feed'))).to.be.instanceOf(TypeError)
  })

  it('matches titles with diacritics and preserves episode references', async () => {
    const parsed = await utils.parsePodcastRssFeedXml(feed('<item><title>Caf\u00e9</title><enclosure url="https://example.com/a.mp3" /></item><item><title>Completely unrelated</title><enclosure url="https://example.com/b.mp3" /></item>'))
    const matches = utils.findMatchingEpisodesInFeed(parsed.podcast, 'Cafe', 0)
    expect(matches).to.have.length(1)
    expect(matches[0].episode).to.equal(parsed.podcast.episodes[0])
    expect(utils.findMatchingEpisodesInFeed(null, 'Cafe')).to.equal(null)
    expect(utils.findMatchingEpisodesInFeed({ numEpisodes: 2 }, 'Cafe')).to.equal(null)
    expect(utils.findMatchingEpisodesInFeed({ episodes: [] }, 'Cafe')).to.deep.equal([])
  })

  it('finds matches using live exports and handles rejected feed promises', async () => {
    const getFeed = sinon.stub(utils, 'getPodcastFeed').rejects(new Error('offline'))
    const match = sinon.stub(utils, 'findMatchingEpisodesInFeed').returns([])
    const find = utils.findMatchingEpisodes
    expect(await find('https://example.com/feed', 'Title')).to.deep.equal([])
    expect(getFeed.calledOnceWithExactly('https://example.com/feed')).to.equal(true)
    expect(match.calledOnceWithExactly(null, 'Title')).to.equal(true)
  })
})
