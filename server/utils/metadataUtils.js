/**
 * Normalize ISO-style published dates to the book metadata year format.
 *
 * @param {*} value
 * @returns {*}
 */
function normalizePublishedYear(value) {
  if (typeof value !== 'string') return value

  const match = value.match(/^(\d{4})(?:-|$)/)
  return match ? match[1] : value
}

module.exports = { normalizePublishedYear }
