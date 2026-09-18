const dns = require('dns')
const http = require('http')
const https = require('https')
const ssrfFilter = require('ssrf-req-filter')

/**
 * Drop-in replacement for dns.lookup, usable as the `lookup` option of http/https Agents.
 *
 * Tries the system resolver (getaddrinfo) first, so /etc/hosts and nsswitch keep working.
 * On EAI_AGAIN it falls back to direct DNS queries, which tolerate one address family
 * failing while the other resolves. musl-based environments (Alpine) fail the entire
 * getaddrinfo call with EAI_AGAIN when either the A or AAAA query gets a SERVFAIL,
 * even if the other family returned valid addresses.
 *
 * @param {string} hostname
 * @param {Object|Function} options dns.lookup options, or the callback
 * @param {Function} [callback]
 */
function resilientLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  dns.lookup(hostname, options, (error, address, family) => {
    if (!error || error.code !== 'EAI_AGAIN') return callback(error, address, family)

    const done = (addresses, resolvedFamily) => {
      if (options.all) {
        return callback(
          null,
          addresses.map((addr) => ({ address: addr, family: resolvedFamily })),
          resolvedFamily
        )
      }
      callback(null, addresses[0], resolvedFamily)
    }

    const familyOrder = process.env.PREFER_IPV6 === '1' ? [6, 4] : [4, 6]
    const resolveFamily = (resolvedFamily, cb) => (resolvedFamily === 4 ? dns.resolve4 : dns.resolve6)(hostname, cb)

    resolveFamily(familyOrder[0], (primaryError, primaryAddresses) => {
      if (!primaryError && primaryAddresses?.length) return done(primaryAddresses, familyOrder[0])
      resolveFamily(familyOrder[1], (secondaryError, secondaryAddresses) => {
        if (!secondaryError && secondaryAddresses?.length) return done(secondaryAddresses, familyOrder[1])
        callback(error, address, family)
      })
    })
  })
}

/**
 * Builds the httpAgent/httpsAgent pair for an outgoing request to the given url,
 * applying the SSRF request filter unless disabled for the url, and the resilient
 * DNS lookup when EXP_DNS_RESOLUTION is enabled.
 *
 * @param {string} url
 * @returns {{ httpAgent: http.Agent|null, httpsAgent: https.Agent|null }}
 */
function getAgentsForUrl(url) {
  const ssrfDisabled = !!global.DisableSsrfRequestFilter?.(url)

  if (process.env.EXP_DNS_RESOLUTION !== '1') {
    const agent = ssrfDisabled ? null : ssrfFilter(url)
    return { httpAgent: agent, httpsAgent: agent }
  }

  const httpAgent = new http.Agent({ lookup: resilientLookup })
  const httpsAgent = new https.Agent({ lookup: resilientLookup })
  if (!ssrfDisabled) {
    ssrfFilter.requestFilterHandler(httpAgent)
    ssrfFilter.requestFilterHandler(httpsAgent)
  }
  return { httpAgent, httpsAgent }
}

module.exports = { resilientLookup, getAgentsForUrl }
