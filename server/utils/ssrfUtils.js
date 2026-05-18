const ssrfFilter = require('ssrf-req-filter')

function getUrlWithProtocol(url, protocol) {
  const parsedUrl = new URL(url)
  parsedUrl.protocol = protocol
  return parsedUrl.toString()
}

/**
 * Creates protocol-specific SSRF filtering agents for clients that may follow
 * redirects across HTTP and HTTPS.
 *
 * @param {string} url
 * @returns {{httpAgent: import('http').Agent|null, httpsAgent: import('https').Agent|null}}
 */
function getSsrfRequestFilterAgents(url) {
  if (global.DisableSsrfRequestFilter?.(url)) {
    return {
      httpAgent: null,
      httpsAgent: null
    }
  }

  return {
    httpAgent: ssrfFilter(getUrlWithProtocol(url, 'http:')),
    httpsAgent: ssrfFilter(getUrlWithProtocol(url, 'https:'))
  }
}
module.exports.getSsrfRequestFilterAgents = getSsrfRequestFilterAgents
