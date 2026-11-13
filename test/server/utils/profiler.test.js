const { expect } = require('chai')
const sinon = require('sinon')
const { performance } = require('perf_hooks')
const Logger = require('../../../server/Logger')
const profiler = require('../../../server/utils/profiler')

describe('profiler', () => {
  let infoStub
  let errorStub

  beforeEach(() => {
    let now = 0
    sinon.stub(performance, 'now').callsFake(() => (now += 10))
    infoStub = sinon.stub(Logger, 'info')
    errorStub = sinon.stub(Logger, 'error')
  })

  afterEach(() => sinon.restore())

  it('preserves exports, arguments, and resolved results for non-query functions', async () => {
    expect(Object.keys(profiler)).to.deep.equal(['profile'])
    const value = { id: 1 }
    const target = sinon.stub().resolves(value)
    const wrapped = profiler.profile(target, false, 'non-query-result')
    expect(await wrapped(42, 'text')).to.equal(value)
    expect(target.calledOnceWithExactly(42, 'text')).to.be.true
    expect(infoStub.firstCall.args[0]).to.equal('[non-query-result] duration: 10ms')
    expect(infoStub.getCall(1).args[1]).to.deep.equal([10])
    expect(infoStub.getCall(2).args[1].count).to.equal(1)
  })

  it('supports synchronous results and defaults the label to the function name', async () => {
    function synchronousProfileTarget(value) { return value + 1 }
    expect(await profiler.profile(synchronousProfileTarget, false)(4)).to.equal(5)
    expect(infoStub.firstCall.args[0]).to.equal('[synchronousProfileTarget] duration: 10ms')
  })

  it('mutates the original query options and logs benchmark queries', async () => {
    const options = { where: { id: 1 }, logging: false, benchmark: false }
    const target = sinon.stub().resolves([])
    await profiler.profile(target, true, 'query-options')(options, 'extra')
    expect(target.calledOnceWithExactly(options, 'extra')).to.be.true
    expect(options.benchmark).to.be.true
    expect(options.logging).to.be.a('function')
    options.logging('SELECT 1', 12)
    expect(infoStub.lastCall.args[0]).to.equal('[query-options] SELECT 1 Elapsed time: 12ms')
  })

  it('shares histogram history for wrappers with the same label', async () => {
    const first = profiler.profile(() => 1, false, 'shared-histogram')
    const second = profiler.profile(() => 2, false, 'shared-histogram')
    await first()
    await second()
    expect(infoStub.getCall(4).args[1]).to.deep.equal([10, 10])
    expect(infoStub.getCall(2).args[1]).to.equal(infoStub.getCall(5).args[1])
    expect(infoStub.getCall(5).args[1].count).to.equal(2)
  })

  it('rethrows the original error and records elapsed time on failure', async () => {
    const failure = new Error('Query failed')
    const target = sinon.stub().rejects(failure)
    const caught = await profiler.profile(target, false, 'failed-call')().catch((error) => error)
    expect(caught).to.equal(failure)
    expect(errorStub.calledOnceWithExactly('[failed-call] failed')).to.be.true
    expect(infoStub.getCall(1).args[1]).to.deep.equal([10])
  })

  it('preserves histogram rejection for a rounded zero duration', async () => {
    performance.now.returns(1)
    const caught = await profiler.profile(() => 'done', false, 'zero-duration')().catch((error) => error)
    expect(caught).to.be.instanceOf(RangeError)
    expect(infoStub.called).to.be.false
  })
})
