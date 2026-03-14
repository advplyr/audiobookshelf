function encodeBrowseCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function invalidBrowseCursor() {
  return new Error('Invalid browse cursor')
}

function decodeBrowseCursor(cursor) {
  let decoded

  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch (error) {
    throw invalidBrowseCursor()
  }

  if (!Array.isArray(decoded.keys) || !Array.isArray(decoded.values) || decoded.keys.length !== decoded.values.length) {
    throw new Error('Cursor is missing the full ordered key set')
  }

  const tieBreakerIndex = decoded.keys.length - 1

  if (!decoded.keys.length || decoded.keys[tieBreakerIndex] !== 'id' || decoded.values[tieBreakerIndex] == null || decoded.values[tieBreakerIndex] === '') {
    throw new Error('Cursor is missing the tie-breaker value')
  }

  return decoded
}

module.exports = {
  encodeBrowseCursor,
  decodeBrowseCursor
}
