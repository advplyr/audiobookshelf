/**
 * SSRF request filter — http(s) agent wrapper that blocks outbound requests
 * to non-public addresses, with NAT64 (RFC 6052) support.
 *
 * The agent-wrapping approach (createConnection override + post-DNS 'lookup'
 * check + double-wrap guard) is adapted from the `ssrf-req-filter` package:
 *   https://github.com/y-mehta/ssrf-req-filter
 *   Copyright (c) Yash Mehta, MIT License
 * Replaced here (rather than depended on) because the package does not expose
 * a way to customize the address check, which is needed to allow NAT64
 * addresses that embed a public IPv4 (see isAllowedAddress below).
 */
const http = require('http')
const https = require('https')
const ipaddr = require('ipaddr.js')

/**
 * Whether an IP address is allowed for outbound server-side requests.
 * Hostnames (not valid IPs) are allowed here; the real address is checked again after DNS lookup.
 *
 * NAT64 well-known prefix addresses (RFC 6052, 64:ff9b::/96) are synthetic IPv6 that embed an
 * IPv4 address. Rejecting them wholesale breaks DNS64/NAT64 networks when a podcast host is
 * IPv4-only. Instead, extract the embedded IPv4 and apply the same private/reserved checks to it.
 * IPv4-mapped IPv6 (::ffff:x.x.x.x) is handled the same way for consistency.
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isAllowedAddress(ip) {
  if (!ipaddr.isValid(ip)) {
    return true
  }
  try {
    const addr = ipaddr.parse(ip)
    const range = addr.range()

    // NAT64 well-known prefix (RFC 6052): last 32 bits are the embedded IPv4
    if (range === 'rfc6052') {
      const embedded = ipaddr.fromByteArray(addr.toByteArray().slice(12))
      return embedded.range() === 'unicast'
    }

    // IPv4-mapped IPv6 (::ffff:a.b.c.d)
    if (range === 'ipv4Mapped') {
      return addr.toIPv4Address().range() === 'unicast'
    }

    return range === 'unicast'
  } catch (err) {
    return false
  }
}

// Prevent double-wrapping the same agent (memory leak / stacked handlers)
const ACTIVE = Symbol('ssrfRequestFilterActive')

/**
 * Wrap an http(s).Agent so connections to non-public addresses are blocked.
 *
 * @param {http.Agent|https.Agent} agent
 * @returns {http.Agent|https.Agent}
 */
function requestFilterHandler(agent) {
  if (agent[ACTIVE]) return agent
  agent[ACTIVE] = true
  const { createConnection } = agent
  agent.createConnection = function (options, func) {
    const { host: address } = options
    if (!isAllowedAddress(address)) {
      throw new Error(`Call to ${address} is blocked.`)
    }
    const socket = createConnection.call(this, options, func)
    socket.on('lookup', (error, lookedUpAddress) => {
      if (error || isAllowedAddress(lookedUpAddress)) {
        return false
      }
      return socket.destroy(new Error(`Call to ${lookedUpAddress} is blocked.`))
    })
    return socket
  }
  return agent
}

/**
 * Create an SSRF-filtering agent for the given URL's protocol.
 * Drop-in replacement for the `ssrf-req-filter` package with NAT64 support.
 *
 * @param {string} url
 * @returns {http.Agent|https.Agent}
 */
function ssrfRequestFilter(url) {
  const agent = url.startsWith('https') ? new https.Agent() : new http.Agent()
  return requestFilterHandler(agent)
}

module.exports = ssrfRequestFilter
module.exports.requestFilterHandler = requestFilterHandler
module.exports.isAllowedAddress = isAllowedAddress
