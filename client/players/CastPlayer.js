import { buildCastLoadRequest, castLoadMedia } from "./castUtils"
import EventEmitter from 'events'

export default class CastPlayer extends EventEmitter {
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
    this.playableMimeTypes = []

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
    this.player = this.ctx.$root.castPlayer
    this.playerController = this.ctx.$root.castPlayerController
    this.playerController.addEventListener(
      cast.framework.RemotePlayerEventType.MEDIA_INFO_CHANGED, this.evtMediaInfoChanged.bind(this))
  }

  evtMediaInfoChanged() {
    // Use the current session to get an up to date media status.
    let session = cast.framework.CastContext.getInstance().getCurrentSession()
    if (!session) {
      return
    }
    let media = session.getMediaSession()
    if (!media) {
      return
    }

    var currentItemId = media.media.itemId
    if (currentItemId && this.currentTrackIndex !== currentItemId - 1) {
      this.currentTrackIndex = currentItemId - 1
    }

    // TODO: Emit finished event
    if (media.playerState !== this.castPlayerState) {
      this.emit('stateChange', media.playerState)
      this.castPlayerState = media.playerState
    }
  }

  destroy() {
    if (this.playerController) {
      this.playerController.stop()
    }
  }

  async set(libraryItem, tracks, isHlsTranscode, startTime, playWhenReady = false) {
    this.libraryItem = libraryItem
    this.audioTracks = tracks
    this.isHlsTranscode = isHlsTranscode
    this.playWhenReady = playWhenReady

    this.currentTime = startTime

    var coverImg = this.ctx.$store.getters['globals/getLibraryItemCoverSrc'](libraryItem)
    if (process.env.NODE_ENV === 'development') {
      this.coverUrl = coverImg
    } else {
      this.coverUrl = `${window.location.origin}${coverImg}`
    }

    var request = buildCastLoadRequest(this.libraryItem, this.coverUrl, this.audioTracks, this.currentTime, playWhenReady, this.defaultPlaybackRate)

    var castSession = cast.framework.CastContext.getInstance().getCurrentSession()
    await castLoadMedia(castSession, request)
  }

  resetStream(startTime) {
    // Cast only direct play for now
  }

  playPause() {
    if (this.playerController) this.playerController.playOrPause()
  }

  play() {
    if (this.playerController) this.playerController.playOrPause()
  }

  pause() {
    if (this.playerController) this.playerController.playOrPause()
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
    this.defaultPlaybackRate = playbackRate
  }

  async seek(time, playWhenReady) {
    if (!this.player) return

    this.playWhenReady = playWhenReady
    if (time < this.currentTrack.startOffset || time > this.currentTrack.startOffset + this.currentTrack.duration) {
      // Change Track
      var request = buildCastLoadRequest(this.libraryItem, this.coverUrl, this.audioTracks, time, playWhenReady, this.defaultPlaybackRate)
      var castSession = cast.framework.CastContext.getInstance().getCurrentSession()
      await castLoadMedia(castSession, request)
    } else {
      var offsetTime = time - (this.currentTrack.startOffset || 0)
      this.player.currentTime = Math.max(0, offsetTime)
      this.playerController.seek()
    }
  }

  setVolume(volume) {
    if (!this.player) return
    this.player.volumeLevel = volume
    this.playerController.setVolumeLevel()
  }
}