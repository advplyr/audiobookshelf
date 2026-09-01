const { expect } = require('chai')
const sinon = require('sinon')
const express = require('express')
const axios = require('axios')

const PublicRouter = require('../../../server/routers/PublicRouter')
const ExternalAudiobookManager = require('../../../server/managers/ExternalAudiobookManager')
const TaskManager = require('../../../server/managers/TaskManager')
const SocketAuthority = require('../../../server/SocketAuthority')
const Database = require('../../../server/Database')
const Logger = require('../../../server/Logger')

/**
 * End to end test of the task callback: the external service updates a task through
 * the public route and the task has to be finished and emitted to its owner.
 */
describe('External search task callback', () => {
  const user = { id: 'user-1', username: 'daniel' }
  const library = { id: 'lib-1', name: 'Audiobooks' }

  let server = null
  let baseUrl = null
  let clientEmitter = null
  let emitter = null

  before((done) => {
    const app = express()
    app.use(express.json())
    app.use('/public', new PublicRouter(null).router)
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`
      done()
    })
  })

  after(() => {
    server?.close()
  })

  beforeEach(() => {
    sinon.stub(Logger, 'info')
    sinon.stub(Logger, 'debug')
    sinon.stub(Logger, 'error')
    sinon.stub(Logger, 'warn')
    sinon.stub(Database, 'serverSettings').value({
      externalSearchEnabled: true,
      externalSearchUrl: 'https://service.test/request',
      externalSearchAuthType: 'none',
      externalSearchProvider: 'audible'
    })
    clientEmitter = sinon.stub(SocketAuthority, 'clientEmitter')
    emitter = sinon.stub(SocketAuthority, 'emitter')
    sinon.stub(axios, 'post').resolves({ status: 202 })
  })

  afterEach(() => {
    TaskManager.tasks = []
    ExternalAudiobookManager.pendingTasks.clear()
    sinon.restore()
  })

  /**
   * Start a request like the user clicking an external search result
   *
   * @returns {Promise<{ task: import('../../../server/objects/Task'), callbackUrl: string, callbackToken: string }>}
   */
  async function startRequest() {
    const task = await ExternalAudiobookManager.requestAudiobook({ title: 'Der Hobbit', author: 'Tolkien' }, user, library, baseUrl)
    const { callbackUrl, callbackToken } = axios.post.firstCall.args[1]
    return { task, callbackUrl, callbackToken }
  }

  /**
   * @param {string} url
   * @param {string} token
   * @param {Object} body
   * @returns {Promise<{ status: number }>}
   */
  function sendUpdate(url, token, body) {
    return fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
  }

  it('keeps the task running and emits task_updated for a running update', async () => {
    const { task, callbackUrl, callbackToken } = await startRequest()

    const response = await sendUpdate(callbackUrl, callbackToken, { status: 'running', description: 'Downloading "Der Hobbit" - 83%' })

    expect(response.status).to.equal(200)
    expect(task.isFinished).to.be.false
    expect(task.description).to.equal('Downloading "Der Hobbit" - 83%')
    expect(TaskManager.tasks).to.include(task)
    expect(clientEmitter.calledWith('user-1', 'task_updated')).to.be.true
    expect(emitter.called).to.be.false
  })

  it('finishes the task when the external service reports finished', async () => {
    const { task, callbackUrl, callbackToken } = await startRequest()

    const response = await sendUpdate(callbackUrl, callbackToken, { status: 'finished', description: 'Download of "Der Hobbit" finished' })

    expect(response.status).to.equal(200)
    expect(task.isFinished).to.be.true
    expect(task.isFailed).to.be.false
    expect(task.finishedAt).to.be.a('number')
    expect(task.description).to.equal('Download of "Der Hobbit" finished')
    // Task is removed from the task manager and only its owner is notified
    expect(TaskManager.tasks).to.not.include(task)
    expect(clientEmitter.calledWith('user-1', 'task_finished')).to.be.true
    expect(emitter.called).to.be.false
    // The callback token is invalidated
    expect(ExternalAudiobookManager.pendingTasks.has(task.id)).to.be.false
  })

  it('fails the task when the external service reports failed', async () => {
    const { task, callbackUrl, callbackToken } = await startRequest()

    const response = await sendUpdate(callbackUrl, callbackToken, { status: 'failed', error: 'No matching audiobook found' })

    expect(response.status).to.equal(200)
    expect(task.isFailed).to.be.true
    expect(task.isFinished).to.be.true
    expect(task.error).to.equal('No matching audiobook found')
    expect(TaskManager.tasks).to.not.include(task)
    expect(clientEmitter.calledWith('user-1', 'task_finished')).to.be.true
    expect(emitter.called).to.be.false
    expect(ExternalAudiobookManager.pendingTasks.has(task.id)).to.be.false
  })

  it('rejects updates after the task was finished', async () => {
    const { callbackUrl, callbackToken } = await startRequest()
    await sendUpdate(callbackUrl, callbackToken, { status: 'finished' })

    const response = await sendUpdate(callbackUrl, callbackToken, { status: 'running', description: 'still going' })

    expect(response.status).to.equal(401)
  })

  it('rejects updates with a wrong callback token', async () => {
    const { task, callbackUrl } = await startRequest()

    const response = await sendUpdate(callbackUrl, 'wrong-token', { status: 'finished' })

    expect(response.status).to.equal(401)
    expect(task.isFinished).to.be.false
    expect(TaskManager.tasks).to.include(task)
  })
})
