import Hls from 'hls.js'
import EventEmitter from 'events'
import SilenceMap from './smart-speed/SilenceMap'
import TimeMapper from './smart-speed/TimeMapper'

export default class LocalAudioPlayer extends EventEmitter {
  constructor(ctx) {
    super()

    this.ctx = ctx
    this.player = null

    this.libraryItem = null
    this.audioTracks = []
    this.currentTrackIndex = 0
    this.isHlsTranscode = null
    this.hlsInstance = null
    this.usingNativeplayer = false
    this.startTime = 0
    this.trackStartTime = 0
    this.playWhenReady = false
    this.defaultPlaybackRate = 1

    this.playableMimeTypes = []

    this.audioContext = null
    this.audioSourceNode = null
    this.usingWebAudio = false

    this.silenceMap = new SilenceMap()
    this.silenceDetectorNode = null
    this.timeMapper = new TimeMapper([], 1.0)
    this.smartSpeedRatio = 2.0
    this.enableSmartSpeed = false

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
    this.player.addEventListener('ended', this.evtEnded.bind(this))
    this.player.addEventListener('error', this.evtError.bind(this))
    this.player.addEventListener('loadedmetadata', this.evtLoadedMetadata.bind(this))
    this.player.addEventListener('timeupdate', this.evtTimeupdate.bind(this))
    this.player.addEventListener('waiting', this.evtWaiting.bind(this))
    this.player.addEventListener('playing', this.evtPlaying.bind(this))

    var mimeTypes = [
      'audio/flac',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'audio/aac',
      'audio/x-ms-wma',
      'audio/x-aiff',
      'audio/webm',
      // `audio/matroska` is the correct mimetype, but the server still uses `audio/x-matroska`
      // ref: https://www.iana.org/assignments/media-types/media-types.xhtml
      'audio/matroska',
      'audio/x-matroska'
    ]
    var mimeTypeCanPlayMap = {}
    mimeTypes.forEach((mt) => {
      var canPlay = this.player.canPlayType(mt)
      mimeTypeCanPlayMap[mt] = canPlay
      if (canPlay) this.playableMimeTypes.push(mt)
    })
    console.log(`[LocalPlayer] Supported mime types`, mimeTypeCanPlayMap, this.playableMimeTypes)
    this.initWebAudio()
  }

