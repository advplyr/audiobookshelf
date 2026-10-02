const fs = require('../../libs/fsExtra')

function getPlaylistStr(segmentName, duration, segmentLength, hlsSegmentType) {
  var ext = hlsSegmentType === 'fmp4' ? 'm4s' : 'ts'

  var lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-ALLOW-CACHE:NO',
    '#EXT-X-TARGETDURATION:6',
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD'
  ]
  if (hlsSegmentType === 'fmp4') {
    lines.push('#EXT-X-MAP:URI="init.mp4"')
  }
  var numSegments = Math.floor(duration / segmentLength)
  var lastSegment = duration - (numSegments * segmentLength)
  for (let i = 0; i < numSegments; i++) {
    lines.push(`#EXTINF:6,`)
    lines.push(`${segmentName}-${i}.${ext}`)
  }
  if (lastSegment > 0) {
    lines.push(`#EXTINF:${lastSegment},`)
    lines.push(`${segmentName}-${numSegments}.${ext}`)
  }
  lines.push('#EXT-X-ENDLIST')
  return lines.join('\n')
}

function generatePlaylist(outputPath, segmentName, duration, segmentLength, hlsSegmentType) {
  var playlistStr = getPlaylistStr(segmentName, duration, segmentLength, hlsSegmentType)
  return fs.writeFile(outputPath, playlistStr)
}
module.exports = generatePlaylist