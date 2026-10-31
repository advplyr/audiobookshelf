const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')
const Logger = require('../../../server/Logger')
const Database = require('../../../server/Database')
const Audible = require('../../../server/providers/Audible')
const Audnexus = require('../../../server/providers/Audnexus')
const CustomProviderAdapter = require('../../../server/providers/CustomProviderAdapter')

describe('Audible, Audnexus and custom provider compatibility', () => {
  let get, previousInstance
  beforeEach(() => {
    previousInstance = Audnexus._instance
    Audnexus._instance = null
    get = sinon.stub(axios, 'get')
    for (const level of ['debug', 'info', 'warn', 'error']) sinon.stub(Logger, level)
  })
  afterEach(() => {
    sinon.restore()
    Audnexus._instance = previousInstance
  })
  it('keeps Audible ASIN priority and invalid region fallback', async () => {
    get.resolves({ data: { asin: 'B012345678', title: 'Title', runtimeLengthMin: '120', genres: [{ type: 'genre', name: 'Fiction' }, { type: 'genre', name: 'Fiction' }], seriesPrimary: { name: 'Series', position: 'Book 1.5' } } })
    const [book] = await new Audible().search('Title', '', 'b012345678', 'invalid')
    expect(get.firstCall.args[0]).to.equal('https://api.audnex.us/books/B012345678')
    expect(get.callCount).to.equal(1)
    expect(book).to.include({ duration: 120, region: null, asin: 'B012345678' })
    expect(book.genres).to.deep.equal(['Fiction'])
    expect(book.series).to.deep.equal([{ series: 'Series', sequence: '1.5' }])
  })
  it('keeps Audible catalog fallback and drops missing ASIN results', async () => {
    get.onFirstCall().resolves({ data: { products: [{ asin: 'B012345678' }, { asin: 'B012345679' }] } })
    get.onSecondCall().resolves({ data: { asin: 'B012345678', title: 'Title' } })
    get.onThirdCall().resolves({ data: {} })
    const results = await new Audible().search('Title', 'A', '', 'uk')
    expect(results).to.have.length(1)
    expect(get.firstCall.args[0]).to.include('api.audible.co.uk/1.0/catalog/products?')
    get.rejects(new Error('offline'))
    expect(await new Audible().search('Title', '', '', '')).to.deep.equal([])
  })
  it('preserves Audnexus singleton and closest-name mutation', async () => {
    const api = new Audnexus()
    expect(new Audnexus()).to.equal(api)
    api.limiter = (request) => request
    const authors = [{ asin: 'B012345678', name: 'Writer' }, { asin: 'B012345679', name: 'Other' }]
    get.onFirstCall().resolves({ data: authors })
    get.onSecondCall().resolves({ data: { asin: 'B012345678', name: 'Writer', description: 'Bio' } })
    expect(await api.findAuthorByName('Writer', 'us')).to.deep.equal({ asin: 'B012345678', name: 'Writer', description: 'Bio', image: null })
    expect(authors[0].levenshteinDistance).to.equal(0)
    expect(api.authorRequest('invalid', '')).to.equal(null)
  })
  it('retries 429 with retry-after and rethrows other errors', async () => {
    const api = new Audnexus()
    const clock = sinon.useFakeTimers()
    const request = sinon.stub()
    request.onFirstCall().rejects({ response: { status: 429, headers: { 'retry-after': '2' } } })
    request.onSecondCall().resolves({ data: 'ok' })
    const pending = api._processRequest(request)
    await clock.tickAsync(1999)
    expect(request.callCount).to.equal(1)
    await clock.tickAsync(1)
    expect(await pending).to.deep.equal({ data: 'ok' })
    const failure = new Error('offline')
    request.rejects(failure)
    let thrown
    try { await api._processRequest(request) } catch (error) { thrown = error }
    expect(thrown).to.equal(failure)
  })
  it('keeps custom auth, conversions, sanitization and omitted fields', async () => {
    sinon.stub(Database, 'customMetadataProviderModel').get(() => ({ findByPk: sinon.stub().resolves({ url: 'https://provider', authHeaderValue: 'secret-stub' }) }))
    get.resolves({ data: { matches: [{ title: ['A', 2], author: 'Writer', description: '<p>Text</p><script>bad</script>', genres: ' A, B, A, ', tags: [1], series: [{ series: 'One', sequence: 0 }, { series: 'Two', sequence: 2 }, {}], duration: '42', extra: true }] } })
    const [book] = await new CustomProviderAdapter().search('Title', 'Writer', 'isbn', 'custom-1', 'book')
    expect(book).to.deep.equal({ title: 'A,2', author: 'Writer', description: '<p>Text</p>', genres: ['A', 'B'], series: [{ series: 'One' }, { series: 'Two', sequence: '2' }], duration: 42 })
    expect(get.firstCall.args[1].headers).to.deep.equal({ Authorization: 'secret-stub' })
    expect(get.firstCall.args[0]).to.equal('https://provider/search?mediaType=book&query=Title&author=Writer&isbn=isbn')
  })
  it('preserves custom missing-provider and malformed-response errors but swallows request failures', async () => {
    const findByPk = sinon.stub().resolves(null)
    sinon.stub(Database, 'customMetadataProviderModel').get(() => ({ findByPk }))
    const api = new CustomProviderAdapter()
    let thrown
    try { await api.search('', '', '', 'custom-1', 'book') } catch (error) { thrown = error }
    expect(thrown.message).to.equal('Custom provider not found for the given id')
    findByPk.resolves({ url: 'https://provider' })
    get.resolves({ data: {} })
    try { await api.search('', '', '', 'custom-1', 'book') } catch (error) { thrown = error }
    expect(thrown.message).to.equal('Custom provider returned malformed response')
    get.rejects(new Error('offline'))
    expect(await api.search('', '', '', 'custom-1', 'book')).to.deep.equal([])
  })
})
