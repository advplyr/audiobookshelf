const fs = require('fs-extra')

function getPlaylistStr(segmentName, duration, segmentLength) {
  var lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-ALLOW-CACHE:NO',
    '#EXT-X-TARGETDURATION:6',
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD'
  ]
  var numSegments = Math.floor(duration / segmentLength)
  var lastSegment = duration - (numSegments * segmentLength)
  for (let i = 0; i < numSegments; i++) {
    lines.push(`#EXTINF:6,`)
    lines.push(`${segmentName}-${i}.ts`)
  }
  if (lastSegment > 0) {
    lines.push(`#EXTINF:${lastSegment},`)
    lines.push(`${segmentName}-${numSegments}.ts`)
  }
  lines.push('#EXT-X-ENDLIST')
  return lines.join('\n')
}

function generatePlaylist(outputPath, segmentName, duration, segmentLength) {
  var playlistStr = getPlaylistStr(segmentName, duration, segmentLength)
  return fs.writeFile(outputPath, playlistStr)
}
module.exports = generatePlaylist