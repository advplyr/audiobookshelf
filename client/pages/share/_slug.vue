<template>
  <div id="page-wrapper" class="w-full h-screen max-h-screen overflow-hidden">
    <div class="w-full h-full flex items-center justify-center">
      <div class="w-full p-2 sm:p-4 md:p-8">
        <div v-if="!isMobileLandscape" :style="{ width: coverWidth + 'px', height: coverHeight + 'px' }" class="mx-auto overflow-hidden rounded-xl my-2">
          <img :src="coverUrl" class="object-contain w-full h-full" />
        </div>
        <p class="text-2xl lg:text-3xl font-semibold text-center mb-1 line-clamp-2">{{ mediaItemShare.playbackSession.displayTitle || 'No title' }}</p>
        <p v-if="mediaItemShare.playbackSession.displayAuthor" class="text-lg lg:text-xl text-slate-400 font-semibold text-center mb-1 truncate">{{ mediaItemShare.playbackSession.displayAuthor }}</p>

        <div class="w-full pt-16">
          <player-ui ref="audioPlayer" :chapters="chapters" :paused="isPaused" :loading="!hasLoaded" :is-podcast="false" hide-bookmarks hide-sleep-timer @playPause="playPause" @jumpForward="jumpForward" @jumpBackward="jumpBackward" @setVolume="setVolume" @setPlaybackRate="setPlaybackRate" @seek="seek" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LocalAudioPlayer from '../../players/LocalAudioPlayer'

