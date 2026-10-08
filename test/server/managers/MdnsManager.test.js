const { expect } = require('chai')
const sinon = require('sinon')
const { EventEmitter } = require('events')
const fs = require('fs')
const fsPromises = require('fs/promises')
const os = require('os')
const Path = require('path')
const MdnsManager = require('../../../server/managers/MdnsManager')
const Logger = require('../../../server/Logger')

const SERVICE_ID = '3f2a9c1b-7d4e-4b8a-9c0d-1e2f3a4b5c6d'
/** Tests run from dist-server/test/server/managers, the real translations are in <repo>/client/strings */
const CLIENT_STRINGS_DIR = Path.resolve(__dirname, '../../../../client/strings')

/**
 * Translation files like <appRoot>/client/strings with recognizable values, so tests don't depend on real translations
 *
 * @param {string} appRoot
 * @returns {string} the strings directory
 */
const createStringsFixture = (appRoot) => {
  const stringsDir = Path.join(appRoot, 'client', 'strings')
  fs.mkdirSync(stringsDir, { recursive: true })
  const names = { 'en-us': 'Audiobook EN', de: 'Hörbuch DE', ja: 'オーディオブック JA' }
  for (const [code, name] of Object.entries(names)) {
    fs.writeFileSync(Path.join(stringsDir, `${code}.json`), JSON.stringify({ LabelSettingsMdnsDefaultName: name }))
  }
  return stringsDir
}
const lanInterfaces = () => ({
  lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
  eth0: [
    { address: '192.168.1.20', netmask: '255.255.255.0', family: 'IPv4', internal: false },
    // a secondary address ciao does not advertise
    { address: '192.168.1.21', netmask: '255.255.255.0', family: 'IPv4', internal: false },
    { address: 'fe80::20', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', scopeid: 2, internal: false },
    { address: 'fd00::5', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', scopeid: 0, internal: false },
    { address: 'fd00::6', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', scopeid: 0, internal: false }
  ]
})

describe('MdnsManager', () => {
  describe('normalizeName', () => {
    it('should trim and accept names in any script', () => {
      expect(MdnsManager.normalizeName('  School  ')).to.equal('School')
      expect(MdnsManager.normalizeName('書庫')).to.equal('書庫')
    })

    it('should strip control characters', () => {
      expect(MdnsManager.normalizeName('Kids\nBooks')).to.equal('KidsBooks')
    })

    it('should reject empty, whitespace only and non-string names', () => {
      expect(MdnsManager.normalizeName('')).to.be.null
      expect(MdnsManager.normalizeName('   ')).to.be.null
      expect(MdnsManager.normalizeName('\t \n')).to.be.null
      expect(MdnsManager.normalizeName(42)).to.be.null
      expect(MdnsManager.normalizeName(null)).to.be.null
    })

    it('should accept names up to the 63 byte DNS label limit, counted in UTF-8 bytes', () => {
      expect(MdnsManager.normalizeName('a'.repeat(63))).to.have.lengthOf(63)
      expect(MdnsManager.normalizeName('a'.repeat(64))).to.be.null
      // 21 x 3 byte characters = 63 bytes, 22 = 66 bytes
      expect(MdnsManager.normalizeName('書'.repeat(21))).to.equal('書'.repeat(21))
      expect(MdnsManager.normalizeName('書'.repeat(22))).to.be.null
    })

    it('should reject names ending with a number in parentheses (reserved for conflict renaming)', () => {
      expect(MdnsManager.normalizeName('Audiobookshelf (2)')).to.be.null
      expect(MdnsManager.normalizeName('Audiobookshelf 2')).to.equal('Audiobookshelf 2')
      expect(MdnsManager.normalizeName('(2) Books')).to.equal('(2) Books')
      expect(MdnsManager.normalizeName('Books (Kids)')).to.equal('Books (Kids)')
    })
  })

  describe('toHostnameLabel', () => {
    it('should derive an LDH hostname label', () => {
      expect(MdnsManager.toHostnameLabel('School')).to.equal('school')
      expect(MdnsManager.toHostnameLabel('My Audiobook Server!')).to.equal('my-audiobook-server')
    })

    it('should transliterate diacritics', () => {
      expect(MdnsManager.toHostnameLabel('Bibliothèque Familiale')).to.equal('bibliotheque-familiale')
      expect(MdnsManager.toHostnameLabel('Hörbücher')).to.equal('horbucher')
    })

    it('should transliterate latin letters that do not decompose', () => {
      expect(MdnsManager.toHostnameLabel('Hljóðbók')).to.equal('hljodbok')
      expect(MdnsManager.toHostnameLabel('Straße')).to.equal('strasse')
      expect(MdnsManager.toHostnameLabel('Bjørns bøker')).to.equal('bjorns-boker')
      expect(MdnsManager.toHostnameLabel('Æblehuset')).to.equal('aeblehuset')
      expect(MdnsManager.toHostnameLabel('Łódź')).to.equal('lodz')
      expect(MdnsManager.toHostnameLabel('Đà Nẵng')).to.equal('da-nang')
      expect(MdnsManager.toHostnameLabel('Þórsmörk')).to.equal('thorsmork')
      expect(MdnsManager.toHostnameLabel('Œuvre')).to.equal('oeuvre')
      expect(MdnsManager.toHostnameLabel('Kitaplık')).to.equal('kitaplik')
    })

    it('should return an empty string when nothing usable remains', () => {
      expect(MdnsManager.toHostnameLabel('書庫')).to.equal('')
      expect(MdnsManager.toHostnameLabel('')).to.equal('')
      expect(MdnsManager.toHostnameLabel(undefined)).to.equal('')
    })

    it('should strip a trailing .local domain and limit to 63 characters', () => {
      expect(MdnsManager.toHostnameLabel('books.local')).to.equal('books')
      expect(MdnsManager.toHostnameLabel('a'.repeat(100))).to.have.lengthOf(63)
    })
  })

  describe('getFallbackNames', () => {
    it('should append a stable suffix derived from the id', () => {
      expect(MdnsManager.getFallbackNames('Audiobookshelf', 'audiobookshelf', SERVICE_ID)).to.deep.equal({
        name: 'Audiobookshelf 3F2A',
        hostname: 'audiobookshelf-3f2a'
      })
    })

    it('should number further fallback levels', () => {
      expect(MdnsManager.getFallbackNames('Audiobookshelf', 'audiobookshelf', SERVICE_ID, 2)).to.deep.equal({
        name: 'Audiobookshelf 3F2A-2',
        hostname: 'audiobookshelf-3f2a-2'
      })
    })

    it('should truncate full length names so every level fits in a 63 byte DNS label', () => {
      for (const level of [1, 2, 99, 1000000]) {
        for (const name of ['a'.repeat(63), '書'.repeat(21), 'é'.repeat(31) + 'a']) {
          const fallback = MdnsManager.getFallbackNames(name, MdnsManager.toHostnameLabel(name) || 'audiobookshelf', SERVICE_ID, level)
          expect(Buffer.byteLength(fallback.name), `${name} level ${level}`).to.be.at.most(63)
          expect(fallback.hostname.length).to.be.at.most(63)
          expect(fallback.hostname).to.match(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
        }
      }
      expect(MdnsManager.getFallbackNames('a'.repeat(63), 'a'.repeat(63), SERVICE_ID, 1000000).name).to.equal(`${'a'.repeat(50)} 3F2A-1000000`)
    })

    it('should never cut a character in half when truncating', () => {
      // 3 byte characters do not fit evenly into the 58 bytes left for the name at level 1
      expect(MdnsManager.getFallbackNames('書'.repeat(21), 'audiobookshelf', SERVICE_ID).name).to.equal(`${'書'.repeat(19)} 3F2A`)
      // "e" + combining acute accent is one grapheme of 3 bytes and must stay together
      const decomposed = 'e\u0301'.repeat(21)
      const name = MdnsManager.getFallbackNames(decomposed, 'audiobookshelf', SERVICE_ID).name
      expect(name).to.equal(`${'e\u0301'.repeat(19)} 3F2A`)
    })
  })

  describe('patchCiaoLinuxInterfaceNames', () => {
    it('should strip the "@ifN" suffix of veth/macvlan interface names', async () => {
      class FakeNetworkManager {
        static async getLinuxNetworkInterfaces() {
          return ['eth0@if136', 'enp7s0', 'macvlan0@enp7s0', 'eth0@if136']
        }
      }
      expect(MdnsManager.patchCiaoLinuxInterfaceNames(FakeNetworkManager)).to.be.true
      expect(await FakeNetworkManager.getLinuxNetworkInterfaces()).to.deep.equal(['eth0', 'enp7s0', 'macvlan0'])
    })

    it('should only patch once', async () => {
      class FakeNetworkManager {
        static async getLinuxNetworkInterfaces() {
          return ['eth0@if1']
        }
      }
      MdnsManager.patchCiaoLinuxInterfaceNames(FakeNetworkManager)
      const patched = FakeNetworkManager.getLinuxNetworkInterfaces
      expect(MdnsManager.patchCiaoLinuxInterfaceNames(FakeNetworkManager)).to.be.true
      expect(FakeNetworkManager.getLinuxNetworkInterfaces).to.equal(patched)
    })

    it('should still apply to the installed @homebridge/ciao version', () => {
      // Fails if a ciao update renames the patched method, so the workaround can be re-checked or removed
      expect(MdnsManager.patchCiaoLinuxInterfaceNames()).to.be.true
    })
  })

  describe('patchCiaoProberConflicts', () => {
    // The real ciao classes, so this fails when a ciao update changes what the patch relies on
    const { Prober } = require('@homebridge/ciao/lib/responder/Prober')
    const { CiaoService } = require('@homebridge/ciao/lib/CiaoService')
    const { DNSPacket } = require('@homebridge/ciao/lib/coder/DNSPacket')
    const { Question } = require('@homebridge/ciao/lib/coder/Question')
    const { ARecord } = require('@homebridge/ciao/lib/coder/records/ARecord')
    const { NSECRecord } = require('@homebridge/ciao/lib/coder/records/NSECRecord')
    const tiebreaking = require('@homebridge/ciao/lib/util/tiebreaking')
    const endpoint = { address: '192.168.1.9', port: 5353, interface: 'eth0' }
    let clock

    /** A real ciao service, as Responder.createService() creates it */
    const createService = (name, hostname = 'audiobook', ipv4 = '192.168.1.5') => {
      const networkManager = new EventEmitter()
      networkManager.getInterfaceMap = () => new Map([['eth0', { name: 'eth0', ipv4 }]])
      const service = new CiaoService(networkManager, { name, type: 'audiobookshelf', port: 13378, hostname, txt: { id: SERVICE_ID } })
      service.rebuildServiceRecords()
      return service
    }
    /** The records a service probes with, as Prober.sendProbeRequest() collects them */
    const probeRecords = (service) => [service.srvRecord(), service.txtRecord(), service.ptrRecord(), ...service.subtypePtrRecords(), ...service.allAddressRecords()].sort(tiebreaking.rrComparator)
    /** A prober that has sent its first probe query, so it handles responses */
    const createProber = (service) => {
      const responder = { getAnnouncedServices: () => [].values() }
      const server = { sendQueryBroadcast: sinon.stub().resolves([]) }
      const prober = new Prober(responder, server, service)
      service.serviceState = 'probing'
      prober.records = probeRecords(service)
      prober.sentFirstProbeQuery = true
      return prober
    }
    /** A response from another device on the network */
    const responseFrom = ({ answers = [], additionals = [] }) => new DNSPacket({ type: 1, answers, additionals })

    before(() => {
      expect(MdnsManager.patchCiaoProberConflicts()).to.be.true
    })

    beforeEach(() => {
      clock = sinon.useFakeTimers()
    })

    afterEach(() => {
      clock.restore()
      sinon.restore()
    })

    it('should still apply to the installed @homebridge/ciao version', () => {
      expect(MdnsManager.patchCiaoProberConflicts()).to.be.true
      expect(Prober.prototype.handleResponse.absPatched).to.be.true
      // ciao renames from handleResponse() through handleNameChange()
      expect(Prober.prototype.handleNameChange).to.be.a('function')
    })

    it('should only patch once', () => {
      const { handleResponse } = Prober.prototype
      expect(MdnsManager.patchCiaoProberConflicts(Prober)).to.be.true
      expect(Prober.prototype.handleResponse).to.equal(handleResponse)
    })

    it('should not patch an unknown Prober', () => {
      class OtherProber {
        handleQuery() {}
      }
      expect(MdnsManager.patchCiaoProberConflicts(OtherProber)).to.be.false
      expect(MdnsManager.patchCiaoProberConflicts({})).to.be.false
    })

    it('should record a hostname only conflict, signal it right after and still let ciao rename', async () => {
      const ours = createService('Livre audio')
      const other = createService('Hörbuch', 'audiobook', '192.168.1.9')
      const prober = createProber(ours)
      const signalled = sinon.spy()
      ours.on('abs-conflict', signalled)
      prober.handleResponse(responseFrom({ answers: other.allAddressRecords() }), endpoint)

      expect(ours.absConflict).to.deep.equal({ name: false, hostname: true })
      expect(MdnsManager.getConflictingNames(ours)).to.deep.equal({ name: false, hostname: true, determined: true })
      // ciao's own handling is unchanged
      expect(ours.getFQDN()).to.equal('Livre audio (2)._audiobookshelf._tcp.local.')
      // not from within ciao's handleResponse()
      expect(signalled.called).to.be.false
      await new Promise((resolve) => process.nextTick(resolve))
      expect(signalled.calledOnce).to.be.true
      prober.clear()
    })

    it('should record an instance name only conflict', () => {
      const ours = createService('Audiobook', 'school')
      const other = createService('Audiobook', 'kids', '192.168.1.9')
      const prober = createProber(ours)
      prober.handleResponse(responseFrom({ answers: [other.srvRecord(), other.txtRecord()] }), endpoint)

      expect(ours.absConflict).to.deep.equal({ name: true, hostname: false })
      prober.clear()
    })

    it('should record a conflict on both names, also from additional records', () => {
      const ours = createService('Audiobook')
      const other = createService('Audiobook', 'audiobook', '192.168.1.9')
      const prober = createProber(ours)
      prober.handleResponse(responseFrom({ answers: [other.srvRecord()], additionals: [new NSECRecord(other.getHostname(), other.getHostname(), [1])] }), endpoint)

      expect(ours.absConflict).to.deep.equal({ name: true, hostname: true })
      prober.clear()
    })

    it('should ignore responses for other names', async () => {
      const ours = createService('Livre audio')
      const signalled = sinon.spy()
      ours.on('abs-conflict', signalled)
      const other = createService('Hörbuch', 'horbuch', '192.168.1.9')
      const prober = createProber(ours)
      prober.handleResponse(responseFrom({ answers: [...other.allAddressRecords(), other.srvRecord()] }), endpoint)

      expect(ours.absConflict).to.be.undefined
      expect(ours.getFQDN()).to.equal('Livre audio._audiobookshelf._tcp.local.')
      await new Promise((resolve) => process.nextTick(resolve))
      expect(signalled.called).to.be.false
      prober.clear()
    })

    it('should only record the first conflict, later ones are about the names ciao numbered', () => {
      const ours = createService('Audiobook')
      const prober = createProber(ours)
      prober.handleResponse(responseFrom({ answers: [new ARecord('audiobook.local.', '192.168.1.9')] }), endpoint)
      prober.sentFirstProbeQuery = true
      prober.handleResponse(responseFrom({ answers: [new ARecord('audiobook-(2).local.', '192.168.1.9')], additionals: [ours.srvRecord()] }), endpoint)

      expect(ours.absConflict).to.deep.equal({ name: false, hostname: true })
      prober.clear()
    })

    it('should not rename on a lost simultaneous probe tiebreak, only on the response to the next probe (RFC 6762 8.2)', async () => {
      const ours = createService('Livre audio', 'audiobook', '192.168.1.5')
      const other = createService('Hörbuch', 'audiobook', '192.168.1.9')
      // the higher address wins the tiebreak
      expect(tiebreaking.runTiebreaking(probeRecords(ours), probeRecords(other))).to.equal(-1)
      const prober = createProber(ours)
      const probe = new DNSPacket({ type: 0, questions: [new Question(other.getFQDN(), 255), new Question(other.getHostname(), 255)], authorities: probeRecords(other) })
      prober.handleQuery(probe, endpoint)

      // lost: ciao waits a second and probes again without renaming
      expect(prober.sentFirstProbeQuery).to.be.false
      expect(ours.absConflict).to.be.undefined
      expect(ours.getFQDN()).to.equal('Livre audio._audiobookshelf._tcp.local.')
      await clock.tickAsync(1000)
      expect(prober.server.sendQueryBroadcast.calledOnce).to.be.true

      // the winner announced and answers our next probe for audiobook.local only
      prober.sentFirstProbeQuery = true
      prober.handleResponse(responseFrom({ answers: other.allAddressRecords() }), endpoint)
      expect(ours.absConflict).to.deep.equal({ name: false, hostname: true })
      prober.clear()
    })

    it('should not record anything when ciao renames outside of handleResponse()', () => {
      const ours = createService('Audiobook')
      const prober = createProber(ours)
      // e.g. checkLocalConflicts(), never the case with one service per responder
      prober.handleNameChange()

      expect(ours.absConflict).to.be.undefined
      expect(MdnsManager.getConflictingNames(ours)).to.deep.equal({ name: true, hostname: true, determined: false })
      prober.clear()
    })
  })

  describe('patchCiaoSourceNetworkCheck', () => {
    // ciao's NetworkInterface info, see NetworkManager.getInterfaceMap()
    const ciaoInterfaces = new Map(
      Object.entries({
        eth0: { name: 'eth0', ipv4: '192.168.1.20', ip4Netmask: '255.255.255.0', loopback: false },
        docker0: { name: 'docker0', ipv4: '172.17.0.1', ip4Netmask: '255.255.0.0', loopback: false },
        // a /32 address, e.g. a WireGuard or cloud interface
        wg0: { name: 'wg0', ipv4: '10.8.0.2', ip4Netmask: '255.255.255.255', loopback: false },
        // no IPv4 netmask known
        tun0: { name: 'tun0', ipv4: '10.9.0.2', loopback: false },
        lo: { name: 'lo', ipv4: '127.0.0.1', ip4Netmask: '255.0.0.0', loopback: true }
      })
    )

    /** Same handleMessage(name, buffer, rinfo, family) and networkManager as ciao's MDNSServer */
    const createFakeServer = (interfaces = ciaoInterfaces) => {
      class FakeMDNSServer {
        constructor() {
          this.networkManager = { getInterface: (name) => interfaces.get(name), getInterfaceMap: () => interfaces }
          this.handled = []
        }
        handleMessage(name, buffer, rinfo, family) {
          this.handled.push(`${name} ${rinfo.address}`)
        }
      }
      expect(MdnsManager.patchCiaoSourceNetworkCheck(FakeMDNSServer, 'linux')).to.be.true
      return new FakeMDNSServer()
    }
    const receive = (server, name, address, family = 'IPv4') => server.handleMessage(name, Buffer.alloc(12), { address, port: 5353, family, size: 12 }, family)

    it("should ignore a packet on an interface's socket that came from the network of another local interface", () => {
      const server = createFakeServer()
      // Linux delivers a LAN query to the sockets of all interfaces
      receive(server, 'eth0', '192.168.1.50')
      receive(server, 'docker0', '192.168.1.50')
      // and a query from a container to all of them as well
      receive(server, 'eth0', '172.17.0.2')
      receive(server, 'docker0', '172.17.0.2')

      expect(server.handled).to.deep.equal(['eth0 192.168.1.50', 'docker0 172.17.0.2'])
    })

    it('should handle a source that is on no local network, e.g. from a relay that keeps the source address', () => {
      const server = createFakeServer()
      receive(server, 'eth0', '10.20.30.40')
      receive(server, 'docker0', '10.20.30.40')
      // link-local hosts
      receive(server, 'eth0', '169.254.10.20')

      expect(server.handled).to.deep.equal(['eth0 10.20.30.40', 'docker0 10.20.30.40', 'eth0 169.254.10.20'])
    })

    it('should handle /32 interfaces, interfaces without a netmask, loopback, IPv6 and interfaces unknown to ciao', () => {
      const server = createFakeServer()
      // a /32 interface only covers its own address
      receive(server, 'wg0', '10.8.0.5')
      receive(server, 'eth0', '10.8.0.2')
      receive(server, 'wg0', '192.168.1.50')
      // without a netmask nothing is on its network
      receive(server, 'tun0', '10.9.0.7')
      receive(server, 'eth0', '10.9.0.7')
      receive(server, 'lo', '127.0.0.1')
      receive(server, 'eth0', 'fe80::1', 'IPv6')
      receive(server, 'docker0', '192.168.1.50', 'IPv6')
      // e.g. not in os.networkInterfaces() anymore, ciao decides
      receive(server, 'wlan0', '192.168.1.50')

      expect(server.handled).to.deep.equal(['wg0 10.8.0.5', 'tun0 10.9.0.7', 'eth0 10.9.0.7', 'lo 127.0.0.1', 'eth0 fe80::1', 'docker0 192.168.1.50', 'wlan0 192.168.1.50'])
    })

    it("should let ciao decide when its interfaces aren't known yet", () => {
      const server = createFakeServer()
      server.networkManager.getInterfaceMap = () => {
        throw new Error('Not yet initialized!')
      }
      receive(server, 'docker0', '192.168.1.50')
      expect(server.handled).to.deep.equal(['docker0 192.168.1.50'])
    })

    it('should handle a packet on every interface that shares the network it comes from', () => {
      const lan = { name: 'eth0', ipv4: '192.168.1.20', ip4Netmask: '255.255.255.0' }
      const wifi = { name: 'wlan0', ipv4: '192.168.1.30', ip4Netmask: '255.255.255.0' }
      expect(MdnsManager.isFromOtherInterfaceNetwork('192.168.1.50', lan, [lan, wifi])).to.be.false
      expect(MdnsManager.isFromOtherInterfaceNetwork('192.168.1.50', wifi, [lan, wifi])).to.be.false
    })

    it('should ignore a relayed source that is on the network of another interface (trade-off)', () => {
      const lan = { name: 'eth0', ipv4: '192.168.1.20', ip4Netmask: '255.255.255.0' }
      const vpn = { name: 'tun0', ipv4: '10.0.0.2', ip4Netmask: '255.0.0.0' }
      // relayed onto the LAN from 10.20.30.40, which is on the VPN's network
      expect(MdnsManager.isFromOtherInterfaceNetwork('10.20.30.40', lan, [lan, vpn])).to.be.true
      // without the VPN it is on no local network and handled
      expect(MdnsManager.isFromOtherInterfaceNetwork('10.20.30.40', lan, [lan])).to.be.false
    })

    it('should only patch on Linux', () => {
      class FakeMDNSServer {
        handleMessage() {}
      }
      const original = FakeMDNSServer.prototype.handleMessage
      for (const platform of ['win32', 'darwin', 'freebsd']) {
        expect(MdnsManager.patchCiaoSourceNetworkCheck(FakeMDNSServer, platform), platform).to.be.false
      }
      expect(FakeMDNSServer.prototype.handleMessage).to.equal(original)
    })

    it('should only patch once', () => {
      class FakeMDNSServer {
        handleMessage() {}
      }
      MdnsManager.patchCiaoSourceNetworkCheck(FakeMDNSServer, 'linux')
      const patched = FakeMDNSServer.prototype.handleMessage
      expect(MdnsManager.patchCiaoSourceNetworkCheck(FakeMDNSServer, 'linux')).to.be.true
      expect(FakeMDNSServer.prototype.handleMessage).to.equal(patched)
      expect(MdnsManager.patchCiaoSourceNetworkCheck({}, 'linux')).to.be.false
    })

    it('should still apply to the installed @homebridge/ciao version', () => {
      const { MDNSServer } = require('@homebridge/ciao/lib/MDNSServer')
      const { NetworkManager } = require('@homebridge/ciao/lib/NetworkManager')
      // the patch relies on handleMessage(name, buffer, rinfo, family), getInterface(name), getInterfaceMap()
      expect(MDNSServer.prototype.handleMessage.length).to.equal(4)
      expect(NetworkManager.prototype.getInterface).to.be.a('function')
      expect(NetworkManager.prototype.getInterfaceMap).to.be.a('function')
      expect(MdnsManager.patchCiaoSourceNetworkCheck(undefined, 'linux')).to.be.true
      expect(MDNSServer.prototype.handleMessage.absPatched).to.be.true
    })
  })

  describe('with the real @homebridge/ciao', () => {
    const ciao = require('@homebridge/ciao')
    const udpSockets = () => process.getActiveResourcesInfo().filter((resource) => resource === 'UDPWrap').length

    beforeEach(() => {
      sinon.stub(Logger, 'warn')
      sinon.stub(Logger, 'error')
    })

    afterEach(() => {
      sinon.restore()
    })

    it('should close all sockets of a responder released right after it was created, and get a new one next time', async () => {
      const before = udpSockets()
      const manager = new MdnsManager({ ciao })
      // getResponder() starts opening sockets, without a service nothing is sent
      const first = ciao.getResponder()
      manager.responder = first
      await manager.releaseService()
      const second = ciao.getResponder()
      expect(second).to.not.equal(first)
      manager.responder = second
      await manager.releaseService()
      // closing a socket finishes asynchronously
      for (let i = 0; i < 100 && udpSockets() > before; i++) await new Promise((resolve) => setTimeout(resolve, 10))

      expect(udpSockets()).to.equal(before)
      expect(Logger.warn.called).to.be.false
      expect(Logger.error.called).to.be.false
    })
  })

  describe('isLikelyDockerBridgeNetwork', () => {
    const iface = (address, internal = false) => ({ address, internal, family: 'IPv4' })

    it('should be true when all IPv4 addresses are in 172.16.0.0/12', () => {
      expect(MdnsManager.isLikelyDockerBridgeNetwork({ lo: [iface('127.0.0.1', true)], eth0: [iface('172.17.0.2')] })).to.be.true
    })

    it('should be false for LAN addresses', () => {
      expect(MdnsManager.isLikelyDockerBridgeNetwork({ eth0: [iface('192.168.1.20')] })).to.be.false
      expect(MdnsManager.isLikelyDockerBridgeNetwork({ eth0: [iface('172.17.0.2')], eth1: [iface('10.0.0.5')] })).to.be.false
      expect(MdnsManager.isLikelyDockerBridgeNetwork({ eth0: [iface('172.32.0.2')] })).to.be.false
      expect(MdnsManager.isLikelyDockerBridgeNetwork({ lo: [iface('127.0.0.1', true)] })).to.be.false
    })
  })

  describe('getConfig', () => {
    const serverOptions = { port: '13378', host: undefined, basePath: '/audiobookshelf' }
    const settings = { mdnsEnabled: true, mdnsName: null, mdnsServiceId: SERVICE_ID }
    const getConfig = (overrides = {}) => MdnsManager.getConfig({ serverOptions, settings, env: {}, ...overrides })

    it('should use defaults', () => {
      const config = getConfig()
      expect(config.enabled).to.be.true
      expect(config.name).to.equal('Audiobook')
      expect(config.hostname).to.equal('audiobook')
      expect(config.port).to.equal(13378)
      expect(config.interfaces).to.be.undefined
      expect(config.disableIpv6).to.be.false
      expect(config.txt).to.deep.equal({ txtvers: '1', id: SERVICE_ID, path: '/audiobookshelf/' })
    })

    it('should not advertise the server version', () => {
      expect(getConfig().txt).to.not.have.property('version')
    })

    it('should advertise path "/" without a base path', () => {
      expect(getConfig({ serverOptions: { ...serverOptions, basePath: '' } }).txt.path).to.equal('/')
    })

    it('should derive the hostname from the configured name', () => {
      const config = getConfig({ settings: { ...settings, mdnsName: 'School' } })
      expect(config.name).to.equal('School')
      expect(config.hostname).to.equal('school')
    })

    it('should fall back to the default hostname for non-latin names', () => {
      const config = getConfig({ settings: { ...settings, mdnsName: '書庫' } })
      expect(config.name).to.equal('書庫')
      expect(config.hostname).to.equal('audiobook')
    })

    it('should use the translated default name with the fixed default hostname when no name is set', () => {
      expect(getConfig({ defaultName: 'Hörbuch' })).to.include({ name: 'Hörbuch', hostname: 'audiobook' })
      expect(getConfig({ defaultName: 'オーディオブック' })).to.include({ name: 'オーディオブック', hostname: 'audiobook' })
      expect(getConfig({ settings: { ...settings, mdnsName: '' }, defaultName: 'Livre audio' })).to.include({ name: 'Livre audio', hostname: 'audiobook' })
    })

    it('should treat empty environment variables (e.g. unset UnRAID template variables) as not set', () => {
      for (const value of ['', '   ']) {
        const config = getConfig({ env: { MDNS_NAME: value, DISABLE_MDNS: '' }, defaultName: 'Hörbuch' })
        expect(config).to.include({ enabled: true, name: 'Hörbuch', hostname: 'audiobook' })
        expect(new MdnsManager({ env: { MDNS_NAME: value, DISABLE_MDNS: '' } }).lockedByEnv).to.deep.equal({ enabled: false, name: false })
      }
    })

    it('should only accept 1 and true for DISABLE_MDNS', () => {
      for (const value of ['yes', 'on', '0', 'false']) {
        expect(getConfig({ env: { DISABLE_MDNS: value } }).enabled, value).to.be.true
        expect(new MdnsManager({ env: { DISABLE_MDNS: value } }).lockedByEnv.enabled, value).to.be.false
      }
      expect(getConfig({ env: { DISABLE_MDNS: 'TRUE' } }).enabled).to.be.false
    })

    it('should prefer the configured name and MDNS_NAME over the translated default name', () => {
      expect(getConfig({ settings: { ...settings, mdnsName: 'School' }, defaultName: 'Hörbuch' })).to.include({ name: 'School', hostname: 'school' })
      expect(getConfig({ env: { MDNS_NAME: 'Living Room' }, defaultName: 'Hörbuch' })).to.include({ name: 'Living Room', hostname: 'living-room' })
      expect(getConfig({ settings: { ...settings, mdnsName: 'Hörbuch' }, defaultName: 'Audiobook' })).to.include({ name: 'Hörbuch', hostname: 'horbuch' })
    })

    it('should ignore an invalid translated default name', () => {
      expect(getConfig({ defaultName: 'Hörbuch (2)' }).name).to.equal('Audiobook')
      expect(getConfig({ defaultName: '   ' }).name).to.equal('Audiobook')
    })

    it('should let environment variables override settings', () => {
      const config = getConfig({ env: { MDNS_NAME: 'Living Room', MDNS_PORT: '8080', MDNS_INTERFACES: 'eth0, 192.168.1.5' } })
      expect(config.name).to.equal('Living Room')
      expect(config.hostname).to.equal('living-room')
      expect(config.port).to.equal(8080)
      expect(config.interfaces).to.deep.equal(['eth0', '192.168.1.5'])
    })

    it('should be disabled by setting or DISABLE_MDNS', () => {
      expect(getConfig({ settings: { ...settings, mdnsEnabled: false } }).enabled).to.be.false
      expect(getConfig({ env: { DISABLE_MDNS: '1' } }).enabled).to.be.false
      expect(getConfig({ env: { DISABLE_MDNS: 'true' } }).enabled).to.be.false
      expect(getConfig({ env: { DISABLE_MDNS: '0' } }).enabled).to.be.true
    })

    it('should be disabled for unix sockets, loopback hosts and invalid ports', () => {
      expect(getConfig({ serverOptions: { ...serverOptions, host: 'unix//tmp/abs.sock' } }).enabled).to.be.false
      expect(getConfig({ serverOptions: { ...serverOptions, host: '127.0.0.1' } }).enabled).to.be.false
      expect(getConfig({ serverOptions: { ...serverOptions, host: 'localhost' }, hostAddresses: ['127.0.0.1', '::1'] }).enabled).to.be.false
      expect(getConfig({ serverOptions: { ...serverOptions, host: '::1' } }).enabled).to.be.false
      expect(getConfig({ serverOptions: { ...serverOptions, port: 'abc' } }).enabled).to.be.false
      expect(getConfig({ env: { MDNS_PORT: '70000' } }).enabled).to.be.false
    })

    it('should only advertise the bound address when listening on a single IP', () => {
      const config = getConfig({ serverOptions: { ...serverOptions, host: '192.168.1.5' } })
      expect(config.interfaces).to.deep.equal(['192.168.1.5'])
      expect(config.disableIpv6).to.be.true
    })

    it('should only advertise the address the server bound a HOST name to', () => {
      const config = getConfig({ serverOptions: { ...serverOptions, host: 'nas.lan', address: '192.168.1.5' } })
      expect(config.enabled).to.be.true
      expect(config.interfaces).to.deep.equal(['192.168.1.5'])
      expect(config.disableIpv6).to.be.true
    })

    it('should be disabled when a HOST name can not be resolved', () => {
      const config = getConfig({ serverOptions: { ...serverOptions, host: 'nas.lan' } })
      expect(config.enabled).to.be.false
      expect(config.reason).to.include('could not resolve')
    })

    it('should ignore an invalid MDNS_NAME', () => {
      expect(getConfig({ env: { MDNS_NAME: 'Kids (2)' } }).name).to.equal('Audiobook')
    })

    it('should disable IPv6 when bound to 0.0.0.0 and not when bound to ::', () => {
      expect(getConfig({ serverOptions: { ...serverOptions, host: '0.0.0.0' } }).disableIpv6).to.be.true
      expect(getConfig({ serverOptions: { ...serverOptions, host: '::' } }).disableIpv6).to.be.false
    })
  })

  describe('getDefaultName', () => {
    let tmpDir
    let stringsDir
    const writeStrings = (code, content) => fs.writeFileSync(Path.join(stringsDir, `${code}.json`), typeof content === 'string' ? content : JSON.stringify(content))

    beforeEach(() => {
      // Same layout as the app: <appRoot>/client/strings
      tmpDir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-mdns-'))
      stringsDir = createStringsFixture(tmpDir)
      // Outside of the strings directory, must never be read
      fs.writeFileSync(Path.join(tmpDir, 'secret.json'), JSON.stringify({ LabelSettingsMdnsDefaultName: 'Secret' }))
      sinon.stub(Logger, 'warn')
      sinon.stub(Logger, 'debug')
    })

    afterEach(() => {
      sinon.restore()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('should read the default name for the server language', async () => {
      const manager = new MdnsManager({ stringsDir })
      expect(await manager.getDefaultName('en-us')).to.equal('Audiobook EN')
      expect(await manager.getDefaultName('de')).to.equal('Hörbuch DE')
      expect(await manager.getDefaultName('ja')).to.equal('オーディオブック JA')
    })

    it('should fall back to English for unknown, missing or invalid language codes', async () => {
      const manager = new MdnsManager({ stringsDir })
      const languages = ['xx', '', undefined, null, 42, {}, [], 'DE', 'de ', 'en-us.json', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'x'.repeat(10000), '日本語', 'dé', 'de\u0000']
      for (const language of languages) {
        expect(await manager.getDefaultName(language), String(language).slice(0, 20)).to.equal('Audiobook EN')
      }
      expect(manager.defaultNames.size).to.equal(1)
    })

    it('should never read files outside of the strings directory', async () => {
      const readFile = sinon.spy(fsPromises, 'readFile')
      const manager = new MdnsManager({ stringsDir })
      for (const language of ['../secret', '../../../secret', '..', '/etc/passwd', 'de/../../../secret', '..\\secret', '%2e%2e/secret']) {
        expect(await manager.getDefaultName(language)).to.equal('Audiobook EN')
      }
      expect(readFile.args.map(([filePath]) => filePath)).to.deep.equal([Path.join(stringsDir, 'en-us.json')])
    })

    it('should fall back to English when the translation is missing or invalid', async () => {
      writeStrings('fr', {})
      writeStrings('it', { LabelSettingsMdnsDefaultName: 'Audiolibro (2)' })
      writeStrings('nl', { LabelSettingsMdnsDefaultName: 'x'.repeat(64) })
      writeStrings('pl', '{ not json')
      const manager = new MdnsManager({ stringsDir })
      for (const language of ['fr', 'it', 'nl', 'pl']) {
        expect(await manager.getDefaultName(language)).to.equal('Audiobook EN')
      }
      expect(Logger.warn.calledWithMatch('Ignoring invalid LabelSettingsMdnsDefaultName "Audiolibro (2)"')).to.be.true
    })

    it('should fall back to "Audiobook" when the English translation is missing or invalid', async () => {
      writeStrings('en-us', { LabelSettingsMdnsDefaultName: '' })
      writeStrings('fr', {})
      const manager = new MdnsManager({ stringsDir })
      expect(await manager.getDefaultName('en-us')).to.equal('Audiobook')
      expect(await manager.getDefaultName('fr')).to.equal('Audiobook')
      expect(await manager.getDefaultName('de')).to.equal('Hörbuch DE')
    })

    it('should fall back to "Audiobook" without a warning when no app root is set', async () => {
      const appRoot = global.appRoot
      try {
        delete global.appRoot
        expect(await new MdnsManager().getDefaultName('de')).to.equal('Audiobook')
        expect(Logger.warn.called).to.be.false
      } finally {
        global.appRoot = appRoot
      }
    })

    it('should warn once and retry later when the strings directory can not be read', async () => {
      const missingDir = Path.join(tmpDir, 'missing', 'client', 'strings')
      const manager = new MdnsManager({ stringsDir: missingDir })
      expect(await manager.getDefaultName('de')).to.equal('Audiobook')
      expect(await manager.getDefaultName('de')).to.equal('Audiobook')
      expect(Logger.warn.calledOnce).to.be.true
      expect(Logger.warn.firstCall.args[0]).to.include(missingDir)

      // e.g. a volume mounted late, nothing failed is cached
      fs.mkdirSync(missingDir, { recursive: true })
      fs.writeFileSync(Path.join(missingDir, 'de.json'), JSON.stringify({ LabelSettingsMdnsDefaultName: 'Hörbuch DE' }))
      expect(await manager.getDefaultName('de')).to.equal('Hörbuch DE')
    })

    it('should read each translation file only once', async () => {
      const readFile = sinon.spy(fsPromises, 'readFile')
      const readdir = sinon.spy(fsPromises, 'readdir')
      const manager = new MdnsManager({ stringsDir })
      await Promise.all([manager.getDefaultName('de'), manager.getDefaultName('de'), manager.getDefaultName('xx')])
      await manager.getDefaultName('de')
      await manager.getDefaultName('en-us')
      expect(readdir.calledOnce).to.be.true
      expect(readFile.callCount).to.equal(2)
    })

    it('should resolve the strings directory from the app root', async () => {
      const appRoot = global.appRoot
      try {
        global.appRoot = tmpDir
        expect(await new MdnsManager().getDefaultName('de')).to.equal('Hörbuch DE')
      } finally {
        global.appRoot = appRoot
      }
    })

    it('should have a valid default name in every client translation that has one', () => {
      const files = fs.readdirSync(CLIENT_STRINGS_DIR).filter((file) => file.endsWith('.json'))
      expect(files).to.include('en-us.json')
      for (const file of files) {
        const value = JSON.parse(fs.readFileSync(Path.join(CLIENT_STRINGS_DIR, file), 'utf8')).LabelSettingsMdnsDefaultName
        // Weblate adds new languages with partial translations
        if (value === undefined && file !== 'en-us.json') continue
        expect(MdnsManager.normalizeName(value), file).to.equal(value)
      }
    })
  })

  describe('advertising', () => {
    let clock
    let ciao
    let responder
    let services
    let settings
    let settingsStore

    /** Same API as ciao's CiaoService as far as MdnsManager uses it */
    const createFakeService = (options) => {
      const service = new EventEmitter()
      service.options = options
      let fqdn = `${options.name}._${options.type}._tcp.local.`
      let hostname = `${options.hostname}.local.`
      service.getFQDN = () => fqdn
      service.getHostname = () => hostname
      /**
       * Like ciao: of each interface only the first IPv4 address and the first link-local, global and unique local
       * IPv6 address, limited to restrictedAddresses (IPs or interface names)
       */
      service.allAddressRecords = () =>
        Object.entries(hostInterfaces).flatMap(([name, infos]) => {
          const ipv6 = infos.filter((info) => info.family === 'IPv6' && !options.disabledIpv6)
          const kept = [infos.find((info) => info.family === 'IPv4'), ipv6.find((info) => info.scopeid), ipv6.find((info) => info.scopeid === 0 && /^f[cd]/.test(info.address)), ipv6.find((info) => info.scopeid === 0 && !/^f[cd]/.test(info.address))].filter(Boolean).map((info) => info.address)
          const restricted = options.restrictedAddresses
          return !restricted || restricted.includes(name) ? kept : kept.filter((address) => restricted.includes(address))
        })
      service.advertise = sinon.stub().resolves()
      service.destroy = sinon.stub().resolves()
      /**
       * What ciao does on a conflict while probing: it renames both to "name (2)" / "hostname-(2)" and probes again.
       * The patched Prober (patchCiaoProberConflicts) records which name conflicted and signals it right after.
       *
       * @param {{ name: boolean, hostname: boolean }} conflict
       */
      service.simulateConflict = (conflict) => {
        service.absConflict = conflict
        fqdn = `${options.name} (2)._${options.type}._tcp.local.`
        hostname = `${options.hostname}-(2).local.`
        process.nextTick(() => service.emit('abs-conflict'))
      }
      /** ciao's rename without patchCiaoProberConflicts(): nothing is reported until probing "name (2)" succeeds */
      service.simulateUnpatchedRename = () => {
        fqdn = `${options.name} (2)._${options.type}._tcp.local.`
        hostname = `${options.hostname}-(2).local.`
      }
      services.push(service)
      return service
    }

    /** os.networkInterfaces() of the host */
    let hostInterfaces
    const createManager = (overrides = {}) => new MdnsManager({ ciao, settingsStore, networkInterfaces: () => hostInterfaces, env: {}, ...overrides })
    const startManager = async (overrides) => {
      const manager = createManager(overrides)
      await manager.init({ port: 13378 })
      return manager
    }
    /**
     * Customize every service the responder creates from now on
     *
     * @param {(service: EventEmitter, options: Object) => void} customize
     */
    const onCreateService = (customize) => {
      responder.createService = sinon.spy((options) => {
        const service = createFakeService(options)
        customize(service, options)
        return service
      })
    }
    /** A goodbye or shutdown that never finishes */
    const hang = () => new Promise(() => {})
    /** Sending goodbyes takes a moment */
    const slowGoodbye = () => new Promise((resolve) => setTimeout(resolve, 100))

    beforeEach(() => {
      hostInterfaces = lanInterfaces()
      clock = sinon.useFakeTimers()
      services = []
      responder = {
        createService: sinon.spy((options) => createFakeService(options)),
        shutdown: sinon.stub().resolves()
      }
      ciao = { getResponder: sinon.stub().returns(responder) }
      settings = { mdnsEnabled: true, mdnsName: 'Audiobookshelf', mdnsServiceId: SERVICE_ID, mdnsFallbackFor: null }
      settingsStore = { get: () => settings, save: sinon.stub().resolves() }
      sinon.stub(Logger, 'info')
      sinon.stub(Logger, 'warn')
      sinon.stub(Logger, 'error')
      sinon.stub(Logger, 'debug')
    })

    afterEach(() => {
      clock.restore()
      sinon.restore()
    })

    it('should advertise an _audiobookshelf._tcp service', async () => {
      const manager = createManager()
      await manager.init({ port: 13378, basePath: '' })
      await clock.tickAsync(0)

      expect(ciao.getResponder.calledOnceWith(undefined)).to.be.true
      expect(services).to.have.lengthOf(1)
      expect(services[0].options).to.deep.equal({
        name: 'Audiobookshelf',
        type: 'audiobookshelf',
        port: 13378,
        hostname: 'audiobookshelf',
        txt: { txtvers: '1', id: SERVICE_ID, path: '/' },
        disabledIpv6: false
      })
      expect(manager.getStatus()).to.include({ state: 'advertising', name: 'Audiobookshelf', hostname: 'audiobookshelf.local', url: 'http://audiobookshelf.local:13378/' })
    })

    it('should generate and persist a service id on first start', async () => {
      settings.mdnsServiceId = null
      const manager = await startManager()

      expect(settings.mdnsServiceId).to.match(/^[0-9a-f-]{36}$/)
      expect(settingsStore.save.calledOnce).to.be.true
      expect(services[0].options.txt.id).to.equal(settings.mdnsServiceId)
    })

    it('should not load ciao or create a responder when disabled', async () => {
      settings.mdnsEnabled = false
      const manager = await startManager()

      expect(ciao.getResponder.called).to.be.false
      expect(manager.getStatus().state).to.equal('disabled')
    })

    it("should change both names when it can't be determined which one conflicted", async () => {
      const manager = await startManager()
      const original = services[0]

      // ciao without patchCiaoProberConflicts() only reports the rename with its own events
      original.emit('name-change', 'Audiobookshelf (2)')
      original.emit('hostname-change', 'audiobookshelf-(2)')
      await clock.tickAsync(0)

      expect(original.destroy.calledOnce).to.be.true
      expect(responder.shutdown.calledOnce).to.be.true
      expect(services).to.have.lengthOf(2)
      expect(services[1].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf-3f2a' })
      expect(settings).to.include({ mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 1, mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 1 })
      expect(settingsStore.save.called).to.be.true
      expect(Logger.warn.calledWithMatch('The name "Audiobookshelf" or the hostname audiobookshelf.local is already used')).to.be.true

      await clock.tickAsync(0)
      expect(manager.getStatus()).to.include({ state: 'advertising', name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf-3f2a.local' })
    })

    it('should not suspect a copied server id when it is not known which name conflicted', async () => {
      Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 1 })
      const manager = await startManager()
      // e.g. only the plain hostname was taken
      services[0].emit('name-change', 'Audiobookshelf 3F2A (2)')
      await clock.tickAsync(0)

      expect(services[1].options).to.include({ name: 'Audiobookshelf 3F2A-2', hostname: 'audiobookshelf-3f2a' })
      expect(Logger.warn.calledWithMatch('same server id')).to.be.false
    })

    it('should start with the persisted fallback names after a restart', async () => {
      Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 1, mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 1 })
      const manager = await startManager()

      expect(services).to.have.lengthOf(1)
      expect(services[0].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf-3f2a' })
    })

    it('should move to the next numbered fallback when the fallback is taken too', async () => {
      Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 1, mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 1 })
      const manager = await startManager()
      services[0].simulateConflict({ name: true, hostname: true })
      await clock.tickAsync(0)

      expect(services).to.have.lengthOf(2)
      expect(services[1].options).to.include({ name: 'Audiobookshelf 3F2A-2', hostname: 'audiobookshelf-3f2a-2' })
      expect(settings.mdnsFallbackLevel).to.equal(2)
      expect(manager.getStatus()).to.include({ state: 'advertising', name: 'Audiobookshelf 3F2A-2' })
      expect(Logger.warn.calledWithMatch('appears to use the same server id')).to.be.true
    })

    it('should start with the persisted fallback levels after a restart', async () => {
      Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 3, mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 2 })
      const manager = await startManager()

      expect(services[0].options).to.include({ name: 'Audiobookshelf 3F2A-3', hostname: 'audiobookshelf-3f2a-2' })
    })

    it('should ignore invalid persisted fallback levels', async () => {
      Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: -2, mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 'x' })
      const manager = await startManager()

      expect(services[0].options).to.include({ name: 'Audiobookshelf', hostname: 'audiobookshelf' })
    })

    describe('when only one name conflicts (RFC 6762 9)', () => {
      it('should keep the instance name when only the hostname is taken', async () => {
        // e.g. "Hörbuch" and "Livre audio", two servers with the translated default name, both on audiobook.local
        settings.mdnsName = null
        const manager = createManager({ stringsDir: CLIENT_STRINGS_DIR })
        settings.language = 'fr'
        await manager.init({ port: 13378 })
        const name = services[0].options.name
        expect(services[0].options.hostname).to.equal('audiobook')

        services[0].simulateConflict({ name: false, hostname: true })
        await clock.tickAsync(200)

        expect(services).to.have.lengthOf(2)
        expect(services[1].options).to.include({ name, hostname: 'audiobook-3f2a' })
        expect(settings).to.include({ mdnsFallbackFor: null, mdnsFallbackLevel: null, mdnsHostnameFallbackFor: 'audiobook', mdnsHostnameFallbackLevel: 1 })
        expect(Logger.warn.calledWithMatch('The hostname audiobook.local is already used by another device')).to.be.true
        expect(Logger.warn.calledWithMatch('same server id')).to.be.false
        await clock.tickAsync(0)
        expect(manager.getStatus()).to.include({ state: 'advertising', name, hostname: 'audiobook-3f2a.local', url: 'http://audiobook-3f2a.local:13378/' })
      })

      it('should keep the hostname when only the instance name is taken', async () => {
        const manager = await startManager()

        services[0].simulateConflict({ name: true, hostname: false })
        await clock.tickAsync(200)

        expect(services[1].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf' })
        expect(settings).to.include({ mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 1, mdnsHostnameFallbackLevel: null })
        expect(Logger.warn.calledWithMatch('The name "Audiobookshelf" is already used by another device')).to.be.true
      })

      it('should change both when both are taken', async () => {
        const manager = await startManager()

        services[0].simulateConflict({ name: true, hostname: true })
        await clock.tickAsync(200)

        expect(services[1].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf-3f2a' })
        expect(settings).to.include({ mdnsFallbackLevel: 1, mdnsHostnameFallbackLevel: 1 })
        expect(Logger.warn.calledWithMatch('The name "Audiobookshelf" and the hostname audiobookshelf.local are already used')).to.be.true
        expect(Logger.debug.calledWithMatch('Could not tell whether')).to.be.false
      })

      it('should advance each name on its own across conflicts and restarts', async () => {
        const manager = await startManager()
        services[0].simulateConflict({ name: false, hostname: true })
        await clock.tickAsync(200)
        services[1].simulateConflict({ name: true, hostname: false })
        await clock.tickAsync(200)

        expect(services[2].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf-3f2a' })
        expect(settings).to.include({ mdnsFallbackLevel: 1, mdnsHostnameFallbackLevel: 1 })
        // The fallback hostname contains part of the id, so it is only taken by a server with the same id
        services[2].simulateConflict({ name: false, hostname: true })
        await clock.tickAsync(200)
        expect(services[3].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf-3f2a-2' })
        expect(Logger.warn.calledWithMatch('same server id')).to.be.true
        await manager.stop()

        // restart: each keeps its own fallback
        const restarted = await startManager()
        expect(services[4].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf-3f2a-2' })
        await restarted.stop()
      })

      it('should keep a hostname only fallback after a restart', async () => {
        Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 1 })
        const manager = await startManager()

        expect(services[0].options).to.include({ name: 'Audiobookshelf', hostname: 'audiobookshelf-3f2a' })
      })

      it('should keep a name only fallback after a restart', async () => {
        Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 1 })
        const manager = await startManager()

        expect(services[0].options).to.include({ name: 'Audiobookshelf 3F2A', hostname: 'audiobookshelf' })
      })

      it('should reset both fallbacks when the configured name changes', async () => {
        Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 2, mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 1 })
        const manager = await startManager()
        settings.mdnsName = 'School'
        await manager.apply()

        expect(settings).to.include({ mdnsFallbackFor: null, mdnsFallbackLevel: null, mdnsHostnameFallbackLevel: null })
        expect(services[1].options).to.include({ name: 'School', hostname: 'school' })
      })

      it('should keep fallback hostnames within 63 bytes when only the hostname is taken', async () => {
        settings.mdnsName = 'a'.repeat(63)
        Object.assign(settings, { mdnsHostnameFallbackFor: 'a'.repeat(63), mdnsHostnameFallbackLevel: 1000000 })
        const manager = await startManager()

        expect(services[0].options.name).to.equal('a'.repeat(63))
        expect(services[0].options.hostname).to.equal(`${'a'.repeat(50)}-3f2a-1000000`)
      })
    })

    it("should catch ciao's internal rename while probing, before it can produce an over-long name", async () => {
      // ciao renames to "name (2)" internally and would only emit its events after probing succeeds, which never
      // happens when "name (2)" is longer than 63 bytes. The patched Prober signals the rename right away.
      settings.mdnsName = 'a'.repeat(63)
      onCreateService((service) => {
        if (services.length > 1) return
        service.advertise = sinon.spy(() => {
          setTimeout(() => service.simulateConflict({ name: true, hostname: false }), 50)
          return hang()
        })
      })
      const manager = await startManager()
      await clock.tickAsync(50)

      expect(services[0].destroy.calledOnce).to.be.true
      // the responder that cancelled a probe is replaced, ciao can't probe on it again
      expect(responder.shutdown.calledOnce).to.be.true
      expect(ciao.getResponder.calledTwice).to.be.true
      expect(services[1].options.name).to.equal(`${'a'.repeat(58)} 3F2A`)
      expect(Buffer.byteLength(services[1].options.name)).to.equal(63)
      expect(manager.getStatus()).to.include({ state: 'advertising', name: `${'a'.repeat(58)} 3F2A` })
    })

    it('should still catch the rename of an over-long name when the ciao patch could not be applied', async () => {
      settings.mdnsName = 'a'.repeat(63)
      onCreateService((service) => {
        if (services.length === 1) {
          service.advertise = sinon.spy(() => {
            setTimeout(() => service.simulateUnpatchedRename(), 50)
            return hang()
          })
        }
      })
      const manager = createManager()
      manager.watchRenames = true
      await manager.init({ port: 13378 })
      await clock.tickAsync(1000)

      expect(services[1].options.name).to.equal(`${'a'.repeat(58)} 3F2A`)
      expect(manager.getStatus()).to.include({ state: 'advertising', name: `${'a'.repeat(58)} 3F2A` })
      await manager.stop()
      expect(clock.countTimers()).to.equal(0)
    })

    it('should slow down after 15 conflicts in 10 seconds (RFC 6762 8.1)', async () => {
      onCreateService((service, options) => {
        // every name is taken
        service.advertise = sinon.spy(async () => service.emit('name-change', `${options.name} (2)`))
      })
      const manager = await startManager()
      await clock.tickAsync(0)

      expect(services).to.have.lengthOf(15)
      await clock.tickAsync(4999)
      expect(services).to.have.lengthOf(15)
      await clock.tickAsync(1)
      expect(services).to.have.lengthOf(16)
      expect(services[15].options.name).to.equal('Audiobookshelf 3F2A-15')
      await manager.stop()
    })

    it('should retry with exponential backoff instead of giving up', async () => {
      onCreateService((service) => {
        if (services.length < 3) service.advertise.rejects(new Error('bind EADDRINUSE'))
      })
      const manager = await startManager()
      await clock.tickAsync(0)

      expect(manager.getStatus().state).to.equal('retrying')
      expect(services[0].destroy.calledOnce).to.be.true
      expect(responder.shutdown.calledOnce).to.be.true

      await clock.tickAsync(5000)
      expect(services).to.have.lengthOf(2)
      expect(manager.getStatus().state).to.equal('retrying')

      // second retry waits twice as long
      await clock.tickAsync(9999)
      expect(services).to.have.lengthOf(2)
      await clock.tickAsync(1)
      expect(services).to.have.lengthOf(3)
      expect(manager.getStatus().state).to.equal('advertising')
    })

    it('should retry when creating the responder throws', async () => {
      ciao.getResponder.onFirstCall().throws(new Error('no sockets'))
      const manager = await startManager()
      await clock.tickAsync(0)

      expect(manager.getStatus().state).to.equal('retrying')
      await clock.tickAsync(5000)
      expect(manager.getStatus().state).to.equal('advertising')
    })

    it('should re-advertise when settings change', async () => {
      const manager = await startManager()
      settings.mdnsName = 'School'
      await manager.apply()

      expect(services[0].destroy.calledOnce).to.be.true
      expect(services[1].options).to.include({ name: 'School', hostname: 'school' })
    })

    describe('with the translated default name', () => {
      let tmpDir
      let stringsDir

      beforeEach(() => {
        tmpDir = fs.mkdtempSync(Path.join(os.tmpdir(), 'abs-mdns-'))
        stringsDir = createStringsFixture(tmpDir)
        settings.mdnsName = null
        settings.language = 'en-us'
      })

      afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      })

      it('should follow server language changes with the name but keep the hostname', async () => {
        const manager = await startManager({ stringsDir })
        expect(services[0].options).to.include({ name: 'Audiobook EN', hostname: 'audiobook' })
        expect(manager.getStatus()).to.include({ configuredName: 'Audiobook EN', defaultName: 'Audiobook EN', hostname: 'audiobook.local' })

        settings.language = 'de'
        await manager.apply()
        expect(services[0].destroy.calledOnce).to.be.true
        expect(services[1].options).to.include({ name: 'Hörbuch DE', hostname: 'audiobook' })

        settings.language = 'ja'
        await manager.apply()
        expect(services[2].options).to.include({ name: 'オーディオブック JA', hostname: 'audiobook' })
        expect(manager.getStatus()).to.include({ configuredName: 'オーディオブック JA', defaultName: 'オーディオブック JA', hostname: 'audiobook.local', url: 'http://audiobook.local:13378/' })
      })

      it('should not re-advertise on a language change when a name is set', async () => {
        settings.mdnsName = 'School'
        const manager = await startManager({ stringsDir })
        settings.language = 'de'
        await manager.apply()

        expect(services).to.have.lengthOf(1)
        expect(manager.getStatus()).to.include({ configuredName: 'School', defaultName: 'Hörbuch DE' })
      })

      it('should drop the fallback name but keep the fallback hostname when the language changes the default name', async () => {
        Object.assign(settings, { mdnsFallbackFor: 'Audiobook EN', mdnsFallbackLevel: 1, mdnsHostnameFallbackFor: 'audiobook', mdnsHostnameFallbackLevel: 1 })
        const manager = await startManager({ stringsDir })
        expect(services[0].options).to.include({ name: 'Audiobook EN 3F2A', hostname: 'audiobook-3f2a' })

        settingsStore.save.resetHistory()
        settings.language = 'de'
        await manager.apply()
        // the hostname is the same in every language, so it is still taken
        expect(settings).to.include({ mdnsFallbackFor: null, mdnsFallbackLevel: null, mdnsHostnameFallbackFor: 'audiobook', mdnsHostnameFallbackLevel: 1 })
        expect(settingsStore.save.called).to.be.true
        expect(services[1].options).to.include({ name: 'Hörbuch DE', hostname: 'audiobook-3f2a' })
      })

      it('should keep a hostname only fallback when the language changes', async () => {
        Object.assign(settings, { mdnsHostnameFallbackFor: 'audiobook', mdnsHostnameFallbackLevel: 2 })
        const manager = await startManager({ stringsDir })
        settings.language = 'de'
        await manager.apply()
        settings.language = 'ja'
        await manager.apply()

        expect(services.map((service) => service.options.hostname)).to.deep.equal(['audiobook-3f2a-2', 'audiobook-3f2a-2', 'audiobook-3f2a-2'])
        expect(services[2].options.name).to.equal('オーディオブック JA')
        expect(settings).to.include({ mdnsHostnameFallbackFor: 'audiobook', mdnsHostnameFallbackLevel: 2 })
      })

      it('should report no default name before it is started', () => {
        expect(createManager({ stringsDir }).getStatus()).to.include({ state: 'disabled', defaultName: undefined })
      })

      it('should advertise "Audiobook" when the translations are missing', async () => {
        settings.language = 'de'
        const manager = await startManager({ stringsDir: Path.join(tmpDir, 'missing') })
        expect(services[0].options).to.include({ name: 'Audiobook', hostname: 'audiobook' })
      })
    })

    it('should not re-advertise when nothing changed', async () => {
      const manager = await startManager()
      await manager.apply()

      expect(services).to.have.lengthOf(1)
      expect(services[0].destroy.called).to.be.false
    })

    it('should send goodbyes when disabled at runtime', async () => {
      const manager = await startManager()
      settings.mdnsEnabled = false
      await manager.apply()

      expect(services[0].destroy.calledOnce).to.be.true
      expect(responder.shutdown.calledOnce).to.be.true
      expect(manager.getStatus().state).to.equal('disabled')
    })

    it('should stop cleanly and be safe to call twice', async () => {
      const manager = await startManager()
      await manager.stop()
      await manager.stop()

      expect(services[0].destroy.calledOnce).to.be.true
      expect(responder.shutdown.calledOnce).to.be.true
      expect(manager.getStatus().state).to.equal('disabled')
    })

    describe('in docker', () => {
      let source
      beforeEach(() => {
        source = global.Source
        global.Source = 'docker'
      })
      afterEach(() => {
        global.Source = source
      })

      it('should warn when the container looks like it is on a bridge network', async () => {
        const bridgeInterfaces = () => ({ eth0: [{ address: '172.18.0.2', family: 'IPv4', internal: false }] })
        const manager = createManager({ networkInterfaces: bridgeInterfaces })
        await manager.init({ port: 80 })

        expect(Logger.warn.calledOnce).to.be.true
        expect(Logger.warn.firstCall.args[0]).to.include('Docker bridge network')
      })

      it('should only inform about network requirements otherwise', async () => {
        const manager = createManager()
        await manager.init({ port: 80 })

        expect(Logger.warn.called).to.be.false
        expect(Logger.info.calledWithMatch('Running in Docker')).to.be.true
      })
    })

    it('should report the configured name separately from the advertised fallback name', async () => {
      Object.assign(settings, { mdnsFallbackFor: 'Kids', mdnsFallbackLevel: 1 })
      const manager = await startManager({ env: { MDNS_NAME: 'Kids' } })
      await clock.tickAsync(0)

      expect(manager.getStatus()).to.include({ configuredName: 'Kids', name: 'Kids 3F2A' })
      expect(manager.getStatus().lockedByEnv).to.deep.equal({ enabled: false, name: true })
    })

    it('should not leave a service advertising when settings change in quick succession', async () => {
      const manager = await startManager()
      await clock.tickAsync(0)
      // stopping the current service takes a moment (goodbye packets)
      services[0].destroy = sinon.spy(slowGoodbye)

      // first request: rename, its apply() reads the settings and starts stopping the old service
      settings.mdnsName = 'School'
      const rename = manager.apply()
      await clock.tickAsync(10)
      // second request arrives meanwhile: disable
      settings.mdnsEnabled = false
      const disable = manager.apply()
      await clock.tickAsync(200)
      await Promise.all([rename, disable])

      expect(manager.getStatus().state).to.equal('disabled')
      expect(manager.service).to.be.null
      // every service that was created has been destroyed
      expect(services).to.have.lengthOf(2)
      expect(services.every((service) => service.destroy.calledOnce)).to.be.true
    })

    it('should clear the persisted fallback when the configured name changes', async () => {
      settings.mdnsFallbackFor = 'Audiobookshelf'
      const manager = await startManager({ env: { MDNS_NAME: 'Kids' } })

      expect(settings.mdnsFallbackFor).to.be.null
      expect(settingsStore.save.called).to.be.true
      expect(services[0].options).to.include({ name: 'Kids', hostname: 'kids' })
    })

    it('should move to the next fallback when a conflict happens after the name was announced', async () => {
      Object.assign(settings, { mdnsFallbackFor: 'Audiobookshelf', mdnsFallbackLevel: 1, mdnsHostnameFallbackFor: 'audiobookshelf', mdnsHostnameFallbackLevel: 1 })
      const manager = await startManager()
      await clock.tickAsync(0)
      expect(manager.getStatus()).to.include({ state: 'advertising', name: 'Audiobookshelf 3F2A' })

      services[0].emit('name-change', 'Audiobookshelf 3F2A (2)')
      await clock.tickAsync(0)

      expect(services[0].destroy.calledOnce).to.be.true
      expect(manager.getStatus()).to.include({ state: 'advertising', name: 'Audiobookshelf 3F2A-2', hostname: 'audiobookshelf-3f2a-2.local' })
    })

    it('should only advertise the address the server is bound to for a HOST name', async () => {
      const manager = createManager()
      await manager.init({ port: 13378, host: 'nas.lan', address: '192.168.1.5' })

      expect(ciao.getResponder.calledOnceWith({ interface: ['192.168.1.5'] })).to.be.true
      // ciao maps an IP to its whole interface, the service is restricted to the address
      expect(services[0].options).to.deep.include({ restrictedAddresses: ['192.168.1.5'], disabledIpv6: true })
    })

    it('should only advertise the IPv6 address HOST is', async () => {
      const manager = createManager()
      await manager.init({ port: 13378, host: 'fd00::5', address: 'fd00::5' })
      await clock.tickAsync(0)

      expect(ciao.getResponder.calledOnceWith({ interface: ['fd00::5'] })).to.be.true
      expect(services[0].options).to.deep.include({ restrictedAddresses: ['fd00::5'], disabledIpv6: false })
      expect(services[0].allAddressRecords()).to.deep.equal(['fd00::5'])
      expect(manager.getStatus().state).to.equal('advertising')
    })

    it("should not claim to advertise a secondary IPv4 or IPv6 address of an interface, ciao can't advertise it", async () => {
      for (const [host, reason] of [
        ['192.168.1.21', '192.168.1.21 is not the first IPv4 address of eth0, mDNS can only advertise that one (192.168.1.20, fe80::20, fd00::5)'],
        ['fd00::6', 'fd00::6 is not the first IPv6 address of eth0']
      ]) {
        services = []
        const manager = createManager()
        await manager.init({ port: 13378, host, address: host })
        await clock.tickAsync(0)

        expect(manager.getStatus().state, host).to.equal('disabled')
        expect(manager.getStatus().reason, host).to.include(reason)
        expect(services, host).to.have.lengthOf(0)
      }
      // the same for MDNS_INTERFACES
      const manager = createManager({ env: { MDNS_INTERFACES: '192.168.1.21' } })
      await manager.init({ port: 13378 })
      expect(manager.getStatus().state).to.equal('disabled')
    })

    it('should not report advertising when ciao has no address to advertise', async () => {
      onCreateService((service) => {
        // the address is removed from the interface while probing
        service.advertise = sinon.spy(async () => (hostInterfaces = { eth0: [{ address: '192.168.1.30', netmask: '255.255.255.0', family: 'IPv4', internal: false }] }))
      })
      const manager = createManager()
      await manager.init({ port: 13378, host: '192.168.1.20', address: '192.168.1.20' })
      await clock.tickAsync(0)
      expect(manager.getStatus()).to.include({ state: 'retrying', reason: 'there is no address to advertise on any network interface' })

      // it is back
      hostInterfaces = lanInterfaces()
      onCreateService(() => {})
      await clock.tickAsync(5000)
      expect(manager.getStatus().state).to.equal('advertising')
    })

    it('should restrict the service to MDNS_INTERFACES and advertise everywhere otherwise', async () => {
      const manager = await startManager({ env: { MDNS_INTERFACES: 'eth0' } })
      expect(services[0].options.restrictedAddresses).to.deep.equal(['eth0'])

      const unrestricted = await startManager()
      expect(services[1].options).to.not.have.property('restrictedAddresses')
    })

    it('should report why it is not advertising on a unix socket', async () => {
      const manager = createManager()
      await manager.init({ port: 13378, host: 'unix//run/abs.sock' })

      expect(manager.getStatus()).to.include({ state: 'disabled', reason: 'server is listening on a unix socket', configuredName: 'Audiobookshelf' })
      expect(ciao.getResponder.called).to.be.false
    })

    it('should report a probe that does not finish instead of failing silently', async () => {
      onCreateService((service) => {
        service.advertise = sinon.spy(hang) // ciao keeps retrying internally
      })
      const manager = await startManager()
      expect(manager.getStatus().state).to.equal('probing')

      await clock.tickAsync(30000)
      expect(manager.getStatus().state).to.equal('retrying')
      expect(manager.getStatus().reason).to.include('still probing')
      expect(Logger.warn.calledWithMatch('still probing')).to.be.true
    })

    describe('applying changes', () => {
      const STOP_TIMEOUT = 3000

      it("should report 'updating' until a change is applied", async () => {
        const manager = await startManager()
        await clock.tickAsync(0)
        services[0].destroy = sinon.spy(slowGoodbye)

        settings.mdnsName = 'School'
        const applied = manager.apply()
        // the rest of the status is still from before the change
        expect(manager.getStatus()).to.include({ state: 'updating', name: 'Audiobookshelf' })
        await clock.tickAsync(50)
        expect(manager.getStatus().state).to.equal('updating')
        await clock.tickAsync(50)
        await applied
        expect(manager.getStatus().state).to.not.equal('updating')
        await clock.tickAsync(0)
        expect(manager.getStatus()).to.include({ state: 'advertising', name: 'School' })
      })

      it("should report 'updating' while starting and stopping", async () => {
        const manager = createManager()
        const started = manager.init({ port: 13378 })
        expect(manager.getStatus().state).to.equal('updating')
        await started
        const stopped = manager.stop()
        expect(manager.getStatus().state).to.equal('updating')
        await stopped
        expect(manager.getStatus()).to.include({ state: 'disabled', reason: 'server stopped' })
      })

      it('should not let a hung goodbye block the change or later changes', async () => {
        const manager = await startManager()
        await clock.tickAsync(0)
        services[0].destroy = sinon.spy(hang)

        settings.mdnsName = 'School'
        let done = false
        manager.apply().then(() => (done = true))
        await clock.tickAsync(STOP_TIMEOUT - 1)
        expect(done).to.be.false
        await clock.tickAsync(1)
        expect(done).to.be.true
        // the responder is still shut down, otherwise ciao would hand the old one out again
        expect(responder.shutdown.calledOnce).to.be.true
        expect(Logger.warn.calledWithMatch('did not finish within 3s')).to.be.true
        await clock.tickAsync(0)
        expect(manager.getStatus()).to.include({ state: 'advertising', name: 'School' })

        // the queue is not stuck
        settings.mdnsEnabled = false
        await manager.apply()
        expect(manager.getStatus().state).to.equal('disabled')
        expect(services[1].destroy.calledOnce).to.be.true
      })

      it('should shut down the responder when sending goodbyes fails', async () => {
        const manager = await startManager()
        services[0].destroy = sinon.stub().rejects(new Error('socket closed'))
        settings.mdnsEnabled = false
        await manager.apply()

        expect(responder.shutdown.calledOnce).to.be.true
        expect(Logger.error.calledWithMatch('Failed to stop mDNS advertising')).to.be.true
        expect(manager.getStatus().state).to.equal('disabled')
      })

      it('should not let a hung responder shutdown block server shutdown', async () => {
        const manager = await startManager()
        responder.shutdown = sinon.spy(hang)

        let done = false
        manager.stop().then(() => (done = true))
        await clock.tickAsync(STOP_TIMEOUT)
        expect(done).to.be.true
        expect(manager.getStatus()).to.include({ state: 'disabled', reason: 'server stopped' })
      })

      it('should apply changes made in quick succession once', async () => {
        const manager = await startManager()
        await clock.tickAsync(0)
        services[0].destroy = sinon.spy(slowGoodbye)

        settings.mdnsName = 'A'
        const first = manager.apply()
        await clock.tickAsync(10)
        // these wait for the first change, then read the settings once
        settings.mdnsName = 'B'
        const second = manager.apply()
        settings.mdnsName = 'C'
        const third = manager.apply()
        expect(third).to.equal(second)
        await clock.tickAsync(100)
        await Promise.all([first, second, third])

        expect(services.map((service) => service.options.name)).to.deep.equal(['Audiobookshelf', 'A', 'C'])
        await clock.tickAsync(0)
        expect(manager.getStatus()).to.include({ state: 'advertising', name: 'C' })
      })

      it('should never reject, even if a queued task throws', async () => {
        const manager = createManager()
        await manager.enqueue(() => {
          throw new Error('boom')
        })
        expect(manager.pending).to.equal(0)
        expect(Logger.error.calledWithMatch('Failed to apply mDNS settings')).to.be.true
        await manager.init({ port: 13378 })
        await clock.tickAsync(0)
        expect(manager.getStatus().state).to.equal('advertising')
      })
    })

    it('should report environment locks', () => {
      const manager = createManager({ env: { DISABLE_MDNS: '1', MDNS_NAME: 'School' } })
      expect(manager.lockedByEnv).to.deep.equal({ enabled: true, name: true })
    })

    it('should not lock the name for an invalid MDNS_NAME, it is ignored', () => {
      for (const value of ['Kids (2)', 'x'.repeat(64), '\n']) {
        expect(createManager({ env: { MDNS_NAME: value } }).lockedByEnv.name, value).to.be.false
      }
    })

    describe('lifecycle', () => {
      const SHUTDOWN_TIMEOUT = 5000

      it('should end up advertising when disabled and enabled again while a change is applied', async () => {
        const manager = await startManager()
        await clock.tickAsync(0)
        services[0].destroy = sinon.spy(slowGoodbye)

        settings.mdnsName = 'School'
        const rename = manager.apply()
        await clock.tickAsync(10)
        settings.mdnsEnabled = false
        manager.apply()
        settings.mdnsEnabled = true
        const enable = manager.apply()
        await clock.tickAsync(100)
        await Promise.all([rename, enable])
        await clock.tickAsync(0)

        expect(manager.getStatus()).to.include({ state: 'advertising', name: 'School' })
        expect(services).to.have.lengthOf(2)
        expect(services[1].destroy.called).to.be.false
      })

      it('should not advertise again when a change is applied after stop()', async () => {
        const manager = await startManager()
        settings.mdnsName = 'School'
        const applied = manager.apply()
        const stopped = manager.stop()
        settings.mdnsName = 'Kids'
        const late = manager.apply()
        await Promise.all([applied, stopped, late])
        await clock.tickAsync(1000)

        expect(services).to.have.lengthOf(1)
        expect(services[0].destroy.calledOnce).to.be.true
        expect(manager.getStatus()).to.include({ state: 'disabled', reason: 'server stopped' })
        expect(Logger.error.called).to.be.false
      })

      it('should not start a new responder when stop() is called while a change tears down the old one', async () => {
        const manager = await startManager()
        await clock.tickAsync(0)
        services[0].destroy = sinon.spy(slowGoodbye)

        settings.mdnsName = 'School'
        const applied = manager.apply()
        await clock.tickAsync(10)
        const stopped = manager.stop()
        await clock.tickAsync(100)
        await Promise.all([applied, stopped])

        expect(ciao.getResponder.calledOnce).to.be.true
        expect(services).to.have.lengthOf(1)
        expect(manager.getStatus()).to.include({ state: 'disabled', reason: 'server stopped' })
        expect(clock.countTimers()).to.equal(0)
      })

      it('should advertise again after stop() and init()', async () => {
        const manager = await startManager()
        await manager.stop()
        await manager.init({ port: 13378 })
        await clock.tickAsync(0)

        expect(services).to.have.lengthOf(2)
        expect(manager.getStatus().state).to.equal('advertising')
      })

      it('should leave no timers behind after stop()', async () => {
        onCreateService((service) => {
          // still probing: watchdog and conflict check are running
          service.advertise = sinon.spy(hang)
        })
        const manager = await startManager()
        services[0].simulateConflict({ name: true, hostname: false })
        await clock.tickAsync(200)
        expect(services).to.have.lengthOf(2)
        expect(clock.countTimers()).to.be.greaterThan(0)

        await manager.stop()
        expect(clock.countTimers()).to.equal(0)
      })

      it('should leave no timers behind when stopped while waiting to retry', async () => {
        ciao.getResponder.throws(new Error('no sockets'))
        const manager = await startManager()
        await clock.tickAsync(0)
        expect(manager.getStatus().state).to.equal('retrying')

        await manager.stop()
        expect(clock.countTimers()).to.equal(0)
        await clock.tickAsync(60000)
        expect(ciao.getResponder.calledOnce).to.be.true
      })

      it('should finish stop() within the shutdown timeout even if a queued task hangs', async () => {
        const manager = await startManager()
        manager.enqueue(hang)

        let stopped = false
        manager.stop().then(() => (stopped = true))
        await clock.tickAsync(SHUTDOWN_TIMEOUT - 1)
        expect(stopped).to.be.false
        await clock.tickAsync(1)
        expect(stopped).to.be.true
        expect(Logger.warn.calledWithMatch('did not finish within 5s, continuing shutdown')).to.be.true
      })

      it('should close the sockets of a responder whose shutdown hangs', async () => {
        const manager = await startManager()
        // ciao internals: Responder.server is its MDNSServer
        responder.server = { closed: false, shutdown: sinon.spy() }
        responder.shutdown = sinon.spy(hang)
        settings.mdnsName = 'School'
        const applied = manager.apply()
        await clock.tickAsync(3000)
        await applied

        expect(responder.server.shutdown.calledOnce).to.be.true
        expect(Logger.warn.calledWithMatch('Closed the sockets of the previous mDNS responder')).to.be.true
      })

      it('should warn when a hung responder can not be closed', async () => {
        const manager = await startManager()
        responder.shutdown = sinon.spy(hang)
        const stopped = manager.stop()
        await clock.tickAsync(3000)
        await stopped

        expect(Logger.warn.calledWithMatch('its old name may still be answered')).to.be.true
      })
    })
  })
})
