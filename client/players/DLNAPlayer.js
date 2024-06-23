import EventEmitter from 'events'

export default class DLNAPlayer extends EventEmitter {
  constructor(ctx) {
    super()

    this.ctx = ctx
    this.player = null
    this.playerController = null

    this.libraryItem = null
    this.audioTracks = []
    this.currentTrackIndex = 0
    this.isHlsTranscode = null
    this.currentTime = 0
    this.playWhenReady = false
    this.defaultPlaybackRate = 1

    // TODO: Use canDisplayType on receiver to check mime types
    this.playableMimeTypes = ['audio/flac', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/aac', 'audio/x-ms-wma', 'audio/x-aiff', 'audio/webm']

    this.coverUrl = ''
    this.castPlayerState = 'IDLE'

    // Supported audio codecs for chromecast

    this.supportedAudioCodecs = ['opus', 'mp3', 'aac', 'flac', 'webma', 'wav']

    this.initialize()
  }

  get currentTrack() {
    return this.audioTracks[this.currentTrackIndex] || {}
  }

  initialize() {
    this.ctx.$root.socket.on('test', this.destroy)
    //this.player = this.ctx.$root.castPlayer
  }

  evtMediaInfoChanged() {}

  destroy() {}

  async set(libraryItem, tracks, isHlsTranscode, startTime, playWhenReady = false) {
    this.libraryItem = libraryItem
    this.audioTracks = tracks
    this.isHlsTranscode = isHlsTranscode
    this.playWhenReady = playWhenReady
    this.currentTime = startTime
    console.log('Tracks: ')
    console.log(tracks.find((at) => at.startOffset <= startTime && at.startOffset + at.duration > startTime))
    var coverImg = this.ctx.$store.getters['globals/getLibraryItemCoverSrc'](libraryItem)
    if (process.env.NODE_ENV === 'development') {
      this.coverUrl = coverImg
    } else {
      this.coverUrl = `${window.location.origin}${coverImg}`
    }
    this.ctx.$root.socket.emit('dlna_start', this.audioTracks)
  }

  resetStream(startTime) {}

  playPause() {}

  play() {}

  pause() {}

  getCurrentTime() {
    //var currentTrackOffset = this.currentTrack.startOffset || 0
    return 0 //this.player ? currentTrackOffset + this.player.currentTime : 0
  }

  getDuration() {
    if (!this.audioTracks.length) return 0
    var lastTrack = this.audioTracks[this.audioTracks.length - 1]
    return lastTrack.startOffset + lastTrack.duration
  }

  setPlaybackRate(playbackRate) {
    this.defaultPlaybackRate = playbackRate
  }

  async seek(time, playWhenReady) {}

  setVolume(volume) {}
}
