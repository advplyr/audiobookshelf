const DEFAULT_REQUEST_TIMEOUT_SECONDS = 300
const DEFAULT_UPGRADE_TIMEOUT_MS = 300000

/**
 * Parse a SERVER_REQUEST_TIMEOUT env var value (seconds).
 * Unset or empty falls back to the Node default silently; a value that was set
 * but is not a plain non-negative decimal number returns null so the caller can warn.
 *
 * @param {string|undefined} value raw env var value
 * @returns {number|null} request timeout in seconds, or null when the value was set but is invalid
 */
function parseServerRequestTimeout(value) {
  if (value === undefined || value.trim() === '') return DEFAULT_REQUEST_TIMEOUT_SECONDS
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  return Number(trimmed)
}

/**
 * Apply the configured request timeout (in seconds) to a Node HTTP server.
 *
 * Node 18+ applies a default 300 second `requestTimeout` to the entire request
 * including the body, so slower large uploads get their socket destroyed after
 * 5 minutes (https://github.com/advplyr/audiobookshelf/issues/5501).
 * The server is left untouched when the value matches its current
 * `requestTimeout` (i.e. the Node default), so unset env vars do not change
 * behavior at all.
 *
 * - `0` disables the request timeout entirely.
 * - When raised, `headersTimeout` (Node default 60s) and `upgradeTimeout`
 *   (Node default 300s) are raised alongside so the header and
 *   websocket-upgrade phases cannot expire before the request phase can.
 *
 * @param {import('http').Server} server the Node HTTP server to configure
 * @param {number} seconds request timeout in seconds (must be a non-negative number)
 * @returns {number|null} the applied request timeout in milliseconds, or null when the server was left untouched
 */
function applyServerTimeouts(server, seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return null
  }
  const ms = Math.round(seconds * 1000)
  if (ms === server.requestTimeout) {
    // Node default (or an explicitly matching value): nothing to do
    return null
  }
  server.requestTimeout = ms
  if (ms > 0) {
    if (server.headersTimeout > 0 && server.headersTimeout < ms) {
      server.headersTimeout = ms
    }
    // The `upgradeTimeout` getter returns undefined while unset (Node uses its internal default)
    const upgradeTimeout = server.upgradeTimeout === undefined ? DEFAULT_UPGRADE_TIMEOUT_MS : server.upgradeTimeout
    if (upgradeTimeout < ms) {
      server.upgradeTimeout = ms
    }
  }
  return ms
}

module.exports = {
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
  applyServerTimeouts,
  parseServerRequestTimeout
}
