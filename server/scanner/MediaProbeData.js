const AudioMetaTags = require('../objects/metadata/AudioMetaTags')

class MediaProbeData {
  constructor(probeData) {
    this.embeddedCoverArt = null
    this.format = null
    this.duration = null
    this.size = null

    this.audioStream = null
    this.videoStream = null

    this.bitRate = null
    this.codec = null
    this.timeBase = null
    this.language = null
    this.channelLayout = null
    this.channels = null
    this.sampleRate = null
    this.chapters = []

    this.audioMetaTags = null

    this.trackNumber = null
    this.trackTotal = null

    this.discNumber = null
    this.discTotal = null

    if (probeData) {
      this.construct(probeData)
    }
  }

  construct(probeData) {
    for (const key in probeData) {
      if (key === 'audioMetaTags' && probeData[key]) {
        this[key] = new AudioMetaTags(probeData[key])
      } else if (this[key] !== undefined) {
        this[key] = probeData[key]
      }
    }
  }

  setData(data) {
    this.embeddedCoverArt = data.video_stream?.codec || null
    this.format = data.format
    this.duration = data.duration
    this.size = data.size

    this.audioStream = data.audio_stream
    this.videoStream = this.embeddedCoverArt ? null : data.video_stream || null

    this.bitRate = this.audioStream.bit_rate || data.bit_rate
    this.codec = this.audioStream.codec
    this.timeBase = this.audioStream.time_base
    this.language = this.audioStream.language
    this.channelLayout = this.audioStream.channel_layout
    this.channels = this.audioStream.channels
    this.sampleRate = this.audioStream.sample_rate
    this.chapters = data.chapters || []

    this.audioMetaTags = new AudioMetaTags()
    this.audioMetaTags.setData(data.tags)
  }
}
module.exports = MediaProbeData
