/**
 * Parse a date string with multiple fallback formats
 *
 * @example
 * parse('2024-01-15') => Date object for Jan 15, 2024
 * parse('20240325')   => Date object for Mar 25, 2024
 * parse('250312')     => Date object for Mar 12, 2025 (year <= 50 as 20xx)
 * parse('750312')     => Date object for Mar 12, 1975 (year > 50 as 19xx)
 *
 * @param {string} dateString The date string to parse
 * @returns {Date|null} Date object or null if unparseable
 */
function parseDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null

  const date = new Date(dateString)
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    if (year >= 0 && year <= 9999) {
      return date
    }
  }

  const yyyymmddMatch = dateString.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch
    const monthNum = parseInt(month)
    const dayNum = parseInt(day)
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const parsedDate = new Date(parseInt(year), monthNum - 1, dayNum)
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate
      }
    }
  }

  const yymmddMatch = dateString.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (yymmddMatch) {
    const [, year, month, day] = yymmddMatch
    const monthNum = parseInt(month)
    const dayNum = parseInt(day)
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const fullYear = parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year)
      const parsedDate = new Date(fullYear, monthNum - 1, dayNum)
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate
      }
    }
  }

  return null
}

module.exports.parse = parseDate
