const { expect } = require('chai')
const sinon = require('sinon')

const OidcAuthStrategy = require('../../../server/auth/OidcAuthStrategy')
const Logger = require('../../../server/Logger')

describe('OidcAuthStrategy - isValidWebCallbackUrl', () => {
  /** @type {OidcAuthStrategy} */
  let strategy

  beforeEach(() => {
    global.RouterBasePath = ''
    strategy = new OidcAuthStrategy()
    sinon.stub(Logger, 'warn')
    sinon.stub(Logger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  function mockReq({ secure = false, host = 'books.example.com', xForwardedProto = null } = {}) {
    return {
      secure,
      get(header) {
        if (header === 'host') return host
        if (header === 'x-forwarded-proto') return xForwardedProto
        return null
      }
    }
  }

  it('accepts a same-origin relative path when router base path is empty', () => {
    expect(strategy.isValidWebCallbackUrl('/library', mockReq())).to.equal(true)
  })

  it('accepts a same-origin absolute https URL', () => {
    const req = mockReq({ secure: true })
    expect(strategy.isValidWebCallbackUrl('https://books.example.com/library', req)).to.equal(true)
  })

  it('rejects protocol-relative URLs', () => {
    expect(strategy.isValidWebCallbackUrl('//evil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects backslash-prefixed URLs', () => {
    expect(strategy.isValidWebCallbackUrl('/\\evil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects absolute external URLs', () => {
    expect(strategy.isValidWebCallbackUrl('http://evil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects encoded protocol-relative path segments', () => {
    expect(strategy.isValidWebCallbackUrl('/%2F%2Fevil.example/capture', mockReq())).to.equal(false)
  })

  it('rejects same-origin URLs outside router base path', () => {
    global.RouterBasePath = '/audiobookshelf'
    expect(strategy.isValidWebCallbackUrl('/login', mockReq())).to.equal(false)
    expect(strategy.isValidWebCallbackUrl('/audiobookshelf/login', mockReq())).to.equal(true)
  })

  it('rejects empty and malformed callback URLs', () => {
    expect(strategy.isValidWebCallbackUrl('', mockReq())).to.equal(false)
    expect(strategy.isValidWebCallbackUrl(null, mockReq())).to.equal(false)
    expect(strategy.isValidWebCallbackUrl('not a url', mockReq())).to.equal(false)
  })

  it('uses x-forwarded-proto when determining same-origin https URLs', () => {
    const req = mockReq({ xForwardedProto: 'https' })
    expect(strategy.isValidWebCallbackUrl('https://books.example.com/login', req)).to.equal(true)
    expect(strategy.isValidWebCallbackUrl('http://books.example.com/login', req)).to.equal(false)
  })
})
