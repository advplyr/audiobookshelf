const { expect } = require('chai')
const sinon = require('sinon')

require('../../../server/Database')
const LocalAuthStrategy = require('../../../server/auth/LocalAuthStrategy')

describe('LocalAuthStrategy - verifyCredentials type validation', () => {
  /** @type {LocalAuthStrategy} */
  let strategy
  let done

  beforeEach(() => {
    strategy = new LocalAuthStrategy()
    done = sinon.spy()
  })

  afterEach(() => {
    sinon.restore()
  })

  it('rejects a non-string username before querying the database', async () => {
    await strategy.verifyCredentials({}, null, 'password', done)

    expect(done.calledOnceWithExactly(null, null)).to.equal(true)
  })

  it('rejects a non-string password before querying the database', async () => {
    await strategy.verifyCredentials({}, 'username', null, done)

    expect(done.calledOnceWithExactly(null, null)).to.equal(true)
  })

  it('rejects all non-string username and password values', async () => {
    const invalidValues = [undefined, null, 123, true, {}, []]

    for (const value of invalidValues) {
      done.resetHistory()

      await strategy.verifyCredentials({}, value, 'password', done)

      expect(done.calledOnceWithExactly(null, null)).to.equal(true)

      done.resetHistory()

      await strategy.verifyCredentials({}, 'username', value, done)

      expect(done.calledOnceWithExactly(null, null)).to.equal(true)
    }
  })
})