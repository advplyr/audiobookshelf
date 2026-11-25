const iTunes = require('../../../server/providers/iTunes')
const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')

describe('iTunes', () => {
  let itunes

  beforeEach(() => {
    itunes = new iTunes()
  })

  describe('cleanAudiobook', () => {
    function authorFrom(artistName) {
      return itunes.cleanAudiobook({ artistName }).author
    }

    it('should return an empty string if artistName is missing', () => {
      expect(authorFrom()).to.equal('')
      expect(authorFrom('')).to.equal('')
    })

    it('should keep a single author without commas', () => {
      expect(authorFrom('Joy Fielding')).to.equal('Joy Fielding')
    })

    it('should strip commas from a single author with a credential', () => {
      expect(authorFrom('Rick Hanson, PhD')).to.equal('Rick Hanson PhD')
    })

    it('should split two authors joined by an ampersand', () => {
      expect(authorFrom('Name1 & Name2')).to.equal('Name1, Name2')
    })

    it('should split three authors using commas and an ampersand', () => {
      expect(authorFrom('Keltie Knight, Becca Tobin & Jac Vanek')).to.equal('Keltie Knight, Becca Tobin, Jac Vanek')
    })

    it('should glue a one-word credential onto the previous author before the ampersand', () => {
      expect(authorFrom('Rick Hanson, PhD & Jane Doe')).to.equal('Rick Hanson PhD, Jane Doe')
    })

    it('should glue several one-word credentials in a row', () => {
      expect(authorFrom('Rick Hanson, PhD, MD & Jane Doe')).to.equal('Rick Hanson PhD MD, Jane Doe')
    })

    it('should strip commas from the last author', () => {
      expect(authorFrom('Rick Hanson & Jane Doe, PhD')).to.equal('Rick Hanson, Jane Doe PhD')
    })

    it('should glue credentials before the ampersand and strip commas from the last author', () => {
      expect(authorFrom('Rick Hanson, PhD & Jane Doe, PhD')).to.equal('Rick Hanson PhD, Jane Doe PhD')
    })
  })

  describe('search', () => {
    let getStub
    let savedSearchUrl

    beforeEach(() => {
      savedSearchUrl = process.env.ITUNES_SEARCH_URL
      delete process.env.ITUNES_SEARCH_URL
      getStub = sinon.stub(axios, 'get').resolves({ data: { results: [] } })
    })

    afterEach(() => {
      getStub.restore()
      if (savedSearchUrl === undefined) delete process.env.ITUNES_SEARCH_URL
      else process.env.ITUNES_SEARCH_URL = savedSearchUrl
    })

    it('should use the iTunes Search API by default', async () => {
      await itunes.searchPodcasts('test')
      expect(getStub.calledOnce).to.be.true
      expect(getStub.firstCall.args[0]).to.equal('https://itunes.apple.com/search')
    })

    it('should use ITUNES_SEARCH_URL when it is set', async () => {
      process.env.ITUNES_SEARCH_URL = 'http://search.local:8080/search'
      await itunes.searchPodcasts('test')
      expect(getStub.firstCall.args[0]).to.equal('http://search.local:8080/search')
      expect(getStub.firstCall.args[1].params).to.include({ term: 'test', media: 'podcast', entity: 'podcast' })
    })

    it('should fall back to the iTunes Search API when ITUNES_SEARCH_URL is blank', async () => {
      process.env.ITUNES_SEARCH_URL = '  '
      await itunes.searchAudiobooks('test')
      expect(getStub.firstCall.args[0]).to.equal('https://itunes.apple.com/search')
    })
  })
})
