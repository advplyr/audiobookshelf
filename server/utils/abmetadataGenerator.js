const fs = require('fs-extra')
const filePerms = require('./filePerms')
const package = require('../../package.json')
const Logger = require('../Logger')

const bookKeyMap = {
  title: 'title',
  subtitle: 'subtitle',
  author: 'authorFL',
  narrator: 'narratorFL',
  publishYear: 'publishYear',
  publisher: 'publisher',
  description: 'description',
  isbn: 'isbn',
  asin: 'asin',
  language: 'language',
  genres: 'genresCommaSeparated'
}

function generate(audiobook, outputPath) {
  var fileString = ';ABMETADATA1\n'
  fileString += `#audiobookshelf v${package.version}\n\n`

  for (const key in bookKeyMap) {
    const value = audiobook.book[bookKeyMap[key]] || ''
    fileString += `${key}=${value}\n`
  }

  if (audiobook.chapters.length) {
    fileString += '\n'
    audiobook.chapters.forEach((chapter) => {
      fileString += `[CHAPTER]\n`
      fileString += `start=${chapter.start}\n`
      fileString += `end=${chapter.end}\n`
      fileString += `title=${chapter.title}\n`
    })
  }

  return fs.writeFile(outputPath, fileString).then(() => {
    return filePerms.setDefault(outputPath, true).then(() => true)
  }).catch((error) => {
    Logger.error(`[absMetaFileGenerator] Failed to save abs file`, error)
    return false
  })
}
module.exports.generate = generate

function parseAbMetadataText(text) {
  if (!text) return null
  var lines = text.split(/\r?\n/)

  // Check first line and get abmetadata version number
  var firstLine = lines.shift().toLowerCase()
  if (!firstLine.startsWith(';abmetadata')) {
    Logger.error(`Invalid abmetadata file first line is not ;abmetadata "${firstLine}"`)
    return null
  }
  var abmetadataVersion = Number(firstLine.replace(';abmetadata', '').trim())
  if (isNaN(abmetadataVersion)) {
    Logger.warn(`Invalid abmetadata version ${abmetadataVersion} - using 1`)
    abmetadataVersion = 1
  }

  // Remove comments and empty lines
  const ignoreFirstChars = [' ', '#', ';'] // Ignore any line starting with the following
  lines = lines.filter(line => !!line.trim() && !ignoreFirstChars.includes(line[0]))

  // Get lines that map to book details (all lines before the first chapter section)
  var firstSectionLine = lines.findIndex(l => l.startsWith('['))
  var detailLines = firstSectionLine > 0 ? lines.slice(0, firstSectionLine) : lines

  // Put valid book detail values into map
  const bookDetails = {}
  for (let i = 0; i < detailLines.length; i++) {
    var line = detailLines[i]
    var keyValue = line.split('=')
    if (keyValue.length < 2) {
      Logger.warn('abmetadata invalid line has no =', line)
    } else if (!bookKeyMap[keyValue[0].trim()]) {
      Logger.warn(`abmetadata key "${keyValue[0].trim()}" is not a valid book detail key`)
    } else {
      var key = keyValue[0].trim()
      bookDetails[key] = keyValue[1].trim()

      // Genres convert to array of strings
      if (key === 'genres') {
        bookDetails[key] = bookDetails[key] ? bookDetails[key].split(',').map(genre => genre.trim()) : []
      } else if (!bookDetails[key]) { // Use null for empty details
        bookDetails[key] = null
      }
    }
  }

  // TODO: Chapter support

  return {
    book: bookDetails
  }
}
module.exports.parse = parseAbMetadataText