const http = require('http')
const chai = require('chai')
const expect = chai.expect
const { DEFAULT_REQUEST_TIMEOUT_SECONDS, applyServerTimeouts, parseServerRequestTimeout } = require('../../../server/utils/serverTimeouts')

describe('serverTimeouts', () => {
  describe('parseServerRequestTimeout', () => {
    it('should return the Node default when the env var is unset or empty', () => {
      expect(parseServerRequestTimeout(undefined)).to.equal(DEFAULT_REQUEST_TIMEOUT_SECONDS)
      expect(parseServerRequestTimeout('')).to.equal(DEFAULT_REQUEST_TIMEOUT_SECONDS)
      expect(parseServerRequestTimeout('  ')).to.equal(DEFAULT_REQUEST_TIMEOUT_SECONDS)
    })

    it('should parse a valid number of seconds', () => {
      expect(parseServerRequestTimeout('1200')).to.equal(1200)
      expect(parseServerRequestTimeout(' 1200 ')).to.equal(1200)
      expect(parseServerRequestTimeout('0')).to.equal(0)
      expect(parseServerRequestTimeout('30.5')).to.equal(30.5)
    })

    it('should return null for set but invalid values', () => {
      for (const value of ['abc', '-5', 'Infinity', '1h', '1,200', '1e3', '0x64', '1_200', '+5', '5.', '.5']) {
        expect(parseServerRequestTimeout(value), `value: ${value}`).to.equal(null)
      }
    })
  })

  describe('applyServerTimeouts', () => {
    it('should not touch the server when the value matches the Node default', () => {
      const server = http.createServer()
      const applied = applyServerTimeouts(server, DEFAULT_REQUEST_TIMEOUT_SECONDS)
      expect(applied).to.equal(null)
      expect(server.requestTimeout).to.equal(300000)
      expect(server.headersTimeout).to.equal(60000)
      expect(server.upgradeTimeout).to.equal(undefined)
    })

    it('should raise request, headers and upgrade timeouts above the defaults', () => {
      const server = http.createServer()
      const applied = applyServerTimeouts(server, 1200)
      expect(applied).to.equal(1200000)
      expect(server.requestTimeout).to.equal(1200000)
      expect(server.headersTimeout).to.equal(1200000)
      expect(server.upgradeTimeout).to.equal(1200000)
    })

    it('should not lower timeouts below the current values', () => {
      const server = http.createServer()
      const applied = applyServerTimeouts(server, 30)
      expect(applied).to.equal(30000)
      expect(server.requestTimeout).to.equal(30000)
      // headersTimeout (60s) and upgradeTimeout (Node default 300s) stay higher
      expect(server.headersTimeout).to.equal(60000)
      expect(server.upgradeTimeout).to.equal(undefined)
    })

    it('should disable the request timeout when set to 0 and leave the other timeouts alone', () => {
      const server = http.createServer()
      const applied = applyServerTimeouts(server, 0)
      expect(applied).to.equal(0)
      expect(server.requestTimeout).to.equal(0)
      expect(server.headersTimeout).to.equal(60000)
      expect(server.upgradeTimeout).to.equal(undefined)
    })

    it('should not re-enable a disabled headersTimeout', () => {
      const server = http.createServer()
      server.headersTimeout = 0
      const applied = applyServerTimeouts(server, 1200)
      expect(applied).to.equal(1200000)
      expect(server.requestTimeout).to.equal(1200000)
      expect(server.headersTimeout).to.equal(0)
      expect(server.upgradeTimeout).to.equal(1200000)
    })

    it('should not lower a pre-configured higher upgradeTimeout', () => {
      const server = http.createServer()
      server.upgradeTimeout = 2000000
      const applied = applyServerTimeouts(server, 1200)
      expect(applied).to.equal(1200000)
      expect(server.requestTimeout).to.equal(1200000)
      expect(server.headersTimeout).to.equal(1200000)
      expect(server.upgradeTimeout).to.equal(2000000)
    })

    it('should be a no-op when the value already matches the server', () => {
      const server = http.createServer()
      applyServerTimeouts(server, 1200)
      const applied = applyServerTimeouts(server, 1200)
      expect(applied).to.equal(null)
    })

    it('should not touch the server for invalid values', () => {
      for (const value of ['abc', null, undefined, NaN, -5, Infinity]) {
        const server = http.createServer()
        const applied = applyServerTimeouts(server, value)
        expect(applied, `value: ${value}`).to.equal(null)
        expect(server.requestTimeout, `value: ${value}`).to.equal(300000)
      }
    })
  })
})
