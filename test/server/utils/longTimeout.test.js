const { expect } = require('chai')
const sinon = require('sinon')
const LongTimeout = require('../../../server/utils/longTimeout')

describe('LongTimeout', () => {
  let clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
  })

  it('should wait for the full delay across the signed 32-bit limit', () => {
    const timeout = new LongTimeout()
    const callback = sinon.spy()
    const maxDelay = 2147483647

    timeout.set(callback, maxDelay + 100)
    clock.tick(maxDelay)
    expect(callback.called).to.be.false
    clock.tick(99)
    expect(callback.called).to.be.false
    clock.tick(1)
    expect(callback.calledOnce).to.be.true
  })

  it('should cancel a later segment of a long delay', () => {
    const timeout = new LongTimeout()
    const callback = sinon.spy()
    const maxDelay = 2147483647

    timeout.set(callback, maxDelay + 100)
    clock.tick(maxDelay)
    timeout.clear()
    clock.tick(100)
    expect(callback.called).to.be.false
    expect(clock.countTimers()).to.equal(0)
  })

  it('should safely clear before a timer has been scheduled', () => {
    const timeout = new LongTimeout()
    expect(timeout.timer).to.equal(null)
    expect(() => timeout.clear()).not.to.throw()
    expect(clock.countTimers()).to.equal(0)
  })

  it('should invoke non-positive delays synchronously without scheduling a timer', () => {
    for (const delay of [0, -1]) {
      const timeout = new LongTimeout()
      const callback = sinon.spy()
      expect(timeout.set(callback, delay)).to.equal(undefined)
      expect(callback.calledOnce).to.be.true
      expect(clock.countTimers()).to.equal(0)
    }
  })
})
