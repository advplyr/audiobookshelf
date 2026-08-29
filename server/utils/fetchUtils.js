const dns = require('node:dns')
const ipaddr = require('ipaddr.js')
const { Agent, EnvHttpProxyAgent, getGlobalDispatcher } = require('undici')

/**
 * Get the IP range classification for an address.
 *
 * IPv4-mapped IPv6 addresses are classified by their embedded IPv4 address so
 * they cannot bypass the IPv4 restrictions.
 *
 * @param {string} address
 * @returns {string|null}
 */
function getAddressRange(address) {
  if (!ipaddr.isValid(address)) return null

  const parsed = ipaddr.parse(address)
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
    return parsed.toIPv4Address().range()
  }
  return parsed.range()
}

/**
 * Check whether an address is permitted by the SSRF filter.
 *
 * Hostnames return true here and receive their definitive validation in
 * `safeLookup` after DNS resolution.
 *
 * @param {string} address
 * @returns {boolean}
 */
function isAllowedAddress(address) {
  const range = getAddressRange(address)
  return range === null || range === 'unicast'
}

/**
 * Check whether an address belongs to a range blocked by the SSRF filter.
 *
 * @param {string} address
 * @returns {boolean}
 */
function isBlockedAddress(address) {
  const range = getAddressRange(address)
  return range !== null && range !== 'unicast'
}

/**
 * Parse and validate an HTTP(S) URL.
 *
 * @param {string|URL} url
 * @returns {URL}
 */
