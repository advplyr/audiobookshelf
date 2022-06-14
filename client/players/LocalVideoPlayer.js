import Hls from 'hls.js'
import EventEmitter from 'events'

export default class LocalVideoPlayer extends EventEmitter {
  constructor(ctx) {
    super()

    this.ctx = ctx
    this.player = null

    this.libraryItem = null
    this.videoTrack = null
    this.isHlsTranscode = null
    this.hlsInstance = null
    this.usingNativeplayer = false
    this.startTime = 0
    this.playWhenReady = false
    this.defaultPlaybackRate = 1

    this.playableMimeTypes = []

    this.initialize()
  }

  initialize() {
    if (document.getElementById('video-player')) {
      document.getElementById('video-player').remove()
    }
    var videoEl = document.createElement('video')
    videoEl.id = 'video-player'
    // videoEl.style.display = 'none'
    videoEl.className = 'absolute bg-black z-50'
    videoEl.style.height = '216px'
    videoEl.style.width = '384px'
    videoEl.style.bottom = '80px'
    videoEl.style.left = '16px'
    document.body.appendChild(videoEl)
    this.player = videoEl

    this.player.addEventListener('play', this.evtPlay.bind(this))
    this.player.addEventListener('pause', this.evtPause.bind(this))
    this.player.addEventListener('progress', this.evtProgress.bind(this))
    this.player.addEventListener('ended', this.evtEnded.bind(this))
    this.player.addEventListener('error', this.evtError.bind(this))
    this.player.addEventListener('loadedmetadata', this.evtLoadedMetadata.bind(this))
    this.player.addEventListener('timeupdate', this.evtTimeupdate.bind(this))

    var mimeTypes = ['video/mp4']
    var mimeTypeCanPlayMap = {}
    mimeTypes.forEach((mt) => {
      var canPlay = this.player.canPlayType(mt)
      mimeTypeCanPlayMap[mt] = canPlay
      if (canPlay) this.playableMimeTypes.push(mt)
    })
    console.log(`[LocalVideoPlayer] Supported mime types`, mimeTypeCanPlayMap, this.playableMimeTypes)
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
    console.log(`[LocalVideoPlayer] Ended`)
    this.emit('finished')
  }
  evtError(error) {
    console.error('Player error', error)
    this.emit('error', error)
  }
  evtLoadedMetadata(data) {
    if (!this.isHlsTranscode) {
      this.player.currentTime = this.startTime
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

  destroy() {
    this.destroyHlsInstance()
    if (this.player) {
      this.player.remove()
    }
  }

  set(libraryItem, videoTrack, isHlsTranscode, startTime, playWhenReady = false) {
    this.libraryItem = libraryItem
    this.videoTrack = videoTrack
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
    // iOS does not support Media Elements but allows for HLS in the native video player
    if (!Hls.isSupported()) {
      console.warn('HLS is not supported - fallback to using video element')
      this.usingNativeplayer = true
      this.player.src = this.videoTrack.relativeContentUrl
      this.player.currentTime = this.startTime
      return
    }

    var hlsOptions = {
      startPosition: this.startTime || -1
      // No longer needed because token is put in a query string
      // xhrSetup: (xhr) => {
      //   xhr.setRequestHeader('Authorization', `Bearer ${this.token}`)
      // }
    }
    this.hlsInstance = new Hls(hlsOptions)

    this.hlsInstance.attachMedia(this.player)
    this.hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
      this.hlsInstance.loadSource(this.videoTrack.relativeContentUrl)

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

  setDirectPlay() {
    this.player.src = this.videoTrack.relativeContentUrl
    console.log(`[LocalVideoPlayer] Loading track src ${this.videoTrack.relativeContentUrl}`)
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

  async resetStream(startTime) {
    this.destroyHlsInstance()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    this.set(this.libraryItem, this.videoTrack, this.isHlsTranscode, startTime, true)
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
    return this.player ? this.player.currentTime : 0
  }

  getDuration() {
    return this.videoTrack.duration
  }

  setPlaybackRate(playbackRate) {
    if (!this.player) return
    this.defaultPlaybackRate = playbackRate
    this.player.playbackRate = playbackRate
  }

  seek(time) {
    if (!this.player) return
    this.player.currentTime = Math.max(0, time)
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