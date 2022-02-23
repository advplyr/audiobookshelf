import Hls from 'hls.js'
import EventEmitter from 'events'

export default class LocalPlayer extends EventEmitter {
  constructor(ctx) {
    super()

    this.ctx = ctx
    this.player = null

    this.audiobook = null
    this.audioTracks = []
    this.currentTrackIndex = 0
    this.hlsStreamId = null
    this.hlsInstance = null
    this.usingNativeplayer = false
    this.currentTime = 0
    this.playWhenReady = false
    this.defaultPlaybackRate = 1

    this.initialize()
  }

  get currentTrack() {
    return this.audioTracks[this.currentTrackIndex] || {}
  }

  initialize() {
    if (document.getElementById('audio-player')) {
      document.getElementById('audio-player').remove()
    }
    var audioEl = document.createElement('audio')
    audioEl.id = 'audio-player'
    audioEl.style.display = 'none'
    document.body.appendChild(audioEl)
    this.player = audioEl

    this.player.addEventListener('play', this.evtPlay.bind(this))
    this.player.addEventListener('pause', this.evtPause.bind(this))
    this.player.addEventListener('progress', this.evtProgress.bind(this))
    this.player.addEventListener('error', this.evtError.bind(this))
    this.player.addEventListener('loadedmetadata', this.evtLoadedMetadata.bind(this))
    this.player.addEventListener('timeupdate', this.evtTimeupdate.bind(this))
  }

  evtPlay() {
    this.emit('stateChange', 'PLAYING')
  }
  evtPause() {
    this.emit('stateChange', 'PAUSED')
  }
  evtProgress() {
    var lastBufferTime = this.getLastBufferedTime()
    this.emit('buffertimeUpdate', lastBufferTime)
  }
  evtError(error) {
    console.error('Player error', error)
  }
  evtLoadedMetadata(data) {
    console.log('Audio Loaded Metadata', data)
    this.emit('stateChange', 'LOADED')
    if (this.playWhenReady) {
      this.playWhenReady = false
      this.play()
    }
  }
  evtTimeupdate() {
    if (this.player.paused) {
      this.emit('timeupdate', this.getCurrentTime())
    }
  }

  destroy() {
    if (this.hlsStreamId) {
      // Close HLS Stream
      console.log('Closing HLS Streams', this.hlsStreamId)
      this.ctx.$axios.$post(`/api/streams/${this.hlsStreamId}/close`).catch((error) => {
        console.error('Failed to request close hls stream', this.hlsStreamId, error)
      })
    }
    this.destroyHlsInstance()
    if (this.player) {
      this.player.remove()
    }
  }

  set(audiobook, tracks, hlsStreamId, startTime, playWhenReady = false) {
    this.audiobook = audiobook
    this.audioTracks = tracks
    this.hlsStreamId = hlsStreamId
    this.playWhenReady = playWhenReady
    if (this.hlsInstance) {
      this.destroyHlsInstance()
    }

    this.currentTime = startTime

    // iOS does not support Media Elements but allows for HLS in the native audio player
    if (!Hls.isSupported()) {
      console.warn('HLS is not supported - fallback to using audio element')
      this.usingNativeplayer = true
      this.player.src = this.currentTrack.contentUrl
      this.player.currentTime = this.currentTime
      return
    }

    var hlsOptions = {
      startPosition: this.currentTime || -1
      // No longer needed because token is put in a query string
      // xhrSetup: (xhr) => {
      //   xhr.setRequestHeader('Authorization', `Bearer ${this.token}`)
      // }
    }
    this.hlsInstance = new Hls(hlsOptions)

    this.hlsInstance.attachMedia(this.player)
    this.hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
      this.hlsInstance.loadSource(this.currentTrack.contentUrl)

      this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS] Manifest Parsed')
      })

      this.hlsInstance.on(Hls.Events.ERROR, (e, data) => {
        console.error('[HLS] Error', data.type, data.details, data)
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          console.error('[HLS] BUFFER STALLED ERROR')
        }
      })
      this.hlsInstance.on(Hls.Events.DESTROYING, () => {
        console.log('[HLS] Destroying HLS Instance')
      })
    })
  }

  destroyHlsInstance() {
    if (!this.hlsInstance) return
    if (this.hlsInstance.destroy) {
      var temp = this.hlsInstance
      temp.destroy()
    }
    this.hlsInstance = null
  }

  async resetStream(startTime) {
    this.destroyHlsInstance()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    this.set(this.audiobook, this.audioTracks, this.hlsStreamId, startTime, true)
  }

  playPause() {
    if (!this.player) return
    if (this.player.paused) this.play()
    else this.pause()
  }

  play() {
    if (this.player) this.player.play()
  }

  pause() {
    if (this.player) this.player.pause()
  }

  getCurrentTime() {
    var currentTrackOffset = this.currentTrack.startOffset || 0
    return this.player ? currentTrackOffset + this.player.currentTime : 0
  }

  getDuration() {
    if (!this.audioTracks.length) return 0
    var lastTrack = this.audioTracks[this.audioTracks.length - 1]
    return lastTrack.startOffset + lastTrack.duration
  }

  setPlaybackRate(playbackRate) {
    if (!this.player) return
    this.defaultPlaybackRate = playbackRate
    this.player.playbackRate = playbackRate
  }

  seek(time) {
    if (!this.player) return
    var offsetTime = time - (this.currentTrack.startOffset || 0)
    this.player.currentTime = Math.max(0, offsetTime)
  }

  setVolume(volume) {
    if (!this.player) return
    this.player.volume = volume
  }


  // Utils
  isValidDuration(duration) {
    if (duration && !isNaN(duration) && duration !== Number.POSITIVE_INFINITY && duration !== Number.NEGATIVE_INFINITY) {
      return true
    }
    return false
  }

  getBufferedRanges() {
    if (!this.player) return []
    const ranges = []
    const seekable = this.player.buffered || []

    let offset = 0

    for (let i = 0, length = seekable.length; i < length; i++) {
      let start = seekable.start(i)
      let end = seekable.end(i)
      if (!this.isValidDuration(start)) {
        start = 0
      }
      if (!this.isValidDuration(end)) {
        end = 0
        continue
      }

      ranges.push({
        start: start + offset,
        end: end + offset
      })
    }
    return ranges
  }

  getLastBufferedTime() {
    var bufferedRanges = this.getBufferedRanges()
    if (!bufferedRanges.length) return 0

    var buff = bufferedRanges.find((buff) => buff.start < this.player.currentTime && buff.end > this.player.currentTime)
    if (buff) return buff.end

    var last = bufferedRanges[bufferedRanges.length - 1]
    return last.end
  }
}