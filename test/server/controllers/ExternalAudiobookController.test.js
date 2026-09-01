const { expect } = require('chai')
const sinon = require('sinon')

const ExternalAudiobookController = require('../../../server/controllers/ExternalAudiobookController')
const ExternalAudiobookManager = require('../../../server/managers/ExternalAudiobookManager')
const TaskManager = require('../../../server/managers/TaskManager')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('ExternalAudiobookController', () => {
  let res

  function createTask(overrides = {}) {
    return {
      id: 'task-1',
      data: { libraryId: 'lib-1' },
      setDescription: sinon.spy(),
      setFinished: sinon.spy(),
      setFailed: sinon.spy(),
      toJSON: () => ({ id: 'task-1' }),
      ...overrides
    }
  }

  beforeEach(() => {
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'warn')

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
      send: sinon.spy(),
      sendStatus: sinon.spy()
    }
  })

  afterEach(() => {
    TaskManager.tasks = []
    sinon.restore()
  })

  describe('search', () => {
    it('returns an empty array when the external search is disabled', async () => {
      sinon.stub(ExternalAudiobookManager, 'isEnabled').value(false)
      const search = sinon.stub(ExternalAudiobookManager, 'search')

      await ExternalAudiobookController.search({ query: { q: 'harry' } }, res)

      expect(res.json.calledWith([])).to.be.true
      expect(search.called).to.be.false
    })

    it('returns an empty array when no query is given', async () => {
      sinon.stub(ExternalAudiobookManager, 'isEnabled').value(true)
      const search = sinon.stub(ExternalAudiobookManager, 'search')

      await ExternalAudiobookController.search({ query: {} }, res)

      expect(res.json.calledWith([])).to.be.true
      expect(search.called).to.be.false
    })

    it('delegates the search to the manager and caps the limit', async () => {
      sinon.stub(ExternalAudiobookManager, 'isEnabled').value(true)
      const results = [{ id: 'B123', title: 'Book A' }]
      const search = sinon.stub(ExternalAudiobookManager, 'search').resolves(results)

      await ExternalAudiobookController.search({ query: { q: 'book a', limit: '50' } }, res)

      expect(search.calledOnceWith('book a', ExternalAudiobookManager.searchResultLimit)).to.be.true
      expect(res.json.calledWith(results)).to.be.true
    })
  })

  describe('requestAudiobook', () => {
    const book = { title: 'Book A', asin: 'B123' }

    beforeEach(() => {
      sinon.stub(ExternalAudiobookManager, 'isEnabled').value(true)
    })

    it('returns 400 when the external search is disabled', async () => {
      sinon.stub(ExternalAudiobookManager, 'isEnabled').value(false)

      await ExternalAudiobookController.requestAudiobook({ body: { book, libraryId: 'lib-1' } }, res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('returns 400 without a book title', async () => {
      await ExternalAudiobookController.requestAudiobook({ body: { book: {}, libraryId: 'lib-1' } }, res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('returns 400 without a libraryId', async () => {
      await ExternalAudiobookController.requestAudiobook({ body: { book } }, res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('returns 403 when the user cannot access the library', async () => {
      const req = {
        body: { book, libraryId: 'lib-1' },
        user: { username: 'bob', checkCanAccessLibrary: () => false }
      }

      await ExternalAudiobookController.requestAudiobook(req, res)

      expect(res.sendStatus.calledWith(403)).to.be.true
    })

    it('creates the request with the user, library and server address', async () => {
      const user = { id: 'user-1', username: 'bob', checkCanAccessLibrary: () => true }
      const req = {
        body: { book, libraryId: 'lib-1' },
        user,
        secure: true,
        get: (header) => (header === 'host' ? 'abs.test' : '')
      }
      sinon.stub(Database, 'libraryModel').value({ findByPk: sinon.stub().resolves({ id: 'lib-1', name: 'Audiobooks' }) })
      sinon.stub(Database, 'serverSettings').value({ externalSearchServerAddress: null })
      const requestAudiobook = sinon.stub(ExternalAudiobookManager, 'requestAudiobook').resolves(createTask())

      await ExternalAudiobookController.requestAudiobook(req, res)

      expect(requestAudiobook.calledOnce).to.be.true
      expect(requestAudiobook.firstCall.args[0]).to.deep.equal(book)
      expect(requestAudiobook.firstCall.args[1]).to.equal(user)
      expect(requestAudiobook.firstCall.args[2]).to.deep.equal({ id: 'lib-1', name: 'Audiobooks' })
      expect(requestAudiobook.firstCall.args[3]).to.equal('https://abs.test')
      expect(res.json.calledWith({ id: 'task-1' })).to.be.true
    })

    it('uses the configured Audiobookshelf URL when set', async () => {
      const req = {
        body: { book, libraryId: 'lib-1' },
        user: { id: 'user-1', username: 'bob', checkCanAccessLibrary: () => true },
        get: () => 'internal:3333'
      }
      sinon.stub(Database, 'libraryModel').value({ findByPk: sinon.stub().resolves({ id: 'lib-1', name: 'Audiobooks' }) })
      sinon.stub(Database, 'serverSettings').value({ externalSearchServerAddress: 'https://abs.example.com' })
      const requestAudiobook = sinon.stub(ExternalAudiobookManager, 'requestAudiobook').resolves(createTask())

      await ExternalAudiobookController.requestAudiobook(req, res)

      expect(requestAudiobook.firstCall.args[3]).to.equal('https://abs.example.com')
    })
  })

  describe('updateTask', () => {
    function createReq(body = {}, token = 'callback-token') {
      return {
        params: { id: 'task-1' },
        body,
        get: (header) => (header === 'authorization' ? `Bearer ${token}` : '')
      }
    }

    it('returns 401 for an invalid callback token', () => {
      sinon.stub(ExternalAudiobookManager, 'isValidCallbackToken').returns(false)

      ExternalAudiobookController.updateTask(createReq({}, 'wrong-token'), res)

      expect(res.sendStatus.calledWith(401)).to.be.true
    })

    it('returns 404 for an unknown task', () => {
      sinon.stub(ExternalAudiobookManager, 'isValidCallbackToken').returns(true)
      const clearPendingTask = sinon.stub(ExternalAudiobookManager, 'clearPendingTask')
      TaskManager.tasks = []

      ExternalAudiobookController.updateTask(createReq(), res)

      expect(res.sendStatus.calledWith(404)).to.be.true
      expect(clearPendingTask.calledWith('task-1')).to.be.true
    })

    it('returns 400 for an invalid status', () => {
      sinon.stub(ExternalAudiobookManager, 'isValidCallbackToken').returns(true)
      TaskManager.tasks = [createTask()]

      ExternalAudiobookController.updateTask(createReq({ status: 'bogus' }), res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('returns 400 when failing a task without an error message', () => {
      sinon.stub(ExternalAudiobookManager, 'isValidCallbackToken').returns(true)
      TaskManager.tasks = [createTask()]

      ExternalAudiobookController.updateTask(createReq({ status: 'failed' }), res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('updates description and data of a running task', () => {
      sinon.stub(ExternalAudiobookManager, 'isValidCallbackToken').returns(true)
      const taskUpdated = sinon.stub(TaskManager, 'taskUpdated')
      const task = createTask()
      TaskManager.tasks = [task]

      ExternalAudiobookController.updateTask(createReq({ status: 'running', description: 'Downloading 50%', data: { progress: 50 } }), res)

      expect(task.setDescription.calledOnce).to.be.true
      expect(task.setDescription.firstCall.args[0].text).to.equal('Downloading 50%')
      expect(task.data).to.deep.equal({ libraryId: 'lib-1', progress: 50 })
      expect(taskUpdated.calledOnceWith(task)).to.be.true
    })

    it('finishes a task and clears the pending callback token', () => {
      sinon.stub(ExternalAudiobookManager, 'isValidCallbackToken').returns(true)
      const clearPendingTask = sinon.stub(ExternalAudiobookManager, 'clearPendingTask')
      const taskFinished = sinon.stub(TaskManager, 'taskFinished')
      const task = createTask()
      TaskManager.tasks = [task]

      ExternalAudiobookController.updateTask(createReq({ status: 'finished', descriptionKey: 'MessageTaskExternalSearch' }), res)

      expect(task.setFinished.calledOnce).to.be.true
      expect(clearPendingTask.calledWith('task-1')).to.be.true
      expect(taskFinished.calledOnceWith(task)).to.be.true
    })

    it('fails a task with the given error', () => {
      sinon.stub(ExternalAudiobookManager, 'isValidCallbackToken').returns(true)
      sinon.stub(ExternalAudiobookManager, 'clearPendingTask')
      const taskFinished = sinon.stub(TaskManager, 'taskFinished')
      const task = createTask()
      TaskManager.tasks = [task]

      ExternalAudiobookController.updateTask(createReq({ status: 'failed', error: 'Nothing found' }), res)

      expect(task.setFailed.calledOnce).to.be.true
      expect(task.setFailed.firstCall.args[0].text).to.equal('Nothing found')
      expect(taskFinished.calledOnceWith(task)).to.be.true
    })
  })

  describe('settings', () => {
    const settings = {
      externalSearchEnabled: false,
      externalSearchUrl: null,
      externalSearchAuthType: 'none',
      externalSearchToken: null,
      externalSearchUsername: null,
      externalSearchPassword: null,
      externalSearchProvider: 'audible',
      externalSearchServerAddress: null
    }

    function stubServerSettings(overrides = {}) {
      const serverSettings = { ...settings, ...overrides }
      Object.defineProperty(serverSettings, 'externalSearchSettings', {
        get() {
          const json = {}
          for (const key in settings) json[key] = this[key]
          return json
        }
      })
      sinon.stub(Database, 'serverSettings').value(serverSettings)
      return serverSettings
    }

    it('returns 403 for non-admins', () => {
      ExternalAudiobookController.getSettings({ user: { username: 'bob', isAdminOrUp: false } }, res)

      expect(res.sendStatus.calledWith(403)).to.be.true
    })

    it('returns the settings for admins', () => {
      stubServerSettings({ externalSearchUrl: 'https://service.test' })

      ExternalAudiobookController.getSettings({ user: { username: 'root', isAdminOrUp: true } }, res)

      expect(res.json.firstCall.args[0].externalSearchUrl).to.equal('https://service.test')
    })

    it('rejects updates from non-admins', async () => {
      await ExternalAudiobookController.updateSettings({ user: { username: 'bob', isAdminOrUp: false }, body: {} }, res)

      expect(res.sendStatus.calledWith(403)).to.be.true
    })

    it('rejects an invalid auth type', async () => {
      stubServerSettings()

      await ExternalAudiobookController.updateSettings({ user: { username: 'root', isAdminOrUp: true }, body: { externalSearchAuthType: 'digest' } }, res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('rejects an invalid url', async () => {
      stubServerSettings()

      await ExternalAudiobookController.updateSettings({ user: { username: 'root', isAdminOrUp: true }, body: { externalSearchUrl: 'not-a-url' } }, res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('rejects enabling the search without a url', async () => {
      stubServerSettings()

      await ExternalAudiobookController.updateSettings({ user: { username: 'root', isAdminOrUp: true }, body: { externalSearchEnabled: true } }, res)

      expect(res.status.calledWith(400)).to.be.true
    })

    it('saves the updated settings', async () => {
      const serverSettings = stubServerSettings()
      const updateServerSettings = sinon.stub(Database, 'updateServerSettings').resolves()

      const body = { externalSearchEnabled: true, externalSearchUrl: 'https://service.test/request', externalSearchAuthType: 'bearer', externalSearchToken: 'secret' }
      await ExternalAudiobookController.updateSettings({ user: { username: 'root', isAdminOrUp: true }, body }, res)

      expect(updateServerSettings.calledOnce).to.be.true
      expect(serverSettings.externalSearchEnabled).to.be.true
      expect(serverSettings.externalSearchUrl).to.equal('https://service.test/request')
      expect(serverSettings.externalSearchToken).to.equal('secret')
      expect(res.json.firstCall.args[0].externalSearchUrl).to.equal('https://service.test/request')
    })

    it('does not save when nothing changed', async () => {
      stubServerSettings({ externalSearchUrl: 'https://service.test/request' })
      const updateServerSettings = sinon.stub(Database, 'updateServerSettings').resolves()

      await ExternalAudiobookController.updateSettings({ user: { username: 'root', isAdminOrUp: true }, body: { externalSearchUrl: 'https://service.test/request' } }, res)

      expect(updateServerSettings.called).to.be.false
    })
  })
})
