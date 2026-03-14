function encodeBrowseCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeBrowseCursor(cursor) {
  const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))

  if (!Array.isArray(decoded.keys) || !Array.isArray(decoded.values) || decoded.keys.length !== decoded.values.length) {
    throw new Error('Cursor is missing the full ordered key set')
  }

  if (!decoded.keys.length || decoded.keys[decoded.keys.length - 1] !== 'id') {
    throw new Error('Cursor is missing the tie-breaker value')
  }

  return decoded
}

module.exports = {
  encodeBrowseCursor,
  decodeBrowseCursor
}
