import fsExtra from '../../libs/fsExtra'

// writeFile is assigned in a loop in libs/fsExtra/fs/index.js, so it is absent from the inferred type.
type FsWriteFile = (file: string, data: string) => Promise<void>
const fs = fsExtra as typeof fsExtra & { writeFile: FsWriteFile }

function getPlaylistStr(segmentName: string, duration: number, segmentLength: number, hlsSegmentType: string): string {
  const ext = hlsSegmentType === 'fmp4' ? 'm4s' : 'ts'

  const lines = [
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
  const numSegments = Math.floor(duration / segmentLength)
  const lastSegment = duration - (numSegments * segmentLength)
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

function generatePlaylist(outputPath: string, segmentName: string, duration: number, segmentLength: number, hlsSegmentType: string): Promise<void> {
  const playlistStr = getPlaylistStr(segmentName, duration, segmentLength, hlsSegmentType)
  return fs.writeFile(outputPath, playlistStr)
}

export = generatePlaylist
