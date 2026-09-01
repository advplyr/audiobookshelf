const { expect } = require('chai')
const sinon = require('sinon')

const TaskManager = require('../../../server/managers/TaskManager')
const SocketAuthority = require('../../../server/SocketAuthority')
const Task = require('../../../server/objects/Task')

describe('TaskManager', () => {
  const titleString = { text: 'Task title', key: 'MessageTaskTitle' }

  beforeEach(() => {
    TaskManager.tasks = []
    sinon.stub(SocketAuthority, 'emitter')
    sinon.stub(SocketAuthority, 'clientEmitter')
  })

  afterEach(() => {
    sinon.restore()
    TaskManager.tasks = []
  })

  describe('tasks without a userId (existing behavior)', () => {
    it('broadcasts task_started to all clients', () => {
      const task = TaskManager.createAndAddTask('test-action', titleString, null, false, { libraryItemId: 'li-1' })

      expect(task.userId).to.be.null
      expect(SocketAuthority.clientEmitter.called).to.be.false
      expect(SocketAuthority.emitter.calledOnce).to.be.true

      const [evt, payload] = SocketAuthority.emitter.firstCall.args
      expect(evt).to.equal('task_started')
      expect(payload.id).to.equal(task.id)
      expect(payload.data).to.deep.equal({ libraryItemId: 'li-1' })
    })

    it('broadcasts task_finished to all clients and removes the task', () => {
      const task = TaskManager.createAndAddTask('test-action', titleString, null, false)
      SocketAuthority.emitter.resetHistory()

      task.setFinished()
      TaskManager.taskFinished(task)

      expect(TaskManager.tasks).to.be.empty
      expect(SocketAuthority.clientEmitter.called).to.be.false
      expect(SocketAuthority.emitter.calledOnce).to.be.true
      expect(SocketAuthority.emitter.firstCall.args[0]).to.equal('task_finished')
    })

    it('broadcasts a failed task created with createAndEmitFailedTask', () => {
      TaskManager.createAndEmitFailedTask('test-action', titleString, null, { text: 'Boom' })

      expect(SocketAuthority.clientEmitter.called).to.be.false
      expect(SocketAuthority.emitter.calledOnce).to.be.true

      const [evt, payload] = SocketAuthority.emitter.firstCall.args
      expect(evt).to.equal('task_started')
      expect(payload.isFailed).to.be.true
      expect(payload.userId).to.be.null
    })
  })

  describe('tasks with a userId', () => {
    it('emits task_started only to the owning user', () => {
      const task = TaskManager.createAndAddTask('test-action', titleString, null, false, {}, 'user-1')

      expect(task.userId).to.equal('user-1')
      expect(SocketAuthority.emitter.called).to.be.false
      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true

      const [userId, evt, payload] = SocketAuthority.clientEmitter.firstCall.args
      expect(userId).to.equal('user-1')
      expect(evt).to.equal('task_started')
      expect(payload.userId).to.equal('user-1')
    })

    it('emits task_finished only to the owning user', () => {
      const task = TaskManager.createAndAddTask('test-action', titleString, null, false, {}, 'user-1')
      SocketAuthority.clientEmitter.resetHistory()

      task.setFinished()
      TaskManager.taskFinished(task)

      expect(SocketAuthority.emitter.called).to.be.false
      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.firstCall.args[1]).to.equal('task_finished')
    })

    it('emits a failed task only to the owning user', () => {
      TaskManager.createAndEmitFailedTask('test-action', titleString, null, { text: 'Boom' }, 'user-1')

      expect(SocketAuthority.emitter.called).to.be.false
      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.firstCall.args[0]).to.equal('user-1')
    })
  })

  describe('taskUpdated', () => {
    it('broadcasts task_updated for a task without a userId', () => {
      const task = TaskManager.createAndAddTask('test-action', titleString, null, false)
      SocketAuthority.emitter.resetHistory()

      task.setDescription({ text: 'Halfway there' })
      TaskManager.taskUpdated(task)

      expect(SocketAuthority.clientEmitter.called).to.be.false
      expect(SocketAuthority.emitter.calledOnce).to.be.true

      const [evt, payload] = SocketAuthority.emitter.firstCall.args
      expect(evt).to.equal('task_updated')
      expect(payload.description).to.equal('Halfway there')
      expect(payload.isFinished).to.be.false
    })

    it('emits task_updated only to the owning user', () => {
      const task = TaskManager.createAndAddTask('test-action', titleString, null, false, {}, 'user-1')
      SocketAuthority.clientEmitter.resetHistory()

      TaskManager.taskUpdated(task)

      expect(SocketAuthority.emitter.called).to.be.false
      expect(SocketAuthority.clientEmitter.calledOnce).to.be.true
      expect(SocketAuthority.clientEmitter.firstCall.args[1]).to.equal('task_updated')
    })

    it('does not emit for a task that is not tracked anymore', () => {
      const task = new Task()
      task.setData('test-action', titleString, null, false)

      TaskManager.taskUpdated(task)

      expect(SocketAuthority.emitter.called).to.be.false
      expect(SocketAuthority.clientEmitter.called).to.be.false
    })
  })
})
