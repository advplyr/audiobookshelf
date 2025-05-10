<template>
  <div class="w-full max-w-full h-dvh max-h-dvh overflow-hidden" :style="{ backgroundColor: coverRgb }">
    <div class="w-screen h-screen absolute inset-0 pointer-events-none" style="background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(38, 38, 38, 1) 80%)"></div>
    <div class="absolute inset-0 w-screen h-dvh flex items-center justify-center z-10">
      <div class="w-full p-2 sm:p-4 md:p-8">
        <div v-if="!isMobileLandscape" :style="{ width: coverWidth + 'px', height: coverHeight + 'px' }" class="mx-auto overflow-hidden rounded-xl my-2">
          <img ref="coverImg" :src="coverUrl" class="object-contain w-full h-full" @load="coverImageLoaded" />
        </div>
        <p class="text-2xl lg:text-3xl font-semibold text-center mb-1 line-clamp-2">{{ mediaItemShare.playbackSession.displayTitle || 'No title' }}</p>
        <p v-if="mediaItemShare.playbackSession.displayAuthor" class="text-lg lg:text-xl text-slate-400 font-semibold text-center mb-1 truncate">{{ mediaItemShare.playbackSession.displayAuthor }}</p>

        <div class="w-full pt-16">
          <player-ui ref="audioPlayer" :chapters="chapters" :current-chapter="currentChapter" :paused="isPaused" :loading="!hasLoaded" :is-podcast="false" hide-bookmarks hide-sleep-timer @playPause="playPause" @jumpForward="jumpForward" @jumpBackward="jumpBackward" @setVolume="setVolume" @setPlaybackRate="setPlaybackRate" @seek="seek" />
        </div>

        <ui-tooltip v-if="mediaItemShare.isDownloadable" direction="bottom" :text="$strings.LabelDownload" class="absolute top-0 left-0 m-4">
          <button aria-label="Download" class="text-gray-300 hover:text-white" @click="downloadShareItem"><span class="material-symbols text-2xl sm:text-3xl">download</span></button>
        </ui-tooltip>
      </div>
    </div>
  </div>
</template>

<script>
import LocalAudioPlayer from '../../players/LocalAudioPlayer'
import { FastAverageColor } from 'fast-average-color'

