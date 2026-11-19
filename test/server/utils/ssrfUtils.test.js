const { expect } = require('chai')

const { getSsrfRequestFilterAgents } = require('../../../server/utils/ssrfUtils')

describe('ssrfUtils', () => {
  afterEach(() => {
    delete global.DisableSsrfRequestFilter
  })

  describe('getSsrfRequestFilterAgents', () => {
    it('should create protocol-specific agents for http urls', () => {
      const agents = getSsrfRequestFilterAgents('http://example.com/audio.mp3')

      expect(agents.httpAgent).to.have.property('protocol', 'http:')
      expect(agents.httpsAgent).to.have.property('protocol', 'https:')
    })

    it('should create an http agent for https urls that redirect to http', () => {
      const agents = getSsrfRequestFilterAgents('https://pdcn.co/e/http://feeds.soundcloud.com/stream/file.mp3')

      expect(agents.httpAgent).to.have.property('protocol', 'http:')
      expect(agents.httpsAgent).to.have.property('protocol', 'https:')
    })

    it('should disable agents when the global SSRF filter hook allows it', () => {
      global.DisableSsrfRequestFilter = () => true

      const agents = getSsrfRequestFilterAgents('https://example.com/audio.mp3')

      expect(agents.httpAgent).to.equal(null)
      expect(agents.httpsAgent).to.equal(null)
    })

    it('should pass the original url to the global SSRF filter hook', () => {
      let checkedUrl = null
      global.DisableSsrfRequestFilter = (url) => {
        checkedUrl = url
        return true
      }

      getSsrfRequestFilterAgents('https://example.com/audio.mp3')

      expect(checkedUrl).to.equal('https://example.com/audio.mp3')
    })
  })
})
