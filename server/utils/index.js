const Path = require('path')
const fs = require('fs')
const Logger = require('../Logger')
const { parseString } = require("xml2js")

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

module.exports.getIno = (path) => {
  return fs.promises.stat(path, { bigint: true }).then((data => String(data.ino))).catch((err) => {
    Logger.error('[Utils] Failed to get ino for path', path, err)
    return null
  })
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
        if (typeof results.package.metadata[0].meta != "undefined") {
          results.package.metadata[0].meta = {}
          for(var match of xml.matchAll(/<meta name="(?<name>.+)" content="(?<content>.+)"\/>/g)) {
            results.package.metadata[0].meta[match.groups['name']] = [match.groups['content']]
          }
        }
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

function secondsToTimestamp(seconds, includeMs = false) {
  var _seconds = seconds
  var _minutes = Math.floor(seconds / 60)
  _seconds -= _minutes * 60
  var _hours = Math.floor(_minutes / 60)
  _minutes -= _hours * 60

  var ms = _seconds - Math.floor(seconds)
  _seconds = Math.floor(_seconds)

  var msString = '.' + (includeMs ? ms.toFixed(3) : '0.0').split('.')[1]
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}${msString}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}${msString}`
}
module.exports.secondsToTimestamp = secondsToTimestamp

module.exports.msToTimestamp = (ms, includeMs) => secondsToTimestamp(ms / 1000, includeMs)