export default {
  layout: 'blank',
  async asyncData({ params, error, app, query }) {
    let endpoint = `/public/share/${params.slug}`
    if (query.t && !isNaN(query.t)) {
      endpoint += `?t=${query.t}`
    }
    const mediaItemShare = await app.$axios.$get(endpoint, { timeout: 10000 }).catch((error) => {
      console.error('Failed', error)
      return null
    })
    if (!mediaItemShare) {
      return error({ statusCode: 404, message: 'Media item not found or expired' })
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
      listeningTimeSinceSync: 0,
      coverRgb: null,
      coverBgIsLight: false,
      currentTime: 0
    }
  },
  computed: {
    playbackSession() {
      return this.mediaItemShare.playbackSession
    },
    coverUrl() {
      if (!this.playbackSession.coverPath) return this.$store.getters['globals/getPlaceholderCoverSrc']
      return `${this.$config.routerBasePath}/public/share/${this.mediaItemShare.slug}/cover`
    },
    downloadUrl() {
      return `${process.env.serverUrl}/public/share/${this.mediaItemShare.slug}/download`
    },
    audioTracks() {
      return (this.playbackSession.audioTracks || []).map((track) => {
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
    currentChapter() {
      return this.chapters.find((chapter) => chapter.start <= this.currentTime && this.currentTime < chapter.end)
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
    mediaSessionPlay() {
      console.log('Media session play')
      this.play()
    },
    mediaSessionPause() {
      console.log('Media session pause')
      this.pause()
    },
    mediaSessionStop() {
      console.log('Media session stop')
      this.pause()
    },
    mediaSessionSeekBackward() {
      console.log('Media session seek backward')
      this.jumpBackward()
    },
    mediaSessionSeekForward() {
      console.log('Media session seek forward')
      this.jumpForward()
    },
    mediaSessionSeekTo(e) {
      console.log('Media session seek to', e)
      if (e.seekTime !== null && !isNaN(e.seekTime)) {
        this.seek(e.seekTime)
      }
    },
    mediaSessionPreviousTrack() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.prevChapter()
      }
    },
    mediaSessionNextTrack() {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.nextChapter()
      }
    },
    updateMediaSessionPlaybackState() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused'
      }
    },
    setMediaSession() {
      // https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
      if ('mediaSession' in navigator) {
        const chapterInfo = []
        if (this.chapters.length > 0) {
          this.chapters.forEach((chapter) => {
            chapterInfo.push({
              title: chapter.title,
              startTime: chapter.start
            })
          })
        }

        navigator.mediaSession.metadata = new MediaMetadata({
          title: this.mediaItemShare.playbackSession.displayTitle || 'No title',
          artist: this.mediaItemShare.playbackSession.displayAuthor || 'Unknown',
          artwork: [
            {
              src: this.coverUrl
            }
          ],
          chapterInfo
        })
        console.log('Set media session metadata', navigator.mediaSession.metadata)

        navigator.mediaSession.setActionHandler('play', this.mediaSessionPlay)
        navigator.mediaSession.setActionHandler('pause', this.mediaSessionPause)
        navigator.mediaSession.setActionHandler('stop', this.mediaSessionStop)
        navigator.mediaSession.setActionHandler('seekbackward', this.mediaSessionSeekBackward)
        navigator.mediaSession.setActionHandler('seekforward', this.mediaSessionSeekForward)
        navigator.mediaSession.setActionHandler('seekto', this.mediaSessionSeekTo)
        navigator.mediaSession.setActionHandler('previoustrack', this.mediaSessionSeekBackward)
        navigator.mediaSession.setActionHandler('nexttrack', this.mediaSessionSeekForward)
      } else {
        console.warn('Media session not available')
      }
    },
    async coverImageLoaded(e) {
      if (!this.playbackSession.coverPath) return
      const fac = new FastAverageColor()
      fac
        .getColorAsync(e.target)
        .then((color) => {
          this.coverRgb = color.rgba
          this.coverBgIsLight = color.isLight

          document.body.style.backgroundColor = color.hex
        })
        .catch((e) => {
          console.log(e)
        })
    },
    playPause() {
      if (this.isPlaying) {
        this.pause()
      } else {
        this.play()
      }
    },
    play() {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      this.localAudioPlayer.play()
    },
    pause() {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      this.localAudioPlayer.pause()
    },
    jumpForward() {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      const currentTime = this.localAudioPlayer.getCurrentTime()
      const duration = this.localAudioPlayer.getDuration()
      const jumpForwardAmount = this.$store.getters['user/getUserSetting']('jumpForwardAmount') || 10
      this.seek(Math.min(currentTime + jumpForwardAmount, duration))
    },
    jumpBackward() {
      if (!this.localAudioPlayer || !this.hasLoaded) return
      const currentTime = this.localAudioPlayer.getCurrentTime()
      const jumpBackwardAmount = this.$store.getters['user/getUserSetting']('jumpBackwardAmount') || 10
      this.seek(Math.max(currentTime - jumpBackwardAmount, 0))
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
      this.currentTime = time
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
      this.updateMediaSessionPlaybackState()
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
      setTimeout(() => {
        this.windowWidth = window.innerWidth
        this.windowHeight = window.innerHeight
        this.$store.commit('globals/updateWindowSize', { width: window.innerWidth, height: window.innerHeight })
      }, 100)
    },
    playerError(error) {
      console.error('Player error', error)
      this.$toast.error('Failed to play audio on device')
    },
    playerFinished() {
      console.log('Player finished')
    },
    downloadShareItem() {
      this.$downloadFile(this.downloadUrl)
    }
  },
  mounted() {
    this.$store.dispatch('user/loadUserSettings')

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
    this.localAudioPlayer.on('error', this.playerError.bind(this))
    this.localAudioPlayer.on('finished', this.playerFinished.bind(this))

    this.setMediaSession()
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('keydown', this.keyDown)

    this.localAudioPlayer.off('stateChange', this.playerStateChange.bind(this))
    this.localAudioPlayer.off('timeupdate', this.playerTimeUpdate.bind(this))
    this.localAudioPlayer.off('error', this.playerError.bind(this))
    this.localAudioPlayer.off('finished', this.playerFinished.bind(this))
    this.localAudioPlayer.destroy()
  }
}
</script>