function getUrl(url) {
  const parsedUrl = new URL(url)
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`)
  }
  return parsedUrl
}

/**
 * Resolve a hostname for an SSRF-protected connection.
 *
 * Only a public unicast address is returned to Undici, which pins validation
 * and connection establishment to the same DNS result.
 *
 * @param {string} hostname
 * @param {{ all?: boolean }} options
 * @param {Function} callback
 * @returns {void}
 */
function safeLookup(hostname, options, callback) {
  if (!isAllowedAddress(hostname)) {
    callback(new Error(`Call to ${hostname} is blocked.`))
    return
  }

  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error)

    const address = addresses.find((result) =>
      typeof result?.address === 'string' && getAddressRange(result.address) === 'unicast'
    )
    if (!address) return callback(new Error(`Call to ${hostname} is blocked.`))

    if (options.all) return callback(null, [address])
    callback(null, address.address, address.family)
  })
}

// A trusted provider may make its initial connection to any address. Record
// whether that connection resolved exclusively to blocked/local ranges so only
// genuinely local providers can carry private-network trust across redirects.
const trustedLocalHostnames = new Map()

/**
 * Resolve a hostname for an administrator-configured provider.
 *
 * @param {string} hostname
 * @param {{ all?: boolean }} options
 * @param {Function} callback
 * @returns {void}
 */
function trustedLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error)

    const validAddresses = addresses.filter((result) =>
      typeof result?.address === 'string' && ipaddr.isValid(result.address)
    )
    if (!validAddresses.length) return callback(new Error(`Unable to resolve ${hostname}.`))

    trustedLocalHostnames.set(hostname, validAddresses.every((result) => isBlockedAddress(result.address)))
    if (options.all) return callback(null, validAddresses)

    const address = validAddresses[0]
    callback(null, address.address, address.family)
  })
}

const safeDispatcher = new Agent({ connect: { lookup: safeLookup } })
const trustedDispatcher = new Agent({ connect: { lookup: trustedLookup } })
let proxyDispatcher = null

/**
 * Select the dispatcher for a request.
 *
 * Proxy mode intentionally supersedes SSRF filtering. Outside proxy mode,
 * trusted requests can reach private destinations while protected requests
 * use the DNS-pinning SSRF dispatcher.
 *
 * @param {boolean} useSsrfFilter
 * @param {boolean} [allowPrivateNetwork=false]
 * @returns {import('undici').Dispatcher}
 */
function getDispatcher(useSsrfFilter, allowPrivateNetwork = false) {
  if (process.env.EXP_PROXY_SUPPORT === '1') {
    if (!proxyDispatcher) proxyDispatcher = new EnvHttpProxyAgent()
    return proxyDispatcher
  }
  if (allowPrivateNetwork) return trustedDispatcher
  return useSsrfFilter ? safeDispatcher : getGlobalDispatcher()
}

/**
 * Fetch a response with Axios-compatible timeout behavior.
 *
 * The timer covers connection establishment and response headers. Once the
 * headers arrive, Undici applies the timeout as the maximum inactivity gap
 * between response body chunks rather than as a total transfer duration.
 *
 * @param {string|URL} url
 * @param {RequestInit} options
 * @param {number|undefined} timeout
 * @param {import('undici').Dispatcher} dispatcher
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeout, dispatcher) {
  if (!timeout) return fetch(url, { ...options, dispatcher })

  const timeoutController = new AbortController()
  const timeoutHandle = setTimeout(() => {
    timeoutController.abort(new Error(`Request timed out after ${timeout}ms`))
  }, timeout)
  timeoutHandle.unref?.()

  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal
  const timeoutDispatcher = dispatcher.compose((dispatch) => (dispatchOptions, handler) => dispatch({
    ...dispatchOptions,
    headersTimeout: timeout,
    bodyTimeout: timeout
  }, handler))

  try {
    return await fetch(url, { ...options, signal, dispatcher: timeoutDispatcher })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

/**
 * Build the request options for a redirect.
 *
 * Sensitive credentials are removed when the origin changes. Redirects that
 * conventionally switch to GET also discard their request body headers.
 *
 * @param {RequestInit} options
 * @param {number} status
 * @param {URL} currentUrl
 * @param {URL} nextUrl
 * @returns {RequestInit}
 */
function getRedirectOptions(options, status, currentUrl, nextUrl) {
  const headers = new Headers(options.headers)
  if (currentUrl.origin !== nextUrl.origin) {
    headers.delete('authorization')
    headers.delete('cookie')
  }

  const method = options.method?.toUpperCase()
  if (status !== 303 && !([301, 302].includes(status) && method === 'POST')) {
    return { ...options, headers }
  }

  headers.delete('content-length')
  headers.delete('content-type')
  return { ...options, method: 'GET', body: undefined, headers }
}

/**
 * Require a successful HTTP response.
 *
 * @param {Response} response
 * @returns {Response}
 */
function assertOk(response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response
}

/**
 * Fetch a successful response without SSRF filtering.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number }} [options]
 * @returns {Promise<Response>}
 */
async function fetchResponse(url, { timeout, ...options } = {}) {
  return assertOk(await fetchWithTimeout(url, options, timeout, getDispatcher(false)))
}

/**
 * Fetch and parse a successful JSON response without SSRF filtering.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number }} [options]
 * @returns {Promise<any>}
 */
async function fetchJson(url, options) {
  return (await fetchResponse(url, options)).json()
}

/**
 * Fetch an external URL with connection-time SSRF protection.
 *
 * Redirects are followed manually so every destination is validated. When
 * `allowPrivateNetwork` is enabled, the administrator-configured initial URL
 * is trusted, but private redirects remain trusted only if that initial
 * provider resolved exclusively to blocked/local address ranges.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number, maxRedirects?: number, allowPrivateNetwork?: boolean }} [options]
 * @returns {Promise<Response>}
 */
async function safeFetch(url, { timeout, maxRedirects = 5, signal, allowPrivateNetwork = false, ...options } = {}) {
  let currentUrl = getUrl(url)
  let currentOptions = { ...options, signal }
  const originalHostname = currentUrl.hostname.replace(/^\[|\]$/g, '')
  let originalProviderIsLocal = isBlockedAddress(originalHostname)

  for (let redirectCount = 0; ; redirectCount++) {
    const allowPrivateForRequest = allowPrivateNetwork && (redirectCount === 0 || originalProviderIsLocal)
    const bypassFilter = allowPrivateForRequest || global.DisableSsrfRequestFilter?.(currentUrl.toString())
    if (!bypassFilter) {
      const hostname = currentUrl.hostname.replace(/^\[|\]$/g, '')
      if (!isAllowedAddress(hostname)) throw new Error(`Call to ${hostname} is blocked.`)
    }

    const response = await fetchWithTimeout(currentUrl, {
      ...currentOptions,
      redirect: 'manual'
    }, timeout, getDispatcher(!bypassFilter, allowPrivateForRequest))

    if (allowPrivateNetwork && redirectCount === 0 && !originalProviderIsLocal) {
      originalProviderIsLocal = trustedLocalHostnames.get(originalHostname) === true
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    if (redirectCount >= maxRedirects) {
      await response.body?.cancel()
      throw new Error(`Too many redirects while requesting ${currentUrl}`)
    }

    const location = response.headers.get('location')
    if (!location) return response

    const nextUrl = getUrl(new URL(location, currentUrl))
    await response.body?.cancel()
    currentOptions = getRedirectOptions(currentOptions, response.status, currentUrl, nextUrl)
    currentUrl = nextUrl
  }
}

/**
 * Fetch a successful response with SSRF filtering.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number, maxRedirects?: number, allowPrivateNetwork?: boolean }} [options]
 * @returns {Promise<Response>}
 */
async function safeFetchResponse(url, options) {
  return assertOk(await safeFetch(url, options))
}

/**
 * Fetch and parse a successful JSON response with SSRF filtering.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeout?: number, maxRedirects?: number, allowPrivateNetwork?: boolean }} [options]
 * @returns {Promise<any>}
 */
async function safeFetchJson(url, options) {
  return (await safeFetchResponse(url, options)).json()
}

module.exports = { fetchJson, fetchResponse, safeFetch, safeFetchJson, safeFetchResponse }
