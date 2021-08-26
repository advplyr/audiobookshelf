const Path = require('path')
const Logger = require('../Logger')
const prober = require('./prober')
const AudioFile = require('../AudioFile')


function getDefaultAudioStream(audioStreams) {
  if (audioStreams.length === 1) return audioStreams[0]
  var defaultStream = audioStreams.find(a => a.is_default)
  if (!defaultStream) return audioStreams[0]
  return defaultStream
}

async function scan(path) {
  var probeData = await prober(path)
  if (!probeData || !probeData.audio_streams || !probeData.audio_streams.length) {
    return {
      error: 'Invalid audio file'
    }
  }
  if (!probeData.duration || !probeData.size) {
    return {
      error: 'Invalid duration or size'
    }
  }
  var audioStream = getDefaultAudioStream(probeData.audio_streams)

  const finalData = {
    format: probeData.format,
    duration: probeData.duration,
    size: probeData.size,
    bit_rate: audioStream.bit_rate || probeData.bit_rate,
    codec: audioStream.codec,
    time_base: audioStream.time_base,
    language: audioStream.language,
    channel_layout: audioStream.channel_layout,
    channels: audioStream.channels,
    sample_rate: audioStream.sample_rate
  }

  for (const key in probeData) {
    if (probeData[key] && key.startsWith('file_tag')) {
      finalData[key] = probeData[key]
    }
  }

  if (finalData.file_tag_track) {
    var track = finalData.file_tag_track
    var trackParts = track.split('/').map(part => Number(part))
    if (trackParts.length > 0) {
      finalData.trackNumber = trackParts[0]
    }
    if (trackParts.length > 1) {
      finalData.trackTotal = trackParts[1]
    }
  }

  return finalData
}
module.exports.scan = scan


function isNumber(val) {
  return !isNaN(val) && val !== null
}

function getTrackNumberFromMeta(scanData) {
  return !isNaN(scanData.trackNumber) && scanData.trackNumber !== null ? Number(scanData.trackNumber) : null
}

function getTrackNumberFromFilename(filename) {
  var partbasename = Path.basename(filename, Path.extname(filename))
  var numbersinpath = partbasename.match(/\d+/g)
  if (!numbersinpath) return null

  var number = numbersinpath.length ? parseInt(numbersinpath[0]) : null
  return number
}

async function scanAudioFiles(audiobook, newAudioFiles) {
  if (!newAudioFiles || !newAudioFiles.length) {
    Logger.error('[AudioFileScanner] Scan Audio Files no files', audiobook.title)
    return
  }
  var tracks = []
  for (let i = 0; i < newAudioFiles.length; i++) {
    var audioFile = newAudioFiles[i]

    var scanData = await scan(audioFile.fullPath)
    if (!scanData || scanData.error) {
      Logger.error('[AudioFileScanner] Scan failed for', audioFile.path)
      // audiobook.invalidAudioFiles.push(parts[i])
      continue;
    }

    var trackNumFromMeta = getTrackNumberFromMeta(scanData)
    var trackNumFromFilename = getTrackNumberFromFilename(audioFile.filename)

    var audioFileObj = {
      ino: audioFile.ino,
      filename: audioFile.filename,
      path: audioFile.path,
      fullPath: audioFile.fullPath,
      ext: audioFile.ext,
      ...scanData,
      trackNumFromMeta,
      trackNumFromFilename
    }
    var audioFile = audiobook.addAudioFile(audioFileObj)

    var trackNumber = 1
    if (newAudioFiles.length > 1) {
      trackNumber = isNumber(trackNumFromMeta) ? trackNumFromMeta : trackNumFromFilename
      if (trackNumber === null) {
        Logger.error('[AudioFileScanner] Invalid track number for', audioFile.filename)
        audioFile.invalid = true
        audioFile.error = 'Failed to get track number'
        continue;
      }
    }

    if (tracks.find(t => t.index === trackNumber)) {
      Logger.error('[AudioFileScanner] Duplicate track number for', audioFile.filename)
      audioFile.invalid = true
      audioFile.error = 'Duplicate track number'
      continue;
    }

    audioFile.index = trackNumber
    tracks.push(audioFile)
  }

  if (!tracks.length) {
    Logger.warn('[AudioFileScanner] No Tracks for audiobook', audiobook.id)
    return
  }

  tracks.sort((a, b) => a.index - b.index)
  audiobook.audioFiles.sort((a, b) => {
    var aNum = isNumber(a.trackNumFromMeta) ? a.trackNumFromMeta : isNumber(a.trackNumFromFilename) ? a.trackNumFromFilename : 0
    var bNum = isNumber(b.trackNumFromMeta) ? b.trackNumFromMeta : isNumber(b.trackNumFromFilename) ? b.trackNumFromFilename : 0
    return aNum - bNum
  })

  // If first index is 0, increment all by 1
  if (tracks[0].index === 0) {
    tracks = tracks.map(t => {
      t.index += 1
      return t
    })
  }

  var hasTracksAlready = audiobook.tracks.length
  tracks.forEach((track) => {
    audiobook.addTrack(track)
  })
  if (hasTracksAlready) {
    audiobook.tracks.sort((a, b) => a.index - b.index)
  }
}
module.exports.scanAudioFiles = scanAudioFiles