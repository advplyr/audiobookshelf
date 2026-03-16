const { expect } = require('chai')
const sinon = require('sinon')

const Database = require('../../../server/Database')
const TtsController = require('../../../server/controllers/TtsController')
const Logger = require('../../../server/Logger')

describe('TtsController', () => {
  let fakeRes

  beforeEach(() => {
    fakeRes = {
      sendStatus: sinon.spy(),
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    }

    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('middleware', () => {
    it('should return 403 for non-admin users', async () => {
      const fakeReq = { user: { isAdminOrUp: false } }
      const next = sinon.spy()

      await TtsController.middleware(fakeReq, fakeRes, next)

      expect(fakeRes.sendStatus.calledWith(403)).to.be.true
      expect(next.called).to.be.false
    })

    it('should call next() for admin users', async () => {
      const fakeReq = { user: { isAdminOrUp: true } }
      const next = sinon.spy()

      await TtsController.middleware(fakeReq, fakeRes, next)

      expect(fakeRes.sendStatus.called).to.be.false
      expect(next.calledOnce).to.be.true
    })
  })

  describe('synthesize', () => {
    it('should return 400 if apiKey is missing', async () => {
      const fakeReq = { body: { libraryItemId: 'li1', voiceId: '1' } }

      await TtsController.synthesize(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'API key is required')
    })

    it('should return 400 if libraryItemId is missing', async () => {
      const fakeReq = { body: { apiKey: 'key', voiceId: '1' } }

      await TtsController.synthesize(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'libraryItemId is required')
    })

    it('should return 400 if voiceId is missing', async () => {
      const fakeReq = { body: { apiKey: 'key', libraryItemId: 'li1' } }

      await TtsController.synthesize(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'voiceId is required')
    })

    it('should return 404 if library item not found', async () => {
      // Database.libraryItemModel is a getter from Database.models, so stub the getter
      sinon.stub(Database, 'libraryItemModel').get(() => ({
        getExpandedById: sinon.stub().resolves(null)
      }))

      const fakeReq = { body: { apiKey: 'key', libraryItemId: 'li1', voiceId: '1' } }

      await TtsController.synthesize(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(404)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'Library item not found')
    })

    it('should return 400 if no EPUB file found', async () => {
      sinon.stub(Database, 'libraryItemModel').get(() => ({
        getExpandedById: sinon.stub().resolves({
          libraryFiles: [{ metadata: { ext: '.pdf' } }],
          path: '/books/test'
        })
      }))

      const fakeReq = { body: { apiKey: 'key', libraryItemId: 'li1', voiceId: '1' } }

      await TtsController.synthesize(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'No EPUB file found for this library item')
    })

    it('should call TtsManager.synthesizeEbook with correct args on success', async () => {
      sinon.stub(Database, 'libraryItemModel').get(() => ({
        getExpandedById: sinon.stub().resolves({
          libraryFiles: [{ metadata: { ext: '.epub', path: '/books/test/book.epub' } }],
          path: '/books/test'
        })
      }))

      const TtsManager = require('../../../server/managers/TtsManager')
      const expectedResult = { success: true, audioFiles: ['/out/ch1.wav'] }
      sinon.stub(TtsManager, 'synthesizeEbook').resolves(expectedResult)

      const fakeReq = {
        body: { apiKey: 'key', libraryItemId: 'li1', voiceId: '42' }
      }

      await TtsController.synthesize(fakeReq, fakeRes)

      expect(TtsManager.synthesizeEbook.calledOnce).to.be.true
      const callArgs = TtsManager.synthesizeEbook.firstCall.args[0]
      expect(callArgs.apiKey).to.equal('key')
      expect(callArgs.libraryItemId).to.equal('li1')
      expect(callArgs.voiceId).to.equal(42) // parseInt
      expect(callArgs.language).to.equal('en-us') // default
      expect(callArgs.model).to.equal('mars-flash') // default
      expect(callArgs.ebookPath).to.equal('/books/test/book.epub')
      expect(fakeRes.json.calledWith(expectedResult)).to.be.true
    })

    it('should return 500 on thrown error', async () => {
      sinon.stub(Database, 'libraryItemModel').get(() => ({
        getExpandedById: sinon.stub().rejects(new Error('DB error'))
      }))

      const fakeReq = { body: { apiKey: 'key', libraryItemId: 'li1', voiceId: '1' } }

      await TtsController.synthesize(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(500)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'DB error')
    })
  })

  describe('getVoices', () => {
    it('should return 400 if apiKey is missing', async () => {
      const fakeReq = { query: {} }

      await TtsController.getVoices(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(400)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'API key is required')
    })

    it('should return voices on success', async () => {
      const TtsManager = require('../../../server/managers/TtsManager')
      const mockVoices = [{ id: 1, name: 'Voice 1' }]
      sinon.stub(TtsManager, 'getVoices').resolves(mockVoices)

      const fakeReq = { query: { apiKey: 'test-key' } }

      await TtsController.getVoices(fakeReq, fakeRes)

      expect(TtsManager.getVoices.calledWith('test-key')).to.be.true
      expect(fakeRes.json.calledWith(mockVoices)).to.be.true
    })

    it('should return 500 on thrown error', async () => {
      const TtsManager = require('../../../server/managers/TtsManager')
      sinon.stub(TtsManager, 'getVoices').rejects(new Error('API error'))

      const fakeReq = { query: { apiKey: 'test-key' } }

      await TtsController.getVoices(fakeReq, fakeRes)

      expect(fakeRes.status.calledWith(500)).to.be.true
      expect(fakeRes.json.firstCall.args[0]).to.have.property('error', 'API error')
    })
  })
})
