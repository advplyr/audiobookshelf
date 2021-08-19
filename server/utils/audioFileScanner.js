const Path = require('path')
const Logger = require('../Logger')
var prober = require('./prober')


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

async function scanParts(audiobook, parts) {
  if (!parts || !parts.length) {
    Logger.error('Scan Parts', audiobook.title, 'No Parts', parts)
    return
  }
  var tracks = []
  for (let i = 0; i < parts.length; i++) {
    var fullPath = Path.join(audiobook.fullPath, parts[i])

    var scanData = await scan(fullPath)
    if (!scanData || scanData.error) {
      Logger.error('Scan failed for', parts[i])
      audiobook.invalidParts.push(parts[i])
      continue;
    }

    var trackNumFromMeta = getTrackNumberFromMeta(scanData)
    var trackNumFromFilename = getTrackNumberFromFilename(parts[i])

    var audioFileObj = {
      path: Path.join(audiobook.path, parts[i]),
      ext: Path.extname(parts[i]),
      filename: parts[i],
      fullPath: fullPath,
      ...scanData,
      trackNumFromMeta,
      trackNumFromFilename
    }
    audiobook.audioFiles.push(audioFileObj)

    var trackNumber = 1
    if (parts.length > 1) {
      trackNumber = isNumber(trackNumFromMeta) ? trackNumFromMeta : trackNumFromFilename
      if (trackNumber === null) {
        Logger.error('Invalid track number for', parts[i])
        audioFileObj.invalid = true
        audioFileObj.error = 'Failed to get track number'
        continue;
      }
    }

    if (tracks.find(t => t.index === trackNumber)) {
      Logger.error('Duplicate track number for', parts[i])
      audioFileObj.invalid = true
      audioFileObj.error = 'Duplicate track number'
      continue;
    }

    audioFileObj.index = trackNumber
    tracks.push(audioFileObj)
  }

  if (!tracks.length) {
    Logger.warn('No Tracks for audiobook', audiobook.id)
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

  var parts_copy = tracks.map(p => ({ ...p }))
  var current_index = 1

  for (let i = 0; i < parts_copy.length; i++) {
    var cleaned_part = parts_copy[i]
    if (cleaned_part.index > current_index) {
      var num_parts_missing = cleaned_part.index - current_index
      for (let x = 0; x < num_parts_missing; x++) {
        audiobook.missingParts.push(current_index + x)
      }
    }
    current_index = cleaned_part.index + 1
  }

  if (audiobook.missingParts.length) {
    Logger.info('Audiobook', audiobook.title, 'Has missing parts', audiobook.missingParts)
  }

  tracks.forEach((track) => {
    audiobook.addTrack(track)
  })
}
module.exports.scanParts = scanParts