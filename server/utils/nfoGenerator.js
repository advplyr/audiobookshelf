const fs = require('fs-extra')
const Path = require('path')
const { bytesPretty } = require('./fileUtils')
const Logger = require('../Logger')

const LEFT_COL_LEN = 25

function sectionHeaderLines(title) {
  return [title, ''.padEnd(10, '=')]
}

function generateSection(sectionTitle, sectionData) {
  var lines = sectionHeaderLines(sectionTitle)
  for (const key in sectionData) {
    var line = key.padEnd(LEFT_COL_LEN) + (sectionData[key] || '')
    lines.push(line)
  }
  return lines
}

async function generate(audiobook, nfoFilename = 'metadata.nfo') {
  var jsonObj = audiobook.toJSON()
  var book = jsonObj.book

  var generalSectionData = {
    'Title': book.title,
    'Subtitle': book.subtitle,
    'Author': book.author,
    'Narrator': book.narrator,
    'Series': book.series,
    'Volume Number': book.volumeNumber,
    'Publish Year': book.publishYear,
    'Genre': book.genres ? book.genres.join(', ') : '',
    'Duration': audiobook.durationPretty,
    'Chapters': jsonObj.chapters.length
  }

  if (!book.subtitle) {
    delete generalSectionData['Subtitle']
  }

  if (!book.series) {
    delete generalSectionData['Series']
    delete generalSectionData['Volume Number']
  }

  var tracks = audiobook.tracks
  var audioTrack = tracks.length ? audiobook.tracks[0] : {}

  var totalBitrate = 0
  var numBitrates = 0
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].bitRate) {
      totalBitrate += tracks[i].bitRate
      numBitrates++
    }
  }
  var averageBitrate = numBitrates ? totalBitrate / numBitrates : 0

  var mediaSectionData = {
    'Tracks': jsonObj.tracks.length,
    'Size': audiobook.sizePretty,
    'Codec': audioTrack.codec,
    'Ext': audioTrack.ext,
    'Channels': audioTrack.channels,
    'Channel Layout': audioTrack.channelLayout,
    'Average Bitrate': bytesPretty(averageBitrate)
  }

  var bookSection = generateSection('Book Info', generalSectionData)

  var descriptionSection = null
  if (book.description) {
    descriptionSection = sectionHeaderLines('Book Description')
    descriptionSection.push(book.description)
  }

  var mediaSection = generateSection('Media Info', mediaSectionData)

  var fullFile = bookSection.join('\n') + '\n\n'
  if (descriptionSection) fullFile += descriptionSection.join('\n') + '\n\n'
  fullFile += mediaSection.join('\n')

  var nfoPath = Path.join(audiobook.fullPath, nfoFilename)
  var relativePath = Path.join(audiobook.path, nfoFilename)
  return fs.writeFile(nfoPath, fullFile).then(() => relativePath).catch((error) => {
    Logger.error(`Failed to write nfo file ${error}`)
    return false
  })
}
module.exports = generate