export default {
  layout: 'blank',
  async asyncData({ params, error, app, query }) {
    let endpoint = `/public/share/${params.slug}`
    if (query.t && !isNaN(query.t)) {
      endpoint += `?t=${query.t}`
    }
    const mediaItemShare = await app.$axios.$get(endpoint).catch((error) => {
      console.error('Failed', error)
      return null
    })
    if (!mediaItemShare) {
      return error({ statusCode: 404, message: 'Not found' })
    }

    return {
      mediaItemShare: mediaItemShare
    }
  },
  data() {
    return {
      localAudioPlayer: new LocalAudioPlayer(),
      playerState: null,
      playInterval: null,
      hasLoaded: false,
      totalDuration: 0,
      windowWidth: 0,
      windowHeight: 0,
      listeningTimeSinceSync: 0
    }
  },
  computed: {
    playbackSession() {
      return this.mediaItemShare.playbackSession
    },
    coverUrl() {
      if (!this.playbackSession.coverPath) return `${this.$config.routerBasePath}/book_placeholder.jpg`
      if (process.env.NODE_ENV === 'development') {
        return `http://localhost:3333/public/share/${this.mediaItemShare.slug}/cover`
      }
      return `/public/share/${this.mediaItemShare.slug}/cover`
    },
    audioTracks() {
      return (this.playbackSession.audioTracks || []).map((track) => {
        if (process.env.NODE_ENV === 'development') {
          track.contentUrl = `${process.env.serverUrl}${track.contentUrl}`
        }
        track.relativeContentUrl = track.contentUrl
        return track
      })
    },
    isPlaying() {
      return this.playerState === 'PLAYING'
    },
    isPaused() {
      return !this.isPlaying
    },
    chapters() {
      return this.playbackSession.chapters || []
    },
    coverAspectRatio() {
      const coverAspectRatio = this.playbackSession.coverAspectRatio
      return coverAspectRatio === this.$constants.BookCoverAspectRatio.STANDARD ? 1.6 : 1
    },
    isMobileLandscape() {
      return this.windowWidth > this.windowHeight && this.windowHeight < 450
    },
    coverWidth() {
      const availableCoverWidth = Math.min(450, this.windowWidth - 32)
      const availableCoverHeight = Math.min(450, this.windowHeight - 250)

      const mostCoverHeight = availableCoverWidth * this.coverAspectRatio
      if (mostCoverHeight > availableCoverHeight) {
        return availableCoverHeight / this.coverAspectRatio
      }
      return availableCoverWidth
    },
    coverHeight() {
      return this.coverWidth * this.coverAspectRatio
    }
  },
  methods: {
    playPause() {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      this.localAudioPlayer.playPause()
    },
    jumpForward() {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      const currentTime = this.localAudioPlayer.getCurrentTime()
      const duration = this.localAudioPlayer.getDuration()
      this.seek(Math.min(currentTime + 10, duration))
    },
    jumpBackward() {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      const currentTime = this.localAudioPlayer.getCurrentTime()
      this.seek(Math.max(currentTime - 10, 0))
    },
    setVolume(volume) {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      this.localAudioPlayer.setVolume(volume)
    },
    setPlaybackRate(playbackRate) {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      this.localAudioPlayer.setPlaybackRate(playbackRate)
    },
    seek(time) {
      if (!this.localAudioPlayer || !this.hasLoaded) return

      this.localAudioPlayer.seek(time, this.isPlaying)
      this.setCurrentTime(time)
    },
    setCurrentTime(time) {
      if (!this.$refs.audioPlayer) return

      // Update UI
      this.$refs.audioPlayer.setCurrentTime(time)
    },
    setDuration() {
      if (!this.localAudioPlayer) return
      this.totalDuration = this.localAudioPlayer.getDuration()
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.setDuration(this.totalDuration)
      }
    },
    sendProgressSync(currentTime) {
      console.log('Sending progress sync for time', currentTime)
      const progress = {
        currentTime
      }
      this.$axios.$patch(`/public/share/${this.mediaItemShare.slug}/progress`, progress, { progress: false }).catch((error) => {
        console.error('Failed to send progress sync', error)
      })
    },
    startPlayInterval() {
      let lastTick = Date.now()
      clearInterval(this.playInterval)
      this.playInterval = setInterval(() => {
        if (!this.localAudioPlayer) return

        const currentTime = this.localAudioPlayer.getCurrentTime()
        this.setCurrentTime(currentTime)
        const exactTimeElapsed = (Date.now() - lastTick) / 1000
        lastTick = Date.now()
        this.listeningTimeSinceSync += exactTimeElapsed
        if (this.listeningTimeSinceSync >= 30) {
          this.listeningTimeSinceSync = 0
          this.sendProgressSync(currentTime)
        }
      }, 1000)
    },
    stopPlayInterval() {
      clearInterval(this.playInterval)
      this.playInterval = null
    },
    playerStateChange(state) {
      this.playerState = state
      if (state === 'LOADED' || state === 'PLAYING') {
        this.setDuration()
      }
      if (state === 'LOADED') {
        this.hasLoaded = true
      }
      if (state === 'PLAYING') {
        this.startPlayInterval()
      } else {
        this.stopPlayInterval()
      }
    },
    playerTimeUpdate(time) {
      this.setCurrentTime(time)
    },
    getHotkeyName(e) {
      var keyCode = e.keyCode || e.which
      if (!this.$keynames[keyCode]) {
        // Unused hotkey
        return null
      }

      var keyName = this.$keynames[keyCode]
      var name = keyName
      if (e.shiftKey) name = 'Shift-' + keyName
      if (process.env.NODE_ENV !== 'production') {
        console.log('Hotkey command', name)
      }
      return name
    },
    keyDown(e) {
      if (!this.localAudioPlayer || !this.hasLoaded) return

      var name = this.getHotkeyName(e)
      if (!name) return

      // Playing audiobook
      if (Object.values(this.$hotkeys.AudioPlayer).includes(name)) {
        this.$eventBus.$emit('player-hotkey', name)
        e.preventDefault()
      }
    },
    resize() {
      this.windowWidth = window.innerWidth
      this.windowHeight = window.innerHeight
    }
  },
  mounted() {
    this.resize()
    window.addEventListener('resize', this.resize)
    window.addEventListener('keydown', this.keyDown)

    if (process.env.NODE_ENV === 'development') {
      console.log('Loaded media item share', this.mediaItemShare)
    }

    const startTime = this.playbackSession.currentTime || 0
    this.localAudioPlayer.set(null, this.audioTracks, false, startTime, false)
    this.localAudioPlayer.on('stateChange', this.playerStateChange.bind(this))
    this.localAudioPlayer.on('timeupdate', this.playerTimeUpdate.bind(this))
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('keydown', this.keyDown)

    this.localAudioPlayer.off('stateChange', this.playerStateChange)
    this.localAudioPlayer.destroy()
  }
}
</script>
