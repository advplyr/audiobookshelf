const { expect } = require('chai')
const Task = require('../../../server/objects/Task')

describe('Task', () => {
  it('serializes an uninitialized task without adding a failure timestamp', () => {
    const task = new Task()
    expect(task.toJSON()).to.include({ id: null, startedAt: null, finishedAt: null, isFinished: false })
    expect(task.toJSON().data).to.deep.equal({})
    expect(task).not.to.have.property('failedAt')
  })

  it('copies task data and supports missing translation fields', () => {
    const task = new Task()
    const data = { libraryItemId: 'book-1' }
    task.setData('encode-m4b', { text: 'Encoding' }, null, true, data)
    data.libraryItemId = 'book-2'
    expect(task.toJSON().data).to.deep.equal({ libraryItemId: 'book-1' })
    expect(task.toJSON()).to.include({ titleKey: null, titleSubs: null, description: null, showSuccess: true })
    expect(task.id).to.be.a('string')
    expect(task.startedAt).to.be.a('number')
  })

  it('marks a failure as finished while keeping failedAt out of the JSON payload', () => {
    const task = new Task()
    task.setFailed({ text: 'Failed', key: 'Error', subs: ['book'] })
    expect(task.toJSON()).to.include({ isFailed: true, isFinished: true, error: 'Failed', errorKey: 'Error' })
    expect(task.errorSubs).to.deep.equal(['book'])
    expect(task.failedAt).to.be.a('number')
    expect(task.finishedAt).to.be.a('number')
    expect(task.toJSON()).not.to.have.property('failedAt')
  })

  it('replaces and clears the completion description', () => {
    const task = new Task()
    task.setFinished({ text: 'Done', key: 'Done', subs: ['book'] })
    expect(task.descriptionSubs).to.deep.equal(['book'])
    task.setFinished(null, true)
    expect(task.toJSON()).to.include({ description: null, descriptionKey: null, descriptionSubs: null })
  })
})
