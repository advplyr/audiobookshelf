import LocalPlayer from './LocalPlayer'
import CastPlayer from './CastPlayer'
import AudioTrack from './AudioTrack'

export default class PlayerHandler {
  constructor(ctx) {
    this.ctx = ctx
    this.audiobook = null
    this.playWhenReady = false
    this.player = null
    this.playerState = 'IDLE'
    this.currentStreamId = null
    this.startTime = 0

    this.lastSyncTime = 0
    this.lastSyncedAt = 0
    this.listeningTimeSinceSync = 0

    this.playInterval = null
  }

  get isCasting() {
    return this.ctx.$store.state.globals.isCasting
  }
  get isPlayingCastedAudiobook() {
    return this.audiobook && (this.player instanceof CastPlayer)
  }
  get isPlayingLocalAudiobook() {
    return this.audiobook && (this.player instanceof LocalPlayer)
  }
  get userToken() {
    return this.ctx.$store.getters['user/getToken']
  }
  get playerPlaying() {
    return this.playerState === 'PLAYING'
  }

  load(audiobook, playWhenReady, startTime = 0) {
    if (!this.player) this.switchPlayer()

    console.log('Load audiobook', audiobook)
    this.audiobook = audiobook
    this.startTime = startTime
    this.playWhenReady = playWhenReady
    this.prepare()
  }

  switchPlayer() {
    if (this.isCasting && !(this.player instanceof CastPlayer)) {
      console.log('[PlayerHandler] Switching to cast player')

      this.stopPlayInterval()
      this.playerStateChange('LOADING')

      this.startTime = this.player ? this.player.getCurrentTime() : this.startTime
      if (this.player) {
        this.player.destroy()
      }
      this.player = new CastPlayer(this.ctx)
      this.setPlayerListeners()

      if (this.audiobook) {
        // Audiobook was already loaded - prepare for cast
        this.playWhenReady = false
        this.prepare()
      }
    } else if (!this.isCasting && !(this.player instanceof LocalPlayer)) {
      console.log('[PlayerHandler] Switching to local player')

      this.stopPlayInterval()
      this.playerStateChange('LOADING')

      if (this.player) {
        this.player.destroy()
      }
      this.player = new LocalPlayer(this.ctx)
      this.setPlayerListeners()

      if (this.audiobook) {
        // Audiobook was already loaded - prepare for local play
        this.playWhenReady = false
        this.prepare()
      }
    }
  }

  setPlayerListeners() {
    this.player.on('stateChange', this.playerStateChange.bind(this))
    this.player.on('timeupdate', this.playerTimeupdate.bind(this))
    this.player.on('buffertimeUpdate', this.playerBufferTimeUpdate.bind(this))
  }

  playerStateChange(state) {
    console.log('[PlayerHandler] Player state change', state)
    this.playerState = state
    if (this.playerState === 'PLAYING') {
      this.startPlayInterval()
    } else {
      this.stopPlayInterval()
    }
    if (this.playerState === 'LOADED' || this.playerState === 'PLAYING') {
      this.ctx.setDuration(this.player.getDuration())
    }
    if (this.playerState !== 'LOADING') {
      this.ctx.setCurrentTime(this.player.getCurrentTime())
    }

    this.ctx.isPlaying = this.playerState === 'PLAYING'
    this.ctx.playerLoading = this.playerState === 'LOADING'
  }

  playerTimeupdate(time) {
    this.ctx.setCurrentTime(time)
  }

  playerBufferTimeUpdate(buffertime) {
    this.ctx.setBufferTime(buffertime)
  }

  async prepare() {
    var useHls = !this.isCasting
    if (useHls) {
      var stream = await this.ctx.$axios.$get(`/api/books/${this.audiobook.id}/stream`).catch((error) => {
        console.error('Failed to start stream', error)
      })
      if (stream) {
        console.log(`[PlayerHandler] prepare hls stream`, stream)
        this.setHlsStream(stream)
      }
    } else {
      // Setup tracks
      var runningTotal = 0
      var audioTracks = (this.audiobook.tracks || []).map((track) => {
        var audioTrack = new AudioTrack(track)
        audioTrack.startOffset = runningTotal
        audioTrack.contentUrl = `/lib/${this.audiobook.libraryId}/${this.audiobook.folderId}/${track.path}?token=${this.userToken}`
        audioTrack.mimeType = (track.codec === 'm4b' || track.codec === 'm4a') ? 'audio/mp4' : `audio/${track.codec}`

        runningTotal += audioTrack.duration
        return audioTrack
      })
      this.setDirectPlay(audioTracks)
    }
  }

