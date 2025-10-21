const Path = require('path')
const uuid = require('uuid')
const Logger = require('../Logger')
const { parseString } = require('xml2js')
const areEquivalent = require('./areEquivalent')

const levenshteinDistance = (str1, str2, caseSensitive = false) => {
  str1 = String(str1)
  str2 = String(str2)
  if (!caseSensitive) {
    str1 = str1.toLowerCase()
    str2 = str2.toLowerCase()
  }
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null))
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j
  }
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      )
    }
  }
  return track[str2.length][str1.length]
}
module.exports.levenshteinDistance = levenshteinDistance

const levenshteinSimilarity = (str1, str2, caseSensitive = false) => {
  const distance = levenshteinDistance(str1, str2, caseSensitive)
  const maxLength = Math.max(str1.length, str2.length)
  if (maxLength === 0) return 1
  return 1 - distance / maxLength
}
module.exports.levenshteinSimilarity = levenshteinSimilarity

module.exports.isObject = (val) => {
  return val !== null && typeof val === 'object'
}

module.exports.comparePaths = (path1, path2) => {
  return path1 === path2 || Path.normalize(path1) === Path.normalize(path2)
}

module.exports.isNullOrNaN = (num) => {
  return num === null || isNaN(num)
}

const xmlToJSON = (xml) => {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, results) => {
      if (err) {
        Logger.error(`[xmlToJSON] Error`, err)
        resolve(null)
      } else {
        resolve(results)
      }
    })
  })
}
module.exports.xmlToJSON = xmlToJSON

module.exports.getId = (prepend = '') => {
  var _id = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 8)
  if (prepend) return prepend + '_' + _id
  return _id
}

/**
 *
 * @param {number} seconds
 * @returns {string}
 */
function elapsedPretty(seconds) {
  if (seconds > 0 && seconds < 1) {
    return `${Math.floor(seconds * 1000)} ms`
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)} sec`
  }
  let minutes = Math.floor(seconds / 60)
  if (minutes < 70) {
    return `${minutes} min`
  }
  let hours = Math.floor(minutes / 60)
  minutes -= hours * 60

  let days = Math.floor(hours / 24)
  hours -= days * 24

  const timeParts = []
  if (days) {
    timeParts.push(`${days} d`)
  }
  if (hours || (days && minutes)) {
    timeParts.push(`${hours} hr`)
  }
  if (minutes) {
    timeParts.push(`${minutes} min`)
  }
  return timeParts.join(' ')
}
module.exports.elapsedPretty = elapsedPretty

function secondsToTimestamp(seconds, includeMs = false, alwaysIncludeHours = false) {
  var _seconds = seconds
  var _minutes = Math.floor(seconds / 60)
  _seconds -= _minutes * 60
  var _hours = Math.floor(_minutes / 60)
  _minutes -= _hours * 60

  var ms = _seconds - Math.floor(seconds)
  _seconds = Math.floor(_seconds)

  const msString = includeMs ? '.' + ms.toFixed(3).split('.')[1] : ''
  if (alwaysIncludeHours) {
    return `${_hours.toString().padStart(2, '0')}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}${msString}`
  }
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}${msString}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}${msString}`
}
module.exports.secondsToTimestamp = secondsToTimestamp

module.exports.reqSupportsWebp = (req) => {
  if (!req || !req.headers || !req.headers.accept) return false
  return req.headers.accept.includes('image/webp') || req.headers.accept === '*/*'
}

module.exports.areEquivalent = areEquivalent

module.exports.copyValue = (val) => {
  if (val === undefined || val === '') return null
  else if (!val) return val

  if (!this.isObject(val)) return val

  if (Array.isArray(val)) {
    return val.map(this.copyValue)
  } else {
    var final = {}
    for (const key in val) {
      final[key] = this.copyValue(val[key])
    }
    return final
  }
}

module.exports.toNumber = (val, fallback = 0) => {
  if (isNaN(val) || val === null) return fallback
  return Number(val)
}

