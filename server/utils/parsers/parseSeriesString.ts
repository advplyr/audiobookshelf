/**
 * Parse a series string into a name and sequence
 *
 * @example
 * Name #1a => { name: 'Name', sequence: '1a' }
 * Name #1 => { name: 'Name', sequence: '1' }
 *
 * @param {string} seriesString
 * @returns {{name: string, sequence: string}|null}
 */
module.exports.parse = (seriesString) => {
  if (!seriesString || typeof seriesString !== 'string') return null

  let sequence = null
  let name = seriesString
  // Series sequence match any characters after " #" other than whitespace and another #
  //  e.g. "Name #1a" is valid. "Name #1#a" or "Name #1 a" is not valid.
  const matchResults = seriesString.match(/ #([^#\s]+)$/) // Pull out sequence #
  if (matchResults && matchResults.length && matchResults.length > 1) {
    sequence = matchResults[1] // Group 1
    name = seriesString.replace(matchResults[0], '')
  }
  return {
    name,
    sequence
  }
}
