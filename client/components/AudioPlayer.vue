<template>
  <div class="w-full -mt-6">
    <div class="w-full relative mb-1">
      <div v-if="chapters.length" class="hidden md:flex absolute right-20 top-0 bottom-0 h-full items-end">
        <div class="cursor-pointer text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="showChapters">
          <span class="material-icons text-3xl">format_list_bulleted</span>
        </div>
      </div>
      <div class="absolute top-0 bottom-0 h-full hidden md:flex items-end" :class="chapters.length ? ' right-32' : 'right-20'">
        <div class="cursor-pointer text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="showBookmarks">
          <span class="material-icons" style="font-size: 1.7rem">{{ bookmarks.length ? 'bookmarks' : 'bookmark_border' }}</span>
        </div>
      </div>
      <div class="absolute top-0 bottom-0 h-full hidden md:flex items-end" :class="chapters.length ? ' right-44' : 'right-32'">
        <controls-volume-control ref="volumeControl" v-model="volume" @input="setVolume" />
      </div>

      <div class="flex pb-4 md:pb-2">
        <div class="flex-grow" />
        <template v-if="!loading">
          <div class="cursor-pointer flex items-center justify-center text-gray-300 mr-8" @mousedown.prevent @mouseup.prevent @click.stop="restart">
            <span class="material-icons text-3xl">first_page</span>
          </div>
          <div class="cursor-pointer flex items-center justify-center text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="jumpBackward">
            <span class="material-icons text-3xl">replay_10</span>
          </div>
          <div class="cursor-pointer p-2 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-8" :class="seekLoading ? 'animate-spin' : ''" @mousedown.prevent @mouseup.prevent @click.stop="playPause">
            <span class="material-icons">{{ seekLoading ? 'autorenew' : paused ? 'play_arrow' : 'pause' }}</span>
          </div>
          <div class="cursor-pointer flex items-center justify-center text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="jumpForward">
            <span class="material-icons text-3xl">forward_10</span>
          </div>
          <controls-playback-speed-control v-model="playbackRate" @input="playbackRateUpdated" @change="playbackRateChanged" />
        </template>
        <template v-else>
          <div class="cursor-pointer p-2 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-8 animate-spin">
            <span class="material-icons">autorenew</span>
          </div>
        </template>

        <div class="flex-grow" />
      </div>
    </div>
    <div class="relative">
      <!-- Track -->
      <div ref="track" class="w-full h-2 bg-gray-700 relative cursor-pointer transform duration-100 hover:scale-y-125 overflow-hidden" @mousemove="mousemoveTrack" @mouseleave="mouseleaveTrack" @click.stop="clickTrack">
        <div ref="readyTrack" class="h-full bg-gray-600 absolute top-0 left-0 pointer-events-none" />
        <div ref="bufferTrack" class="h-full bg-gray-400 absolute top-0 left-0 pointer-events-none" />
        <div ref="playedTrack" class="h-full bg-gray-200 absolute top-0 left-0 pointer-events-none" />
        <div ref="trackCursor" class="h-full w-0.5 bg-gray-50 absolute top-0 left-0 opacity-0 pointer-events-none" />
        <div v-if="loading" class="h-full w-1/4 absolute left-0 top-0 loadingTrack pointer-events-none bg-white bg-opacity-25" />
      </div>
      <div ref="track" class="w-full h-2 relative overflow-hidden">
        <template v-for="(tick, index) in chapterTicks">
          <div :key="index" :style="{ left: tick.left + 'px' }" class="absolute top-0 w-px bg-white bg-opacity-30 h-1 pointer-events-none" />
        </template>
      </div>

      <!-- Hover timestamp -->
      <div ref="hoverTimestamp" class="absolute -top-8 left-0 bg-white text-black rounded-full opacity-0 pointer-events-none">
        <p ref="hoverTimestampText" class="text-xs font-mono text-center px-2 py-0.5 truncate whitespace-nowrap">00:00</p>
      </div>
      <div ref="hoverTimestampArrow" class="absolute -top-3 left-0 bg-white text-black rounded-full opacity-0 pointer-events-none">
        <div class="absolute -bottom-1.5 left-0 right-0 w-full flex justify-center">
          <div class="arrow-down" />
        </div>
      </div>
    </div>
    <div class="flex">
      <p ref="currentTimestamp" class="font-mono text-sm text-gray-100 pointer-events-auto">00:00:00</p>
      <p class="font-mono text-sm text-gray-100 pointer-events-auto">&nbsp;/&nbsp;{{ progressPercent }}%</p>
      <div class="flex-grow" />
      <p class="text-sm text-gray-300 pt-0.5">{{ currentChapterName }}</p>
      <div class="flex-grow" />
      <p class="font-mono text-sm text-gray-100 pointer-events-auto">{{ timeRemainingPretty }}</p>
    </div>

    <modals-chapters-modal v-model="showChaptersModal" :current-chapter="currentChapter" :chapters="chapters" @select="selectChapter" />
  </div>