module.exports.cleanStringForSearch = (str) => {
  if (!str) return ''
  // Remove ' . ` " ,
  return str
    .toLowerCase()
    .replace(/[\'\.\`\",]/g, '')
    .trim()
}

const getTitleParts = (title) => {
  if (!title) return ['', null]
  const prefixesToIgnore = global.ServerSettings.sortingPrefixes || []
  for (const prefix of prefixesToIgnore) {
    // e.g. for prefix "the". If title is "The Book" return "Book, The"
    if (title.toLowerCase().startsWith(`${prefix} `)) {
      return [title.substr(prefix.length + 1), `${prefix.substr(0, 1).toUpperCase() + prefix.substr(1)}`]
    }
  }
  return [title, null]
}

/**
 * Remove sortingPrefixes from title
 * @example "The Good Book" => "Good Book"
 * @param {string} title
 * @returns {string}
 */
module.exports.getTitleIgnorePrefix = (title) => {
  return getTitleParts(title)[0]
}

/**
 * Put sorting prefix at the end of title
 * @example "The Good Book" => "Good Book, The"
 * @param {string} title
 * @returns {string}
 */
module.exports.getTitlePrefixAtEnd = (title) => {
  let [sort, prefix] = getTitleParts(title)
  return prefix ? `${sort}, ${prefix}` : title
}

/**
 * Escape string used in RegExp
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 *
 * @param {string} str
 * @returns {string}
 */
module.exports.escapeRegExp = (str) => {
  if (typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Validate url string with URL class
 *
 * @param {string} rawUrl
 * @returns {string} null if invalid
 */
module.exports.validateUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  try {
    return new URL(rawUrl).toString()
  } catch (error) {
    Logger.error(`Invalid URL "${rawUrl}"`, error)
    return null
  }
}

/**
 * Check if a string is a valid UUID
 *
 * @param {string} str
 * @returns {boolean}
 */
module.exports.isUUID = (str) => {
  if (!str || typeof str !== 'string') return false
  return uuid.validate(str)
}

/**
 * Check if a string is a valid ASIN
 *
 * @param {string} str
 * @returns {boolean}
 */
module.exports.isValidASIN = (str) => {
  if (!str || typeof str !== 'string') return false
  return /^[A-Z0-9]{10}$/.test(str)
}

/**
 * Convert timestamp to seconds
 * @example "01:00:00" => 3600
 * @example "01:00" => 60
 * @example "01" => 1
 *
 * @param {string} timestamp
 * @returns {number}
 */
module.exports.timestampToSeconds = (timestamp) => {
  if (typeof timestamp !== 'string') {
    return null
  }
  const parts = timestamp.split(':').map(Number)
  if (parts.some(isNaN)) {
    return null
  } else if (parts.length === 1) {
    return parts[0]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return null
}

class ValidationError extends Error {
  constructor(paramName, message, status = 400) {
    super(`Query parameter "${paramName}" ${message}`)
    this.name = 'ValidationError'
    this.paramName = paramName
    this.status = status
  }
}
module.exports.ValidationError = ValidationError

class NotFoundError extends Error {
  constructor(message, status = 404) {
    super(message)
    this.name = 'NotFoundError'
    this.status = status
  }
}
module.exports.NotFoundError = NotFoundError

/**
 * Safely extracts a query parameter as a string, rejecting arrays to prevent type confusion
 * Express query parameters can be arrays if the same parameter appears multiple times
 * @example ?author=Smith => "Smith"
 * @example ?author=Smith&author=Jones => throws error
 *
 * @param {Object} query - Query object
 * @param {string} paramName - Parameter name
 * @param {string} defaultValue - Default value if undefined/null
 * @param {boolean} required - Whether the parameter is required
 * @param {number} maxLength - Optional maximum length (defaults to 10000 to prevent ReDoS attacks)
 * @returns {string} String value
 * @throws {ValidationError} If value is an array
 * @throws {ValidationError} If value is too long
 * @throws {ValidationError} If value is required but not provided
 */
module.exports.getQueryParamAsString = (query, paramName, defaultValue = '', required = false, maxLength = 1000) => {
  const value = query[paramName]
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(paramName, 'is required')
    }
    return defaultValue
  }
  // Explicitly reject arrays to prevent type confusion
  if (Array.isArray(value)) {
    throw new ValidationError(paramName, 'is an array')
  }
  // Reject excessively long strings to prevent ReDoS attacks
  if (typeof value === 'string' && value.length > maxLength) {
    throw new ValidationError(paramName, 'is too long')
  }
  return String(value)
}
