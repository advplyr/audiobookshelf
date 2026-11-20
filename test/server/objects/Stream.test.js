const os = require('os')
const { expect } = require('chai')
const sinon = require('sinon')
const Stream = require('../../../server/objects/Stream')

describe('Stream', () => {
  it('does not restart after being closed during a reset', async () => {
    const stream = new Stream(`stream-${process.pid}-${Date.now()}`, os.tmpdir(), { id: 'user-id' }, {})
    let finishCancel
    const cancelFinished = new Promise((resolve) => {
      finishCancel = resolve
    })

    stream.ffmpeg = { kill: sinon.stub() }
    stream.waitCancelTranscode = sinon.stub().returns(cancelFinished)
    stream.start = sinon.stub()
    stream.clientEmit = sinon.stub()

    const reset = stream.reset(30)
    await stream.close()
    finishCancel(true)
    await reset

    expect(stream.start.called).to.equal(false)
  })
})
