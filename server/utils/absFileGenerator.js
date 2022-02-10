const fs = require('fs-extra')
const filePerms = require('./filePerms')
const package = require('../../package.json')
const Logger = require('../Logger')

const bookKeyMap = {
  title: 'title',
  subtitle: 'subtitle',
  author: 'authorFL',
  narrator: 'narratorFL',
  series: 'series',
  volumeNumber: 'volumeNumber',
  publishYear: 'publishYear',
  publisher: 'publisher',
  description: 'description',
  isbn: 'isbn',
  asin: 'asin',
  language: 'language',
  genres: 'genresCommaSeparated'
}

function generate(audiobook, outputPath, uid, gid) {
  var fileString = `[audiobookshelf v${package.version}]\n`

  for (const key in bookKeyMap) {
    const value = audiobook.book[bookKeyMap[key]] || ''
    fileString += `${key}=${value}\n`
  }

  return fs.writeFile(outputPath, fileString).then(() => {
    return filePerms(outputPath, 0o774, uid, gid).then(() => true)
  }).catch((error) => {
    Logger.error(`[absMetaFileGenerator] Failed to save abs file`, error)
    return false
  })
}
module.exports.generate = generate