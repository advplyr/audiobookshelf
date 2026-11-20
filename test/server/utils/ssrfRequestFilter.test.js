const chai = require('chai')
const { expect } = chai

const { isAllowedAddress } = require('../../../server/utils/ssrfRequestFilter')

describe('ssrfRequestFilter', () => {
  describe('isAllowedAddress', () => {
    it('allows public IPv4 unicast addresses', () => {
      expect(isAllowedAddress('151.101.194.133')).to.equal(true)
      expect(isAllowedAddress('8.8.8.8')).to.equal(true)
    })

    it('blocks private, loopback, and link-local IPv4 addresses', () => {
      expect(isAllowedAddress('10.0.0.1')).to.equal(false)
      expect(isAllowedAddress('192.168.1.1')).to.equal(false)
      expect(isAllowedAddress('127.0.0.1')).to.equal(false)
      expect(isAllowedAddress('169.254.1.1')).to.equal(false)
    })

    it('allows public IPv6 unicast addresses', () => {
      expect(isAllowedAddress('2606:4700:4700::1111')).to.equal(true)
    })

    it('blocks non-unicast IPv6 ranges (loopback, link-local, unique local)', () => {
      expect(isAllowedAddress('::1')).to.equal(false)
      expect(isAllowedAddress('fe80::1')).to.equal(false)
      expect(isAllowedAddress('fc00::1')).to.equal(false)
    })

    it('allows NAT64 (RFC 6052) addresses that embed a public IPv4', () => {
      // 64:ff9b::9765:c285 embeds 151.101.194.133 (from #5288)
      expect(isAllowedAddress('64:ff9b::9765:c285')).to.equal(true)
      // 64:ff9b::12ef:b75f embeds 18.239.183.95 (from #3840)
      expect(isAllowedAddress('64:ff9b::12ef:b75f')).to.equal(true)
    })

    it('blocks NAT64 addresses that embed a private or loopback IPv4', () => {
      // 64:ff9b::c0a8:1 embeds 192.168.0.1
      expect(isAllowedAddress('64:ff9b::c0a8:1')).to.equal(false)
      // 64:ff9b::a00:1 embeds 10.0.0.1
      expect(isAllowedAddress('64:ff9b::a00:1')).to.equal(false)
      // 64:ff9b::7f00:1 embeds 127.0.0.1
      expect(isAllowedAddress('64:ff9b::7f00:1')).to.equal(false)
    })

    it('allows IPv4-mapped IPv6 addresses that embed a public IPv4', () => {
      expect(isAllowedAddress('::ffff:151.101.194.133')).to.equal(true)
      expect(isAllowedAddress('::ffff:8.8.8.8')).to.equal(true)
    })

    it('blocks IPv4-mapped IPv6 addresses that embed a private IPv4', () => {
      expect(isAllowedAddress('::ffff:10.0.0.1')).to.equal(false)
      expect(isAllowedAddress('::ffff:192.168.1.1')).to.equal(false)
      expect(isAllowedAddress('::ffff:127.0.0.1')).to.equal(false)
    })

    it('allows hostnames (checked again after DNS lookup)', () => {
      expect(isAllowedAddress('anchor.fm')).to.equal(true)
      expect(isAllowedAddress('example.com')).to.equal(true)
    })
  })
})
