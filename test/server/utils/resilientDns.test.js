const { expect } = require('chai')
const sinon = require('sinon')
const dns = require('dns')
const http = require('http')
const https = require('https')

const { resilientLookup, getAgentsForUrl } = require('../../../server/utils/resilientDns')

describe('resilientDns', () => {
  afterEach(() => {
    sinon.restore()
    delete process.env.PREFER_IPV6
    delete process.env.EXP_DNS_RESOLUTION
  })

  describe('resilientLookup', () => {
    it('returns getaddrinfo result when dns.lookup succeeds', (done) => {
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(null, '1.2.3.4', 4))
      const resolve4 = sinon.stub(dns, 'resolve4')

      resilientLookup('example.com', {}, (err, address, family) => {
        expect(err).to.be.null
        expect(address).to.equal('1.2.3.4')
        expect(family).to.equal(4)
        expect(resolve4.called).to.be.false
        done()
      })
    })

    it('propagates non-EAI_AGAIN errors without fallback', (done) => {
      const error = Object.assign(new Error('getaddrinfo ENOTFOUND example.com'), { code: 'ENOTFOUND' })
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(error))
      const resolve4 = sinon.stub(dns, 'resolve4')

      resilientLookup('example.com', {}, (err) => {
        expect(err).to.equal(error)
        expect(resolve4.called).to.be.false
        done()
      })
    })

    it('falls back to IPv4 DNS resolution on EAI_AGAIN', (done) => {
      const error = Object.assign(new Error('getaddrinfo EAI_AGAIN example.com'), { code: 'EAI_AGAIN' })
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(error))
      sinon.stub(dns, 'resolve4').callsFake((hostname, callback) => callback(null, ['1.2.3.4', '5.6.7.8']))

      resilientLookup('example.com', {}, (err, address, family) => {
        expect(err).to.be.null
        expect(address).to.equal('1.2.3.4')
        expect(family).to.equal(4)
        done()
      })
    })

    it('falls back to IPv6 when IPv4 resolution fails', (done) => {
      const error = Object.assign(new Error('getaddrinfo EAI_AGAIN example.com'), { code: 'EAI_AGAIN' })
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(error))
      sinon.stub(dns, 'resolve4').callsFake((hostname, callback) => callback(Object.assign(new Error('SERVFAIL'), { code: 'ESERVFAIL' })))
      sinon.stub(dns, 'resolve6').callsFake((hostname, callback) => callback(null, ['2001:db8::1']))

      resilientLookup('example.com', {}, (err, address, family) => {
        expect(err).to.be.null
        expect(address).to.equal('2001:db8::1')
        expect(family).to.equal(6)
        done()
      })
    })

    it('returns the original getaddrinfo error when both fallbacks fail', (done) => {
      const error = Object.assign(new Error('getaddrinfo EAI_AGAIN example.com'), { code: 'EAI_AGAIN' })
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(error))
      sinon.stub(dns, 'resolve4').callsFake((hostname, callback) => callback(Object.assign(new Error('SERVFAIL'), { code: 'ESERVFAIL' })))
      sinon.stub(dns, 'resolve6').callsFake((hostname, callback) => callback(Object.assign(new Error('SERVFAIL'), { code: 'ESERVFAIL' })))

      resilientLookup('example.com', {}, (err) => {
        expect(err).to.equal(error)
        done()
      })
    })

    it('returns all addresses when options.all is set', (done) => {
      const error = Object.assign(new Error('getaddrinfo EAI_AGAIN example.com'), { code: 'EAI_AGAIN' })
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(error))
      sinon.stub(dns, 'resolve4').callsFake((hostname, callback) => callback(null, ['1.2.3.4', '5.6.7.8']))

      resilientLookup('example.com', { all: true }, (err, addresses) => {
        expect(err).to.be.null
        expect(addresses).to.deep.equal([
          { address: '1.2.3.4', family: 4 },
          { address: '5.6.7.8', family: 4 }
        ])
        done()
      })
    })

    it('prefers IPv6 in fallback when PREFER_IPV6 is set', (done) => {
      process.env.PREFER_IPV6 = '1'
      const error = Object.assign(new Error('getaddrinfo EAI_AGAIN example.com'), { code: 'EAI_AGAIN' })
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(error))
      const resolve4 = sinon.stub(dns, 'resolve4')
      sinon.stub(dns, 'resolve6').callsFake((hostname, callback) => callback(null, ['2001:db8::1']))

      resilientLookup('example.com', {}, (err, address, family) => {
        expect(err).to.be.null
        expect(address).to.equal('2001:db8::1')
        expect(family).to.equal(6)
        expect(resolve4.called).to.be.false
        done()
      })
    })

    it('supports callback as second argument', (done) => {
      sinon.stub(dns, 'lookup').callsFake((hostname, options, callback) => callback(null, '1.2.3.4', 4))

      resilientLookup('example.com', (err, address, family) => {
        expect(err).to.be.null
        expect(address).to.equal('1.2.3.4')
        expect(family).to.equal(4)
        done()
      })
    })
  })

  describe('getAgentsForUrl', () => {
    afterEach(() => {
      delete global.DisableSsrfRequestFilter
    })

    it('uses SSRF filter agents without custom lookup when flag is off', () => {
      const { httpAgent, httpsAgent } = getAgentsForUrl('https://example.com/feed')
      expect(httpsAgent).to.be.an.instanceOf(https.Agent)
      expect(httpAgent).to.equal(httpsAgent)
      expect(httpsAgent.options.lookup).to.be.undefined
    })

    it('returns null agents when flag is off and SSRF filter is disabled for the url', () => {
      global.DisableSsrfRequestFilter = () => true
      const { httpAgent, httpsAgent } = getAgentsForUrl('https://example.com/feed')
      expect(httpAgent).to.be.null
      expect(httpsAgent).to.be.null
    })

    it('attaches resilientLookup to both agents when flag is on', () => {
      process.env.EXP_DNS_RESOLUTION = '1'
      const { httpAgent, httpsAgent } = getAgentsForUrl('https://example.com/feed')
      expect(httpAgent).to.be.an.instanceOf(http.Agent)
      expect(httpsAgent).to.be.an.instanceOf(https.Agent)
      expect(httpAgent.options.lookup).to.equal(resilientLookup)
      expect(httpsAgent.options.lookup).to.equal(resilientLookup)
      // ssrf-req-filter wraps createConnection as an own property on the agent
      expect(Object.prototype.hasOwnProperty.call(httpAgent, 'createConnection')).to.be.true
      expect(Object.prototype.hasOwnProperty.call(httpsAgent, 'createConnection')).to.be.true
    })

    it('keeps custom lookup agents unfiltered when SSRF filter is disabled for the url', () => {
      process.env.EXP_DNS_RESOLUTION = '1'
      const filtered = []
      global.DisableSsrfRequestFilter = (url) => {
        filtered.push(url)
        return true
      }
      const { httpsAgent } = getAgentsForUrl('https://example.com/feed')
      expect(filtered).to.deep.equal(['https://example.com/feed'])
      expect(httpsAgent.options.lookup).to.equal(resilientLookup)
    })
  })
})
