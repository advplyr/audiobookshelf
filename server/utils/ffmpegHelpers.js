const fs = require('fs-extra')
const package = require('../../package.json')

function escapeSingleQuotes(path) {
  // return path.replace(/'/g, '\'\\\'\'')
  return path.replace(/\\/g, '/').replace(/ /g, '\\ ').replace(/'/g, '\\\'')
}

// Returns first track start time
// startTime is for streams starting an encode part-way through an audiobook
async function writeConcatFile(tracks, outputPath, startTime = 0) {
  var trackToStartWithIndex = 0
  var firstTrackStartTime = 0

  // Find first track greater than startTime
  if (startTime > 0) {
    var currTrackEnd = 0
    var startingTrack = tracks.find(t => {
      currTrackEnd += t.duration
      return startTime < currTrackEnd
    })
    if (startingTrack) {
      firstTrackStartTime = currTrackEnd - startingTrack.duration
      trackToStartWithIndex = startingTrack.index
    }
  }

  var tracksToInclude = tracks.filter(t => t.index >= trackToStartWithIndex)
  var trackPaths = tracksToInclude.map(t => {
    var line = 'file ' + escapeSingleQuotes(t.fullPath) + '\n' + `duration ${t.duration}`
    return line
  })
  var inputstr = trackPaths.join('\n\n')
  await fs.writeFile(outputPath, inputstr)

  return firstTrackStartTime
}
module.exports.writeConcatFile = writeConcatFile


async function writeMetadataFile(audiobook, outputPath) {
  var inputstrs = [
    ';FFMETADATA1',
    `title=${audiobook.title}`,
    `artist=${audiobook.author}`,
    `date=${audiobook.book.publishYear || ''}`,
    `comment=AudioBookshelf v${package.version}`,
    'genre=Audiobook'
  ]

  if (audiobook.chapters) {
    audiobook.chapters.forEach((chap) => {
      const chapterstrs = [
        '[CHAPTER]',
        'TIMEBASE=1/1000',
        `START=${Math.round(chap.start * 1000)}`,
        `END=${Math.round(chap.end * 1000)}`,
        `title=${chap.title}`
      ]
      inputstrs = inputstrs.concat(chapterstrs)
    })
  }

  await fs.writeFile(outputPath, inputstrs.join('\n'))
  return inputstrs
}
module.exports.writeMetadataFile = writeMetadataFile