const { expect } = require('chai')
const sinon = require('sinon')
const axios = require('axios')

const ExternalAudiobookManager = require('../../../server/managers/ExternalAudiobookManager')
const TaskManager = require('../../../server/managers/TaskManager')
const BookFinder = require('../../../server/finders/BookFinder')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

describe('ExternalAudiobookManager', () => {
  const user = { id: 'user-1', username: 'bob' }
  const library = { id: 'lib-1', name: 'Audiobooks' }

  let settingsStub = null

  function setSettings(overrides = {}) {
    if (settingsStub) settingsStub.restore()
    settingsStub = sinon.stub(Database, 'serverSettings').value({
      externalSearchEnabled: true,
      externalSearchUrl: 'https://service.test/request',
      externalSearchAuthType: 'none',
      externalSearchToken: null,
      externalSearchUsername: null,
      externalSearchPassword: null,
      externalSearchProvider: 'audible',
      externalSearchServerAddress: null,
      ...overrides
    })
  }

  beforeEach(() => {
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'warn')
    setSettings()
  })

  afterEach(() => {
    settingsStub = null
    TaskManager.tasks = []
    ExternalAudiobookManager.pendingTasks.clear()
    sinon.restore()
  })

  describe('search', () => {
    it('returns an empty array when the external search is disabled', async () => {
      setSettings({ externalSearchEnabled: false })
      const bookFinderSearch = sinon.stub(BookFinder, 'search')

      expect(await ExternalAudiobookManager.search('harry potter')).to.deep.equal([])
      expect(bookFinderSearch.called).to.be.false
    })

    it('returns an empty array when no query is given', async () => {
      const bookFinderSearch = sinon.stub(BookFinder, 'search')

      expect(await ExternalAudiobookManager.search('')).to.deep.equal([])
      expect(bookFinderSearch.called).to.be.false
    })

    it('searches with the configured provider without fuzzy searches', async () => {
      setSettings({ externalSearchProvider: 'audible.de' })
      const bookFinderSearch = sinon.stub(BookFinder, 'search').resolves([])

      await ExternalAudiobookManager.search('harry potter')

      expect(bookFinderSearch.calledOnce).to.be.true
      expect(bookFinderSearch.firstCall.args[1]).to.equal('audible.de')
      expect(bookFinderSearch.firstCall.args[2]).to.equal('harry potter')
      expect(bookFinderSearch.firstCall.args[6]).to.deep.equal({ maxFuzzySearches: 0 })
    })

    it('keeps all BookFinder data and adds id and provider', async () => {
      sinon.stub(BookFinder, 'search').resolves([{ title: 'Book A', author: 'Author A', asin: 'B123', duration: 100 }])

      const results = await ExternalAudiobookManager.search('book a')

      expect(results).to.have.length(1)
      expect(results[0]).to.deep.equal({
        title: 'Book A',
        author: 'Author A',
        asin: 'B123',
        duration: 100,
        id: 'B123',
        provider: 'audible'
      })
    })

    it('limits the number of results', async () => {
      const books = Array.from({ length: 10 }, (_, i) => ({ title: `Book ${i}` }))
      sinon.stub(BookFinder, 'search').resolves(books)

      expect(await ExternalAudiobookManager.search('book', 3)).to.have.length(3)
      expect(await ExternalAudiobookManager.search('book')).to.have.length(ExternalAudiobookManager.searchResultLimit)
    })

    it('returns an empty array when BookFinder throws', async () => {
      sinon.stub(BookFinder, 'search').rejects(new Error('provider down'))

      expect(await ExternalAudiobookManager.search('book')).to.deep.equal([])
    })
  })

  describe('requestAudiobook', () => {
    it('creates a task for the user and posts all data to the external service', async () => {
      const post = sinon.stub(axios, 'post').resolves({ status: 200 })
      sinon.stub(TaskManager, 'addTask')

      const book = { title: 'Book A', author: 'Author A', asin: 'B123', provider: 'audible' }
      const task = await ExternalAudiobookManager.requestAudiobook(book, user, library, 'https://abs.test')

      expect(task.userId).to.equal('user-1')
      expect(task.action).to.equal('external-audiobook-search')
      expect(task.data).to.deep.equal({ libraryId: 'lib-1', title: 'Book A' })

      expect(post.calledOnce).to.be.true
      const [url, payload] = post.firstCall.args
      expect(url).to.equal('https://service.test/request')
      expect(payload.taskId).to.equal(task.id)
      expect(payload.callbackUrl).to.equal(`https://abs.test/public/external-search-tasks/${task.id}`)
      expect(payload.callbackToken).to.be.a('string').with.length.greaterThan(0)
      expect(payload.serverAddress).to.equal('https://abs.test')
      expect(payload.user).to.deep.equal({ id: 'user-1', username: 'bob' })
      expect(payload.library).to.deep.equal({ id: 'lib-1', name: 'Audiobooks' })
      expect(payload.book).to.deep.equal(book)

      expect(ExternalAudiobookManager.isValidCallbackToken(task.id, payload.callbackToken)).to.be.true
    })

    it('sends a bearer token when configured', async () => {
      setSettings({ externalSearchAuthType: 'bearer', externalSearchToken: 'secret-token' })
      const post = sinon.stub(axios, 'post').resolves({ status: 200 })
      sinon.stub(TaskManager, 'addTask')

      await ExternalAudiobookManager.requestAudiobook({ title: 'Book A' }, user, library, 'https://abs.test')

      expect(post.firstCall.args[2].headers.Authorization).to.equal('Bearer secret-token')
      expect(post.firstCall.args[2].auth).to.be.undefined
    })

    it('sends basic auth credentials when configured', async () => {
      setSettings({ externalSearchAuthType: 'basic', externalSearchUsername: 'abs', externalSearchPassword: 'pw' })
      const post = sinon.stub(axios, 'post').resolves({ status: 200 })
      sinon.stub(TaskManager, 'addTask')

      await ExternalAudiobookManager.requestAudiobook({ title: 'Book A' }, user, library, 'https://abs.test')

      expect(post.firstCall.args[2].auth).to.deep.equal({ username: 'abs', password: 'pw' })
      expect(post.firstCall.args[2].headers.Authorization).to.be.undefined
    })

    it('fails the task when the external service cannot be reached', async () => {
      sinon.stub(axios, 'post').rejects(new Error('ECONNREFUSED'))
      sinon.stub(TaskManager, 'addTask')
      const taskFinished = sinon.stub(TaskManager, 'taskFinished')

      const task = await ExternalAudiobookManager.requestAudiobook({ title: 'Book A' }, user, library, 'https://abs.test')

      expect(task.isFailed).to.be.true
      expect(task.error).to.equal('External service could not be reached')
      expect(taskFinished.calledOnceWith(task)).to.be.true
      expect(ExternalAudiobookManager.pendingTasks.has(task.id)).to.be.false
    })
  })

  describe('failTaskOnTimeout', () => {
    it('fails a task that is still running and clears it', () => {
      const taskFinished = sinon.stub(TaskManager, 'taskFinished')
      const task = { id: 'task-1', setFailed: sinon.spy() }
      TaskManager.tasks = [task]
      ExternalAudiobookManager.pendingTasks.set('task-1', { token: 'abc', timeout: setTimeout(() => {}, 0) })

      ExternalAudiobookManager.failTaskOnTimeout('task-1')

      expect(task.setFailed.calledOnce).to.be.true
      expect(task.setFailed.firstCall.args[0].key).to.equal('MessageTaskExternalSearchTimeout')
      expect(taskFinished.calledOnceWith(task)).to.be.true
      expect(ExternalAudiobookManager.pendingTasks.has('task-1')).to.be.false
    })

    it('does nothing when the task no longer exists', () => {
      const taskFinished = sinon.stub(TaskManager, 'taskFinished')

      ExternalAudiobookManager.failTaskOnTimeout('unknown-task')

      expect(taskFinished.called).to.be.false
    })
  })

  describe('isValidCallbackToken', () => {
    it('only accepts the token of the given task', () => {
      ExternalAudiobookManager.pendingTasks.set('task-1', { token: 'abc', timeout: setTimeout(() => {}, 0) })

      expect(ExternalAudiobookManager.isValidCallbackToken('task-1', 'abc')).to.be.true
      expect(ExternalAudiobookManager.isValidCallbackToken('task-1', 'wrong')).to.be.false
      expect(ExternalAudiobookManager.isValidCallbackToken('task-1', '')).to.be.false
      expect(ExternalAudiobookManager.isValidCallbackToken('task-2', 'abc')).to.be.false
    })
  })
})
