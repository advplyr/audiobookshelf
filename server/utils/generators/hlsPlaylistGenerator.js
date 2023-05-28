const fs = require('../../libs/fsExtra')

function getPlaylistStr(segmentName, duration, segmentLength, hlsSegmentType, token) {
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
    lines.push(`${segmentName}-${i}.${ext}?token=${token}`)
  }
  if (lastSegment > 0) {
    lines.push(`#EXTINF:${lastSegment},`)
    lines.push(`${segmentName}-${numSegments}.${ext}?token=${token}`)
  }
  lines.push('#EXT-X-ENDLIST')
  return lines.join('\n')
}

function generatePlaylist(outputPath, segmentName, duration, segmentLength, hlsSegmentType, token) {
  var playlistStr = getPlaylistStr(segmentName, duration, segmentLength, hlsSegmentType, token)
  return fs.writeFile(outputPath, playlistStr)
}
module.exports = generatePlaylist