  closePlayer() {
    console.log('[PlayerHandler] CLose Player')
    if (this.player) {
      this.player.destroy()
    }
    this.player = null
    this.playerState = 'IDLE'
    this.audiobook = null
    this.currentStreamId = null
    this.startTime = 0
    this.stopPlayInterval()
  }

  prepareStream(stream) {
    if (!this.player) this.switchPlayer()
    this.audiobook = stream.audiobook
    this.setHlsStream({
      streamId: stream.id,
      streamUrl: stream.clientPlaylistUri,
      startTime: stream.clientCurrentTime
    })
  }

  setHlsStream(stream) {
    this.currentStreamId = stream.streamId
    var audioTrack = new AudioTrack({
      duration: this.audiobook.duration,
      contentUrl: stream.streamUrl + '?token=' + this.userToken,
      mimeType: 'application/vnd.apple.mpegurl'
    })
    this.startTime = stream.startTime
    this.ctx.playerLoading = true
    this.player.set(this.audiobook, [audioTrack], this.currentStreamId, stream.startTime, this.playWhenReady)
  }

  setDirectPlay(audioTracks) {
    this.currentStreamId = null
    this.ctx.playerLoading = true
    this.player.set(this.audiobook, audioTracks, null, this.startTime, this.playWhenReady)
  }

  resetStream(startTime, streamId) {
    if (this.currentStreamId === streamId) {
      this.player.resetStream(startTime)
    } else {
      console.warn('resetStream mismatch streamId', this.currentStreamId, streamId)
    }
  }

  startPlayInterval() {
    clearInterval(this.playInterval)
    var lastTick = Date.now()
    this.playInterval = setInterval(() => {
      // Update UI
      if (!this.player) return
      var currentTime = this.player.getCurrentTime()
      this.ctx.setCurrentTime(currentTime)

      var exactTimeElapsed = ((Date.now() - lastTick) / 1000)
      lastTick = Date.now()
      this.listeningTimeSinceSync += exactTimeElapsed
      if (this.listeningTimeSinceSync >= 5) {
        this.sendProgressSync(currentTime)
        this.listeningTimeSinceSync = 0
      }
    }, 1000)
  }

  sendProgressSync(currentTime) {
    var diffSinceLastSync = Math.abs(this.lastSyncTime - currentTime)
    if (diffSinceLastSync < 1) return

    this.lastSyncTime = currentTime
    if (this.currentStreamId) { // Updating stream progress (HLS stream)
      var listeningTimeToAdd = Math.max(0, Math.floor(this.listeningTimeSinceSync))
      var syncData = {
        timeListened: listeningTimeToAdd,
        currentTime,
        streamId: this.currentStreamId,
        audiobookId: this.audiobook.id
      }
      this.ctx.$axios.$post('/api/syncStream', syncData, { timeout: 1000 }).catch((error) => {
        console.error('Failed to update stream progress', error)
      })
    } else {
      // Direct play via chromecast does not yet have backend stream session model
      //   so the progress update for the audiobook is updated this way (instead of through the stream)
      var duration = this.getDuration()
      var syncData = {
        totalDuration: duration,
        currentTime,
        progress: duration > 0 ? currentTime / duration : 0,
        isRead: false,
        audiobookId: this.audiobook.id,
        lastUpdate: Date.now()
      }
      this.ctx.$axios.$post('/api/syncLocal', syncData, { timeout: 1000 }).catch((error) => {
        console.error('Failed to update local progress', error)
      })
    }
  }

  stopPlayInterval() {
    clearInterval(this.playInterval)
    this.playInterval = null
  }

  playPause() {
    if (this.player) this.player.playPause()
  }

  play() {
    if (this.player) this.player.play()
  }

  pause() {
    if (this.player) this.player.pause()
  }

  getCurrentTime() {
    return this.player ? this.player.getCurrentTime() : 0
  }

  getDuration() {
    return this.player ? this.player.getDuration() : 0
  }

  jumpBackward() {
    if (!this.player) return
    var currentTime = this.getCurrentTime()
    this.seek(Math.max(0, currentTime - 10))
  }

  jumpForward() {
    if (!this.player) return
    var currentTime = this.getCurrentTime()
    this.seek(Math.min(currentTime + 10, this.getDuration()))
  }

  setVolume(volume) {
    if (!this.player) return
    this.player.setVolume(volume)
  }

  setPlaybackRate(playbackRate) {
    if (!this.player) return
    this.player.setPlaybackRate(playbackRate)
  }

  seek(time) {
    if (!this.player) return
    this.player.seek(time, this.playerPlaying)
    this.ctx.setCurrentTime(time)

    // Update progress if paused
    if (!this.playerPlaying) {
      this.sendProgressSync(time)
    }
  }
}