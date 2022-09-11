const tone = require('node-tone')
const MediaProbeData = require('../scanner/MediaProbeData')
const Logger = require('../Logger')

/*
Sample dump from tone
{
  "audio": {
    "bitrate": 17,
    "format": "MPEG-4 Part 14",
    "formatShort": "MPEG-4",
    "sampleRate": 44100.0,
    "duration": 209284.0,
    "channels": {
      "count": 2,
      "description": "Stereo (2/0.0)"
    },
    "frames": {
      "offset": 42168,
      "length": 446932
    "metaFormat": [
      "mp4"
    ]
  },
  "meta": {
    "album": "node-tone",
    "albumArtist": "advplyr",
    "artist": "advplyr",
    "composer": "Composer 5",
    "comment": "testing out tone metadata",
    "encodingTool": "audiobookshelf",
    "genre": "abs",
    "itunesCompilation": "no",
    "itunesMediaType": "audiobook",
    "itunesPlayGap": "noGap",
    "narrator": "Narrator 5",
    "recordingDate": "2022-09-10T00:00:00",
    "title": "Test 5",
    "trackNumber": 5,
    "chapters": [
      {
        "start": 0,
        "length": 500,
        "title": "chapter 1"
      },
      {
        "start": 500,
        "length": 500,
        "title": "chapter 2"
      },
      {
        "start": 1000,
        "length": 208284,
        "title": "chapter 3"
      }
    ],
    "embeddedPictures": [
      {
        "code": 14,
        "mimetype": "image/png",
        "data": "..."
    },
    "additionalFields": {
      "test": "Test 5"
    }
  },
  "file": {
    "size": 530793,
    "created": "2022-09-10T13:32:51.1942586-05:00",
    "modified": "2022-09-10T14:09:19.366071-05:00",
    "accessed": "2022-09-11T13:00:56.5097533-05:00",
    "path": "C:\\Users\\Coop\\Documents\\NodeProjects\\node-tone\\samples",
    "name": "m4b.m4b"
  }

*/

function bitrateKilobitToBit(bitrate) {
  if (isNaN(bitrate) || !bitrate) return 0
  return Number(bitrate) * 1000
}

function msToSeconds(ms) {
  if (isNaN(ms) || !ms) return 0
  return Number(ms) / 1000
}

function parseProbeDump(dumpPayload) {
  const audioMetadata = dumpPayload.audio
  const audioChannels = audioMetadata.channels || {}
  const audio_stream = {
    bit_rate: bitrateKilobitToBit(audioMetadata.bitrate), // tone uses Kbps but ffprobe uses bps so convert to bits
    codec: null,
    time_base: null,
    language: null,
    channel_layout: audioChannels.description || null,
    channels: audioChannels.count || null,
    sample_rate: audioMetadata.sampleRate || null
  }

  let chapterIndex = 0
  const chapters = (dumpPayload.meta.chapters || []).map(chap => {
    return {
      id: chapterIndex++,
      start: msToSeconds(chap.start),
      end: msToSeconds(chap.start + chap.length),
      title: chap.title || ''
    }
  })

  var video_stream = null
  if (dumpPayload.meta.embeddedPictures && dumpPayload.meta.embeddedPictures.length) {
    const mimetype = dumpPayload.meta.embeddedPictures[0].mimetype
    video_stream = {
      codec: mimetype === 'image/png' ? 'png' : 'jpeg'
    }
  }

  const tags = { ...dumpPayload.meta }
  delete tags.chapters
  delete tags.embeddedPictures

  const fileMetadata = dumpPayload.file
  var sizeBytes = !isNaN(fileMetadata.size) ? Number(fileMetadata.size) : null
  var sizeMb = sizeBytes !== null ? Number((sizeBytes / (1024 * 1024)).toFixed(2)) : null
  return {
    format: audioMetadata.format || 'Unknown',
    duration: msToSeconds(audioMetadata.duration),
    size: sizeBytes,
    sizeMb,
    bit_rate: audio_stream.bit_rate,
    audio_stream,
    video_stream,
    chapters,
    tags
  }
}

module.exports.probe = (filepath, verbose = false) => {
  if (process.env.TONE_PATH) {
    ffprobe.TONE_PATH = process.env.TONE_PATH
  }

  return tone.dump(filepath).then((dumpPayload) => {
    if (verbose) {
      Logger.debug(`[toneProber] dump for file "${filepath}"`, dumpPayload)
    }
    const rawProbeData = parseProbeDump(dumpPayload)
    const probeData = new MediaProbeData()
    probeData.setData(rawProbeData)
    return probeData
  }).catch((error) => {
    Logger.error(`[toneProber] Failed to probe file at path "${filepath}"`, error)
    return {
      error
    }
  })
}