</template>

<script>
export default {
  props: {
    loading: Boolean,
    paused: Boolean,
    chapters: {
      type: Array,
      default: () => []
    },
    bookmarks: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      volume: 1,
      playbackRate: 1,
      trackWidth: 0,
      playedTrackWidth: 0,
      bufferTrackWidth: 0,
      readyTrackWidth: 0,
      audioEl: null,
      seekLoading: false,
      showChaptersModal: false,
      currentTime: 0,
      trackOffsetLeft: 16, // Track is 16px from edge
      duration: 0
    }
  },
  computed: {
    token() {
      return this.$store.getters['user/getToken']
    },
    timeRemaining() {
      return (this.duration - this.currentTime) / this.playbackRate
    },
    timeRemainingPretty() {
      if (this.timeRemaining < 0) {
        console.warn('Time remaining < 0', this.duration, this.currentTime, this.timeRemaining)
        return this.$secondsToTimestamp(this.timeRemaining * -1)
      }
      return '-' + this.$secondsToTimestamp(this.timeRemaining)
    },
    progressPercent() {
      if (!this.duration) return 0
      return Math.round((100 * this.currentTime) / this.duration)
    },
    chapterTicks() {
      return this.chapters.map((chap) => {
        var perc = chap.start / this.duration
        return {
          title: chap.title,
          left: perc * this.trackWidth
        }
      })
    },
    currentChapter() {
      return this.chapters.find((chapter) => chapter.start <= this.currentTime && this.currentTime < chapter.end)
    },
    currentChapterName() {
      return this.currentChapter ? this.currentChapter.title : ''
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    }
  },
  methods: {
    setDuration(duration) {
      this.duration = duration
    },
    setCurrentTime(time) {
      this.currentTime = time
      this.updateTimestamp()
      this.updatePlayedTrack()
    },
    playPause() {
      this.$emit('playPause')
    },
    jumpBackward() {
      this.$emit('jumpBackward')
    },
    jumpForward() {
      this.$emit('jumpForward')
    },
    increaseVolume() {
      if (this.volume >= 1) return
      this.volume = Math.min(1, this.volume + 0.1)
      this.setVolume(this.volume)
    },
    decreaseVolume() {
      if (this.volume <= 0) return
      this.volume = Math.max(0, this.volume - 0.1)
      this.setVolume(this.volume)
    },
    setVolume(volume) {
      this.$emit('setVolume', volume)
    },
    toggleMute() {
      if (this.$refs.volumeControl && this.$refs.volumeControl.toggleMute) {
        this.$refs.volumeControl.toggleMute()
      }
    },
    increasePlaybackRate() {
      var rates = [0.25, 0.5, 0.8, 1, 1.3, 1.5, 2, 2.5, 3]
      var currentRateIndex = rates.findIndex((r) => r === this.playbackRate)
      if (currentRateIndex >= rates.length - 1) return
      this.playbackRate = rates[currentRateIndex + 1] || 1
      this.playbackRateChanged(this.playbackRate)
    },
    decreasePlaybackRate() {
      var rates = [0.25, 0.5, 0.8, 1, 1.3, 1.5, 2, 2.5, 3]
      var currentRateIndex = rates.findIndex((r) => r === this.playbackRate)
      if (currentRateIndex <= 0) return
      this.playbackRate = rates[currentRateIndex - 1] || 1
      this.playbackRateChanged(this.playbackRate)
    },
    setPlaybackRate(playbackRate) {
      this.$emit('setPlaybackRate', playbackRate)
    },
    selectChapter(chapter) {
      this.seek(chapter.start)
      this.showChaptersModal = false
    },
    seek(time) {
      this.$emit('seek', time)
    },
    playbackRateUpdated(playbackRate) {
      this.setPlaybackRate(playbackRate)
    },
    playbackRateChanged(playbackRate) {
      this.setPlaybackRate(playbackRate)
      this.$store.dispatch('user/updateUserSettings', { playbackRate }).catch((err) => {
        console.error('Failed to update settings', err)
      })
    },
    mousemoveTrack(e) {
      var offsetX = e.offsetX
      var time = (offsetX / this.trackWidth) * this.duration
      if (this.$refs.hoverTimestamp) {
        var width = this.$refs.hoverTimestamp.clientWidth
        this.$refs.hoverTimestamp.style.opacity = 1
        var posLeft = offsetX - width / 2
        if (posLeft + width + this.trackOffsetLeft > window.innerWidth) {
          posLeft = window.innerWidth - width - this.trackOffsetLeft
        } else if (posLeft < -this.trackOffsetLeft) {
          posLeft = -this.trackOffsetLeft
        }
        this.$refs.hoverTimestamp.style.left = posLeft + 'px'
      }

      if (this.$refs.hoverTimestampArrow) {
        var width = this.$refs.hoverTimestampArrow.clientWidth
        var posLeft = offsetX - width / 2
        this.$refs.hoverTimestampArrow.style.opacity = 1
        this.$refs.hoverTimestampArrow.style.left = posLeft + 'px'
      }
      if (this.$refs.hoverTimestampText) {
        var hoverText = this.$secondsToTimestamp(time)

        var chapter = this.chapters.find((chapter) => chapter.start <= time && time < chapter.end)
        if (chapter && chapter.title) {
          hoverText += ` - ${chapter.title}`
        }
        this.$refs.hoverTimestampText.innerText = hoverText
      }
      if (this.$refs.trackCursor) {
        this.$refs.trackCursor.style.opacity = 1
        this.$refs.trackCursor.style.left = offsetX - 1 + 'px'
      }
    },
    mouseleaveTrack() {
      if (this.$refs.hoverTimestamp) {
        this.$refs.hoverTimestamp.style.opacity = 0
      }
      if (this.$refs.hoverTimestampArrow) {
        this.$refs.hoverTimestampArrow.style.opacity = 0
      }
      if (this.$refs.trackCursor) {
        this.$refs.trackCursor.style.opacity = 0
      }
    },
    restart() {
      this.seek(0)
    },
    setStreamReady() {
      this.readyTrackWidth = this.trackWidth
      this.$refs.readyTrack.style.width = this.trackWidth + 'px'
    },
    setChunksReady(chunks, numSegments) {
      var largestSeg = 0
      for (let i = 0; i < chunks.length; i++) {
        var chunk = chunks[i]
        if (typeof chunk === 'string') {
          var chunkRange = chunk.split('-').map((c) => Number(c))
          if (chunkRange.length < 2) continue
          if (chunkRange[1] > largestSeg) largestSeg = chunkRange[1]
        } else if (chunk > largestSeg) {
          largestSeg = chunk
        }
      }
      var percentageReady = largestSeg / numSegments
      var widthReady = Math.round(this.trackWidth * percentageReady)
      if (this.readyTrackWidth === widthReady) return
      this.readyTrackWidth = widthReady
      this.$refs.readyTrack.style.width = widthReady + 'px'
    },
    updateTimestamp() {
      var ts = this.$refs.currentTimestamp
      if (!ts) {
        console.error('No timestamp el')
        return
      }
      var currTimeClean = this.$secondsToTimestamp(this.currentTime)
      ts.innerText = currTimeClean
    },
    updatePlayedTrack() {
      var perc = this.currentTime / this.duration
      var ptWidth = Math.round(perc * this.trackWidth)
      if (this.playedTrackWidth === ptWidth) {
        return
      }
      this.$refs.playedTrack.style.width = ptWidth + 'px'
      this.playedTrackWidth = ptWidth
    },
    clickTrack(e) {
      if (this.loading) return

      var offsetX = e.offsetX
      var perc = offsetX / this.trackWidth
      var time = perc * this.duration
      if (isNaN(time) || time === null) {
        console.error('Invalid time', perc, time)
        return
      }
      this.seek(time)
    },
    setBufferTime(bufferTime) {
      if (!this.audioEl) {
        return
      }
      var bufferlen = (bufferTime / this.duration) * this.trackWidth
      bufferlen = Math.round(bufferlen)
      if (this.bufferTrackWidth === bufferlen || !this.$refs.bufferTrack) return
      this.$refs.bufferTrack.style.width = bufferlen + 'px'
      this.bufferTrackWidth = bufferlen
    },
    showChapters() {
      if (!this.chapters.length) return
      this.showChaptersModal = !this.showChaptersModal
    },
    showBookmarks() {
      this.$emit('showBookmarks', this.currentTime)
    },
    init() {
      this.playbackRate = this.$store.getters['user/getUserSetting']('playbackRate') || 1
      this.$emit('setPlaybackRate', this.playbackRate)
      this.setTrackWidth()
    },
    setTrackWidth() {
      if (this.$refs.track) {
        this.trackWidth = this.$refs.track.clientWidth
      } else {
        console.error('Track not loaded', this.$refs)
      }
    },
    settingsUpdated(settings) {
      if (settings.playbackRate && this.playbackRate !== settings.playbackRate) {
        this.setPlaybackRate(settings.playbackRate)
      }
    },
    closePlayer() {
      if (this.loading) return
      this.$emit('close')
    },
    hotkey(action) {
      if (action === this.$hotkeys.AudioPlayer.PLAY_PAUSE) this.playPause()
      else if (action === this.$hotkeys.AudioPlayer.JUMP_FORWARD) this.jumpForward()
      else if (action === this.$hotkeys.AudioPlayer.JUMP_BACKWARD) this.jumpBackward()
      else if (action === this.$hotkeys.AudioPlayer.VOLUME_UP) this.increaseVolume()
      else if (action === this.$hotkeys.AudioPlayer.VOLUME_DOWN) this.decreaseVolume()
      else if (action === this.$hotkeys.AudioPlayer.MUTE_UNMUTE) this.toggleMute()
      else if (action === this.$hotkeys.AudioPlayer.SHOW_CHAPTERS) this.showChapters()
      else if (action === this.$hotkeys.AudioPlayer.INCREASE_PLAYBACK_RATE) this.increasePlaybackRate()
      else if (action === this.$hotkeys.AudioPlayer.DECREASE_PLAYBACK_RATE) this.decreasePlaybackRate()
      else if (action === this.$hotkeys.AudioPlayer.CLOSE) this.closePlayer()
    },
    windowResize() {
      this.setTrackWidth()
    }
  },
  mounted() {
    window.addEventListener('resize', this.windowResize)
    this.$store.commit('user/addSettingsListener', { id: 'audioplayer', meth: this.settingsUpdated })
    this.init()
    this.$eventBus.$on('player-hotkey', this.hotkey)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.windowResize)
    this.$store.commit('user/removeSettingsListener', 'audioplayer')
    this.$eventBus.$off('player-hotkey', this.hotkey)
  }
}
</script>

<style>
.loadingTrack {
  animation-name: loadingTrack;
  animation-duration: 1s;
  animation-iteration-count: infinite;
}
@keyframes loadingTrack {
  0% {
    left: -25%;
  }
  100% {
    left: 100%;
  }
}
</style>