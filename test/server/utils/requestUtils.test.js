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

  it('getRequestOrigin builds origin from protocol and host', () => {
    expect(getRequestOrigin(mockReq({ secure: true }))).to.deep.equal({
      protocol: 'https',
      host: 'books.example.com',
      origin: 'https://books.example.com'
    })
  })
})
