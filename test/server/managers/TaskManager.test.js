const { expect } = require('chai')
const sinon = require('sinon')
const manager = require('../../../server/managers/TaskManager')
const Task = require('../../../server/objects/Task')
const SocketAuthority = require('../../../server/SocketAuthority')

describe('TaskManager compatibility', () => {
  let previousTasks, emitter
  beforeEach(() => {
    previousTasks = manager.tasks
    manager.tasks = []
    emitter = sinon.stub(SocketAuthority, 'emitter')
  })
  afterEach(() => { sinon.restore(); manager.tasks = previousTasks })
  it('adds tasks before emitting and preserves singleton identity', () => {
    const task = new Task()
    task.setData('scan', { text: 'Scan' }, null, true)
    emitter.callsFake((event, payload) => {
      expect(manager.tasks).to.deep.equal([task])
      expect(event).to.equal('task_started')
      expect(payload).to.deep.equal(task.toJSON())
    })
    manager.addTask(task)
    expect(emitter.calledOnce).to.equal(true)
    expect(require('../../../server/managers/TaskManager')).to.equal(manager)
  })
  it('removes all matching IDs before emitting and ignores unknown completion', () => {
    const task = new Task()
    task.setData('scan', { text: 'Scan' }, null, true)
    manager.tasks = [task, task]
    emitter.callsFake(() => expect(manager.tasks).to.deep.equal([]))
    manager.taskFinished(task)
    manager.taskFinished(task)
    expect(emitter.calledOnce).to.equal(true)
    expect(emitter.firstCall.args).to.deep.equal(['task_finished', task.toJSON()])
  })
  it('keeps null task data and copies supplied data', () => {
    const task = manager.createAndAddTask('import', { text: 'Import' }, null, true, null)
    expect(task.data).to.deep.equal({})
    const data = { libraryItemId: 'item' }
    const second = manager.createAndAddTask('scan', { text: 'Scan' }, { text: 'Description' }, false, data)
    data.libraryItemId = 'changed'
    expect(second.data).to.deep.equal({ libraryItemId: 'item' })
  })
  it('emits failed tasks without adding them to the active list', () => {
    const task = manager.createAndEmitFailedTask('import', { text: 'Import' }, null, { text: 'Failure', key: 'failure' })
    expect(manager.tasks).to.deep.equal([])
    expect(task).to.include({ isFailed: true, isFinished: true, showSuccess: false, error: 'Failure', errorKey: 'failure' })
    expect(emitter.firstCall.args).to.deep.equal(['task_started', task.toJSON()])
  })
})
