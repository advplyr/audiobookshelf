const fs = require('fs-extra')

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