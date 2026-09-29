const { expect } = require('chai')

const { isRequestSecure, getRequestProtocol, getRequestOrigin } = require('../../../server/utils/requestUtils')

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

describe('requestUtils', () => {
  it('isRequestSecure uses req.secure', () => {
    expect(isRequestSecure(mockReq({ secure: true }))).to.equal(true)
    expect(isRequestSecure(mockReq({ secure: false }))).to.equal(false)
  })

  it('isRequestSecure uses x-forwarded-proto', () => {
    expect(isRequestSecure(mockReq({ xForwardedProto: 'https' }))).to.equal(true)
    expect(isRequestSecure(mockReq({ xForwardedProto: 'http' }))).to.equal(false)
    expect(isRequestSecure(mockReq({ xForwardedProto: 'http, https' }))).to.equal(true)
  })

  it('getRequestProtocol returns https or http', () => {
    expect(getRequestProtocol(mockReq({ secure: true }))).to.equal('https')
    expect(getRequestProtocol(mockReq())).to.equal('http')
  })

  it('keeps secure requests HTTPS even when the proxy reports HTTP', () => {
    expect(getRequestProtocol(mockReq({ secure: true, xForwardedProto: 'http' }))).to.equal('https')
  })

  it('normalizes proxy header case and whitespace', () => {
    expect(isRequestSecure(mockReq({ xForwardedProto: ' HTTP , HTTPS ' }))).to.equal(true)
    expect(isRequestSecure(mockReq({ xForwardedProto: 'http, https-other' }))).to.equal(false)
  })

  it('uses HTTP when the proxy header is missing or empty', () => {
    expect(getRequestProtocol({ secure: false, get: () => undefined })).to.equal('http')
    expect(getRequestProtocol(mockReq({ xForwardedProto: '' }))).to.equal('http')
  })

  it('preserves the existing origin when Host is missing', () => {
    expect(getRequestOrigin({ secure: false, get: () => undefined })).to.deep.equal({
      protocol: 'http',
      host: undefined,
      origin: 'http://undefined'
    })
  })

  it('getRequestOrigin builds origin from protocol and host', () => {
    expect(getRequestOrigin(mockReq({ secure: true }))).to.deep.equal({
      protocol: 'https',
      host: 'books.example.com',
      origin: 'https://books.example.com'
    })
  })
})
