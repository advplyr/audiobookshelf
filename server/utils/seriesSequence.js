/**
 * Normalize a plain numeric series sequence without converting it to a Number.
 * @param {string|null|undefined} sequence
 * @returns {string|null|undefined}
 */
function normalizeSeriesSequence(sequence) {
  if (typeof sequence !== 'string') return sequence

  const match = /^(\d+)(?:\.(\d+))?$/.exec(sequence)
  if (!match) return sequence

  const integerPart = match[1].replace(/^0+(?=\d)/, '')
  const fractionPart = match[2]?.replace(/0+$/, '')
  return fractionPart ? `${integerPart}.${fractionPart}` : integerPart
}

/**
 * Normalize the sequence for every series metadata entry.
 * @param {{name:string, sequence:string|null|undefined}[]} series
 * @returns {{name:string, sequence:string|null|undefined}[]}
 */
function normalizeSeriesSequences(series) {
  return series.map((seriesEntry) => ({
    ...seriesEntry,
    sequence: normalizeSeriesSequence(seriesEntry.sequence)
  }))
}

module.exports = { normalizeSeriesSequence, normalizeSeriesSequences }