  initWebAudio() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) {
      console.warn('[LocalPlayer] Web Audio API not supported, falling back to direct audio')
      return
    }
    try {
      this.audioContext = new AudioContextCtor()
      this.audioSourceNode = this.audioContext.createMediaElementSource(this.player)
      this.audioSourceNode.connect(this.audioContext.destination)
      this.usingWebAudio = true
      console.log('[LocalPlayer] Web Audio API pipeline initialised')
    } catch (err) {
      console.error('[LocalPlayer] Failed to initialise Web Audio API', err)
      this.usingWebAudio = false
    }
  }

  updateSmartSpeedRegions() {
    this.timeMapper = new TimeMapper(this.silenceMap.getRegions(), this.smartSpeedRatio)
    this.emit('timeSaved', this.timeMapper.totalTimeSaved())
  }

  async initSilenceDetector() {
    if (!this.usingWebAudio || !this.audioContext) return
    if (this.silenceDetectorNode) return

    try {
      await this.audioContext.audioWorklet.addModule('/smart-speed/SilenceDetectorProcessor.js')
      this.silenceDetectorNode = new AudioWorkletNode(this.audioContext, 'silence-detector')

      this.silenceDetectorNode.port.onmessage = (event) => {
        const msg = event.data
        if (msg.type === 'silence-start') {
          // Map AudioContext time to Media time
          const delayMs = this.audioContext.currentTime * 1000 - msg.time
          this._silenceStartTime = this.player.currentTime * 1000 - delayMs

          // Dynamically increase playback rate
          if (this.enableSmartSpeed) {
            this.player.playbackRate = this.defaultPlaybackRate * this.smartSpeedRatio
          }
        } else if (msg.type === 'silence-end') {
          if (this.enableSmartSpeed) {
            this.player.playbackRate = this.defaultPlaybackRate
          }
          if (this._silenceStartTime !== null) {
            const delayMs = this.audioContext.currentTime * 1000 - msg.time
            const silenceEndTime = this.player.currentTime * 1000 - delayMs
            this.silenceMap.addRegion(this._silenceStartTime, silenceEndTime)
            this._silenceStartTime = null
            this.updateSmartSpeedRegions()
          }
        }
      }

      this.audioSourceNode.disconnect()
      this.audioSourceNode.connect(this.silenceDetectorNode)
      this.silenceDetectorNode.connect(this.audioContext.destination)

      this._silenceStartTime = null
      console.log('[LocalPlayer] Silence detector initialised')
    } catch (err) {
      console.warn('[LocalPlayer] Failed to initialise silence detector', err)
      this.silenceDetectorNode = null
    }
  }

  destroySilenceDetector() {
    if (this.silenceDetectorNode) {
      try {
        this.silenceDetectorNode.disconnect()
      } catch (err) {
        // Ignore disconnect errors
      }
      this.silenceDetectorNode = null
    }
    this.silenceMap.reset()
    this.updateSmartSpeedRegions()
    this._silenceStartTime = null

    // Reset playback rate in case we were in the middle of a silence region
    if (this.player) {
      this.player.playbackRate = this.defaultPlaybackRate
    }
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
  evtEnded() {
    if (this.currentTrackIndex < this.audioTracks.length - 1) {
      console.log(`[LocalPlayer] Track ended - loading next track ${this.currentTrackIndex + 1}`)
      // Has next track
      this.currentTrackIndex++
      this.startTime = this.currentTrack.startOffset
      this.loadCurrentTrack()
    } else {
      console.log(`[LocalPlayer] Ended`)
      this.emit('finished')
    }
  }
  evtError(error) {
    console.error('Player error', error)
    this.emit('error', error)
  }
  evtLoadedMetadata(data) {
    if (!this.isHlsTranscode) {
      this.player.currentTime = this.trackStartTime
    }

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

  evtWaiting() {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend()
    }
  }

  evtPlaying() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  destroy() {
    this.destroySilenceDetector()
    this.destroyHlsInstance()
    this.destroyWebAudio()
    if (this.player) {
      this.player.remove()
    }
  }

  set(libraryItem, tracks, isHlsTranscode, startTime, playWhenReady = false) {
    this.libraryItem = libraryItem
    this.audioTracks = tracks
    this.isHlsTranscode = isHlsTranscode
    this.playWhenReady = playWhenReady
    this.startTime = startTime

    if (this.hlsInstance) {
      this.destroyHlsInstance()
    }

    if (this.isHlsTranscode) {
      this.setHlsStream()
    } else {
      this.setDirectPlay()
    }
  }

  setHlsStream() {
    this.trackStartTime = 0
    this.currentTrackIndex = 0

    // iOS does not support Media Elements but allows for HLS in the native audio player
    if (!Hls.isSupported()) {
      console.warn('HLS is not supported - fallback to using audio element')
      this.usingNativeplayer = true
      this.player.src = this.currentTrack.relativeContentUrl
      this.player.currentTime = this.startTime
      return
    }

    var hlsOptions = {
      startPosition: this.startTime || -1,
      fragLoadPolicy: {
        default: {
          maxTimeToFirstByteMs: 10000,
          maxLoadTimeMs: 120000,
          timeoutRetry: {
            maxNumRetry: 4,
            retryDelayMs: 0,
            maxRetryDelayMs: 0
          },
          errorRetry: {
            maxNumRetry: 8,
            retryDelayMs: 1000,
            maxRetryDelayMs: 8000,
            shouldRetry: (retryConfig, retryCount, isTimeout, httpStatus, retry) => {
              if (httpStatus?.code === 404 && retryConfig?.maxNumRetry > retryCount) {
                console.log(`[HLS] Server 404 for fragment retry ${retryCount} of ${retryConfig.maxNumRetry}`)
                return true
              }
              return retry
            }
          }
        }
      }
    }
    this.hlsInstance = new Hls(hlsOptions)

    this.hlsInstance.attachMedia(this.player)
    this.hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
      this.hlsInstance.loadSource(this.currentTrack.relativeContentUrl)

      this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS] Manifest Parsed')
      })

      this.hlsInstance.on(Hls.Events.ERROR, (e, data) => {
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          console.error('[HLS] BUFFER STALLED ERROR')
        } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
          // Only show error if the fragment is not being retried
          if (data.errorAction?.action !== 5) {
            console.error('[HLS] FRAG LOAD ERROR', data)
          }
        } else {
          console.error('[HLS] Error', data.type, data.details, data)
        }
      })
      this.hlsInstance.on(Hls.Events.DESTROYING, () => {
        console.log('[HLS] Destroying HLS Instance')
      })
    })
  }

  setDirectPlay() {
    // Set initial track and track time offset
    var trackIndex = this.audioTracks.findIndex((t) => this.startTime >= t.startOffset && this.startTime < t.startOffset + t.duration)
    this.currentTrackIndex = trackIndex >= 0 ? trackIndex : 0

    this.loadCurrentTrack()
  }

  loadCurrentTrack() {
    if (!this.currentTrack) return
    this.silenceMap.reset()
    this.updateSmartSpeedRegions()
    // When direct play track is loaded current time needs to be set
    this.trackStartTime = Math.max(0, this.startTime - (this.currentTrack.startOffset || 0))
    this.player.src = this.currentTrack.relativeContentUrl
    console.log(`[LocalPlayer] Loading track src ${this.currentTrack.relativeContentUrl}`)
    this.player.load()
  }

  destroyHlsInstance() {
    if (!this.hlsInstance) return
    if (this.hlsInstance.destroy) {
      var temp = this.hlsInstance
      temp.destroy()
    }
    this.hlsInstance = null
  }

  destroyWebAudio() {
    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.disconnect()
      } catch (err) {
        // Ignore disconnect errors
      }
      this.audioSourceNode = null
    }
    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (err) {
        // Ignore close errors
      }
      this.audioContext = null
    }
    this.usingWebAudio = false
  }

  async resetStream(startTime) {
    this.destroyHlsInstance()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    this.set(this.libraryItem, this.audioTracks, this.isHlsTranscode, startTime, true)
  }

  playPause() {
    if (!this.player) return
    if (this.player.paused) this.play()
    else this.pause()
  }

  play() {
    this.playWhenReady = true
    if (this.player) {
      if (this.usingWebAudio && this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume()
      }
      this.player.play()
    }
  }

  pause() {
    this.playWhenReady = false
    if (this.player) this.player.pause()
  }

  getCurrentTime() {
    var currentTrackOffset = this.currentTrack.startOffset || 0
    if (!this.player) return 0

    if (this.enableSmartSpeed) {
      return this.timeMapper.audioToWallClock((currentTrackOffset + this.player.currentTime) * 1000) / 1000
    }
    return currentTrackOffset + this.player.currentTime
  }

  getDuration() {
    if (!this.audioTracks.length) return 0
    var lastTrack = this.audioTracks[this.audioTracks.length - 1]
    const duration = lastTrack.startOffset + lastTrack.duration
    if (this.enableSmartSpeed) {
      return this.timeMapper.audioToWallClock(duration * 1000) / 1000
    }
    return duration
  }

  setPlaybackRate(playbackRate) {
    if (!this.player) return
    this.defaultPlaybackRate = playbackRate

    // If we're in the middle of a silence region, we should multiply the new rate
    if (this.enableSmartSpeed && this._silenceStartTime !== null) {
      this.player.playbackRate = playbackRate * this.smartSpeedRatio
    } else {
      this.player.playbackRate = playbackRate
    }
  }

  async setSmartSpeed(enabled) {
    this.enableSmartSpeed = enabled
    if (enabled && this.usingWebAudio) {
      await this.initSilenceDetector()
    } else {
      this.destroySilenceDetector()
    }
  }

  seek(time, playWhenReady) {
    if (!this.player) return

    var mappedTime = time

    if (this.enableSmartSpeed) {
      mappedTime = this.timeMapper.wallClockToAudio(time * 1000) / 1000
    }

    if (this.silenceDetectorNode) {
      this.silenceDetectorNode.port.postMessage({ type: 'reset' })
      this._silenceStartTime = null
    }

    this.silenceMap.reset()
    this.updateSmartSpeedRegions()
    this.playWhenReady = playWhenReady

    // Reset playback rate in case we were in a silence region
    if (this.enableSmartSpeed && this.player.playbackRate !== this.defaultPlaybackRate) {
      this.player.playbackRate = this.defaultPlaybackRate
    }

    if (this.isHlsTranscode) {
      // Seeking HLS stream
      var offsetTime = mappedTime - (this.currentTrack.startOffset || 0)
      this.player.currentTime = Math.max(0, offsetTime)
    } else {
      // Seeking Direct play
      if (mappedTime < this.currentTrack.startOffset || mappedTime > this.currentTrack.startOffset + this.currentTrack.duration) {
        // Change Track
        var trackIndex = this.audioTracks.findIndex((t) => mappedTime >= t.startOffset && mappedTime < t.startOffset + t.duration)
        if (trackIndex >= 0) {
          this.startTime = mappedTime
          this.currentTrackIndex = trackIndex

          if (!this.player.paused) {
            // audio player playing so play when track loads
            this.playWhenReady = true
          }
          this.loadCurrentTrack()
        }
      } else {
        var offsetTime = mappedTime - (this.currentTrack.startOffset || 0)
        this.player.currentTime = Math.max(0, offsetTime)
      }
    }
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
