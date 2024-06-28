<template>
  <div id="page-wrapper" class="w-full h-screen overflow-y-auto">
    <div class="w-full h-full flex items-center justify-center">
      <div class="w-full p-8">
        <p class="text-3xl font-semibold text-center mb-6">{{ mediaItemShare.playbackSession?.displayTitle || 'N/A' }}</p>

        <div class="w-full py-8">
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
  async asyncData({ params, error, app }) {
    const mediaItemShare = await app.$axios.$get(`/public/share/${params.slug}`).catch((error) => {
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
      totalDuration: 0
    }
  },
  computed: {
    audioTracks() {
      return (this.mediaItemShare.playbackSession?.audioTracks || []).map((track) => {
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
      return this.mediaItemShare.playbackSession?.chapters || []
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
    startPlayInterval() {
      clearInterval(this.playInterval)
      this.playInterval = setInterval(() => {
        if (this.localAudioPlayer) {
          this.setCurrentTime(this.localAudioPlayer.getCurrentTime())
        }
      }, 1000)
    },
    stopPlayInterval() {
      clearInterval(this.playInterval)
      this.playInterval = null
    },
    playerStateChange(state) {
      console.log('Player state change', state)
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
    }
  },
  mounted() {
    window.addEventListener('keydown', this.keyDown)

    console.log('Loaded media item share', this.mediaItemShare)
    this.localAudioPlayer.set(null, this.audioTracks, false, 0, false)
    this.localAudioPlayer.on('stateChange', this.playerStateChange.bind(this))
    this.localAudioPlayer.on('timeupdate', this.playerTimeUpdate.bind(this))
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.keyDown)

    this.localAudioPlayer.off('stateChange', this.playerStateChange)
    this.localAudioPlayer.destroy()
  }
}
</script>
