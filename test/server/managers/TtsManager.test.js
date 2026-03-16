const { expect } = require('chai')
const sinon = require('sinon')
const Path = require('path')

describe('TtsManager', () => {
  let TtsManager
  let fsStub
  let fetchStub

  beforeEach(() => {
    // Stub @camb-ai/sdk before requiring TtsManager
    require.cache[require.resolve('@camb-ai/sdk')] = {
      id: require.resolve('@camb-ai/sdk'),
      filename: require.resolve('@camb-ai/sdk'),
      loaded: true,
      exports: { CambClient: class MockCambClient {} }
    }

    // Stub fs methods
    fsStub = {
      writeFile: sinon.stub().resolves(),
      ensureDir: sinon.stub().resolves()
    }
    const fsPath = require.resolve('../../../server/libs/fsExtra')
    require.cache[fsPath] = {
      id: fsPath,
      filename: fsPath,
      loaded: true,
      exports: fsStub
    }

    // Stub global.fetch
    fetchStub = sinon.stub(global, 'fetch')

    // Clear TtsManager cache and require fresh
    delete require.cache[require.resolve('../../../server/managers/TtsManager')]
    TtsManager = require('../../../server/managers/TtsManager')
  })

  afterEach(() => {
    sinon.restore()
    // Clean up require cache overrides
    delete require.cache[require.resolve('@camb-ai/sdk')]
    delete require.cache[require.resolve('../../../server/libs/fsExtra')]
    delete require.cache[require.resolve('../../../server/managers/TtsManager')]
  })

  describe('getVoices', () => {
    it('should call fetch with correct URL and headers', async () => {
      const mockVoices = [{ id: 1, name: 'Voice 1' }]
      fetchStub.resolves({
        ok: true,
        json: sinon.stub().resolves(mockVoices)
      })

      const result = await TtsManager.getVoices('test-api-key')

      expect(fetchStub.calledOnce).to.be.true
      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://client.camb.ai/apis/list-voices')
      expect(options.headers['x-api-key']).to.equal('test-api-key')
      expect(result).to.deep.equal(mockVoices)
    })

    it('should throw on non-ok response', async () => {
      fetchStub.resolves({ ok: false, status: 401 })

      try {
        await TtsManager.getVoices('bad-key')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err.message).to.include('Failed to list voices')
        expect(err.message).to.include('401')
      }
    })
  })

  describe('synthesizeChapter', () => {
    it('should POST with correct body and write file', async () => {
      const audioData = new ArrayBuffer(100)
      fetchStub.resolves({
        ok: true,
        arrayBuffer: sinon.stub().resolves(audioData)
      })

      await TtsManager.synthesizeChapter('key', 'Hello world', 5, '/out/ch1.wav', 'en-us', 'mars-flash')

      expect(fetchStub.calledOnce).to.be.true
      const [url, options] = fetchStub.firstCall.args
      expect(url).to.equal('https://client.camb.ai/apis/tts-stream')
      expect(options.method).to.equal('POST')
      expect(options.headers['x-api-key']).to.equal('key')

      const body = JSON.parse(options.body)
      expect(body.text).to.equal('Hello world')
      expect(body.voice_id).to.equal(5)
      expect(body.language).to.equal('en-us')
      expect(body.speech_model).to.equal('mars-flash')
      expect(body.output_configuration).to.deep.equal({ format: 'wav' })

      expect(fsStub.writeFile.calledOnce).to.be.true
      expect(fsStub.writeFile.firstCall.args[0]).to.equal('/out/ch1.wav')
    })

    it('should throw on API error', async () => {
      fetchStub.resolves({
        ok: false,
        status: 500,
        text: sinon.stub().resolves('Internal error')
      })

      try {
        await TtsManager.synthesizeChapter('key', 'text', 1, '/out/ch1.wav')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err.message).to.include('TTS API error')
        expect(err.message).to.include('500')
      }
    })
  })

  describe('synthesizeEbook', () => {
    let mockTask
    let TaskManager
    let textExtractor
    let Logger

    beforeEach(() => {
      mockTask = {
        data: {},
        setFailed: sinon.spy(),
        setFinished: sinon.spy()
      }

      TaskManager = require('../../../server/managers/TaskManager')
      sinon.stub(TaskManager, 'createAndAddTask').returns(mockTask)
      sinon.stub(TaskManager, 'taskFinished')

      // Stub textExtractor
      textExtractor = require('../../../server/utils/textExtractor')
      sinon.stub(textExtractor, 'extractFromEpub')

      Logger = require('../../../server/Logger')
      sinon.stub(Logger, 'info')
      sinon.stub(Logger, 'error')
    })

    it('should return failure for empty chapters', async () => {
      textExtractor.extractFromEpub.resolves([])

      const result = await TtsManager.synthesizeEbook({
        apiKey: 'key',
        libraryItemId: 'li1',
        ebookPath: '/book.epub',
        outputDir: '/out',
        voiceId: 1,
        language: 'en-us',
        model: 'mars-flash'
      })

      expect(result.success).to.be.false
      expect(mockTask.setFailed.calledOnce).to.be.true
      expect(TaskManager.taskFinished.calledWith(mockTask)).to.be.true
    })

    it('should synthesize all chapters and return success', async () => {
      textExtractor.extractFromEpub.resolves([
        { title: 'Chapter 1', text: 'Text one' },
        { title: 'Chapter 2', text: 'Text two' }
      ])

      // Stub synthesizeChapter on the instance
      sinon.stub(TtsManager, 'synthesizeChapter').resolves()

      const result = await TtsManager.synthesizeEbook({
        apiKey: 'key',
        libraryItemId: 'li1',
        ebookPath: '/book.epub',
        outputDir: '/out',
        voiceId: 1,
        language: 'en-us',
        model: 'mars-flash'
      })

      expect(result.success).to.be.true
      expect(TtsManager.synthesizeChapter.callCount).to.equal(2)
      expect(result.audioFiles).to.have.length(2)
      expect(result.chapters).to.have.length(2)
      expect(result.chapters[0].title).to.equal('Chapter 1')
      expect(mockTask.setFinished.calledOnce).to.be.true
    })

    it('should return failure on error', async () => {
      textExtractor.extractFromEpub.rejects(new Error('Parse error'))

      const result = await TtsManager.synthesizeEbook({
        apiKey: 'key',
        libraryItemId: 'li1',
        ebookPath: '/book.epub',
        outputDir: '/out',
        voiceId: 1,
        language: 'en-us',
        model: 'mars-flash'
      })

      expect(result.success).to.be.false
      expect(result.error).to.equal('Parse error')
      expect(mockTask.setFailed.calledOnce).to.be.true
      expect(TaskManager.taskFinished.calledWith(mockTask)).to.be.true
    })
  })
})
