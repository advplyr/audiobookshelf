const Path = require('path')
const fs = require('fs')
const Logger = require('../Logger')
const { parseString } = require("xml2js")
const areEquivalent = require('./areEquivalent')

const levenshteinDistance = (str1, str2, caseSensitive = false) => {
  if (!caseSensitive) {
    str1 = str1.toLowerCase()
    str2 = str2.toLowerCase()
  }
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  return track[str2.length][str1.length];
}
module.exports.levenshteinDistance = levenshteinDistance

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

function elapsedPretty(seconds) {
  if (seconds < 60) {
    return `${Math.floor(seconds)} sec`
  }
  var minutes = Math.floor(seconds / 60)
  if (minutes < 70) {
    return `${minutes} min`
  }
  var hours = Math.floor(minutes / 60)
  minutes -= hours * 60
  if (!minutes) {
    return `${hours} hr`
  }
  return `${hours} hr ${minutes} min`
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

  var msString = '.' + (includeMs ? ms.toFixed(3) : '0.0').split('.')[1]
  if (alwaysIncludeHours) {
    return `${_hours.toString().padStart(2, '0')}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}${msString}`
  }
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}${msString}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}${msString}`
}
module.exports.secondsToTimestamp = secondsToTimestamp

module.exports.msToTimestamp = (ms, includeMs) => secondsToTimestamp(ms / 1000, includeMs)

module.exports.reqSupportsWebp = (req) => {
  if (!req || !req.headers || !req.headers.accept) return false
  return req.headers.accept.includes('image/webp') || req.headers.accept === '*/*'
}

module.exports.areEquivalent = areEquivalent

module.exports.copyValue = (val) => {
  if (!val) return null
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

module.exports.encodeUriPath = (path) => {
  return path.replace(/\\/g, '/').replace(/%/g, '%25').replace(/#/g, '%23')
}

module.exports.toNumber = (val, fallback = 0) => {
  if (isNaN(val) || val === null) return fallback
  return Number(val)
}

module.exports.cleanStringForSearch = (str) => {
  if (!str) return ''
  // Remove ' . ` " ,
  return str.toLowerCase().replace(/[\'\.\`\",]/g, '').trim()
}

module.exports.getTitleIgnorePrefix = (title) => {
  if (!title) return ''
  var prefixesToIgnore = global.ServerSettings.sortingPrefixes || []
  for (const prefix of prefixesToIgnore) {
    // e.g. for prefix "the". If title is "The Book" return "Book, The"
    if (title.toLowerCase().startsWith(`${prefix} `)) {
      return title.substr(prefix.length + 1) + `, ${prefix.substr(0, 1).toUpperCase() + prefix.substr(1)}`
    }
  }
  return title
}