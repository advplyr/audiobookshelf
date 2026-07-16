/**
 * Whether the request was made over HTTPS.
 * Uses Express `req.secure` and a strict `x-forwarded-proto === 'https'` check.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isRequestSecure(req) {
  return req.secure || req.get('x-forwarded-proto') === 'https'
}

/**
 * @param {import('express').Request} req
 * @returns {'https' | 'http'}
 */
function getRequestProtocol(req) {
  return isRequestSecure(req) ? 'https' : 'http'
}

/**
 * @param {import('express').Request} req
 * @returns {{ protocol: 'https' | 'http', host: string, origin: string }}
 */
function getRequestOrigin(req) {
  const protocol = getRequestProtocol(req)
  const host = req.get('host')
  return { protocol, host, origin: `${protocol}://${host}` }
}

module.exports = {
  isRequestSecure,
  getRequestProtocol,
  getRequestOrigin
}
