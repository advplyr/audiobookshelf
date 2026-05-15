const { expect } = require('chai')
const AuthError = require('../../../server/auth/AuthError')

describe('AuthError', function () {
  it('should create error with default statusCode 500', function () {
    const error = new AuthError('Something went wrong')
    expect(error.message).to.equal('Something went wrong')
    expect(error.statusCode).to.equal(500)
    expect(error.name).to.equal('AuthError')
    expect(error).to.be.instanceOf(Error)
  })

  it('should create error with custom statusCode', function () {
    const error = new AuthError('Unauthorized', 401)
    expect(error.message).to.equal('Unauthorized')
    expect(error.statusCode).to.equal(401)
  })

  it('should have a stack trace', function () {
    const error = new AuthError('test')
    expect(error.stack).to.be.a('string')
    expect(error.stack).to.include('AuthError')
  })
})
