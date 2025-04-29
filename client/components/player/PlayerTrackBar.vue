<template>
  <div class="relative">
    <!-- Track -->
    <div ref="track" class="w-full h-2 bg-gray-700 relative cursor-pointer transform duration-100 hover:scale-y-125 overflow-hidden" @mousemove="mousemoveTrack" @mouseleave="mouseleaveTrack" @click.stop="clickTrack">
      <div ref="readyTrack" class="h-full bg-gray-600 absolute top-0 left-0 pointer-events-none" />
      <div ref="bufferTrack" class="h-full bg-gray-500 absolute top-0 left-0 pointer-events-none" />
      <div ref="playedTrack" class="h-full bg-gray-200 absolute top-0 left-0 pointer-events-none" />
      <div ref="trackCursor" class="h-full w-0.5 bg-gray-50 absolute top-0 left-0 opacity-0 pointer-events-none" />
      <div v-if="loading" class="h-full w-1/4 absolute left-0 top-0 loadingTrack pointer-events-none bg-white/25" />
    </div>
    <div class="w-full h-2 relative overflow-hidden" :class="useChapterTrack ? 'opacity-0' : ''">
      <template v-for="(tick, index) in chapterTicks">
        <div :key="index" :style="{ left: tick.left + 'px' }" class="absolute top-0 w-px bg-white/30 h-1 pointer-events-none" />
      </template>
    </div>

    <!-- Hover timestamp -->
    <div ref="hoverTimestamp" class="absolute -top-8 left-0 bg-white text-black rounded-full opacity-0 pointer-events-none z-10">
      <p ref="hoverTimestampText" class="text-xs font-mono text-center px-2 py-0.5 truncate whitespace-nowrap">00:00</p>
    </div>
    <div ref="hoverTimestampArrow" class="absolute -top-3 left-0 bg-white text-black rounded-full opacity-0 pointer-events-none">
      <div class="absolute -bottom-1.5 left-0 right-0 w-full flex justify-center">
        <div class="arrow-down" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    loading: Boolean,
    duration: Number,
    chapters: {
      type: Array,
      default: () => []
    },
    currentChapter: {
      type: Object,
      default: () => {}
    },
    playbackRate: Number
  },
  data() {
    return {
      trackWidth: 0,
      currentTime: 0,
      percentReady: 0,
      bufferTime: 0,
      chapterTicks: [],
      trackOffsetLeft: 16, // Track is 16px from edge
      playedTrackWidth: 0,
      readyTrackWidth: 0,
      bufferTrackWidth: 0,
      useChapterTrack: false
    }
  },
  watch: {
    duration: {
      handler() {
        this.setChapterTicks()
      }
    }
  },
  computed: {
    _playbackRate() {
      if (!this.playbackRate || isNaN(this.playbackRate)) return 1
      return this.playbackRate
    },
    currentChapterDuration() {
      if (!this.currentChapter) return 0
      return this.currentChapter.end - this.currentChapter.start
    },
    currentChapterStart() {
      if (!this.currentChapter) return 0
      return this.currentChapter.start
    },
    isMobile() {
      return this.$store.state.globals.isMobile
    }
  },
  methods: {
    setUseChapterTrack(useChapterTrack) {
      this.useChapterTrack = useChapterTrack
      this.updateBufferTrack()
      this.updatePlayedTrackWidth()
    },
    clickTrack(e) {
      if (this.loading) return

      const offsetX = e.offsetX
      const perc = offsetX / this.trackWidth
      const baseTime = this.useChapterTrack ? this.currentChapterStart : 0
      const duration = this.useChapterTrack ? this.currentChapterDuration : this.duration
      const time = baseTime + perc * duration
      if (isNaN(time) || time === null) {
        console.error('Invalid time', perc, time)
        return
      }
      this.$emit('seek', time)
    },
    setBufferTime(time) {
      this.bufferTime = time
      this.updateBufferTrack()
    },
    updateBufferTrack() {
      const time = this.useChapterTrack ? Math.max(0, this.bufferTime - this.currentChapterStart) : this.bufferTime
      const duration = this.useChapterTrack ? this.currentChapterDuration : this.duration

      var bufferlen = (time / duration) * this.trackWidth
      bufferlen = Math.round(bufferlen)
      if (this.bufferTrackWidth === bufferlen || !this.$refs.bufferTrack) return
      if (this.$refs.bufferTrack) this.$refs.bufferTrack.style.width = bufferlen + 'px'
      this.bufferTrackWidth = bufferlen
    },
    setPercentageReady(percent) {
      this.percentReady = percent
      this.updateReadyTrack()
    },
    updateReadyTrack() {
      const widthReady = Math.round(this.trackWidth * this.percentReady)
      if (this.readyTrackWidth === widthReady) return
      this.readyTrackWidth = widthReady
      if (this.$refs.readyTrack) this.$refs.readyTrack.style.width = widthReady + 'px'
    },
    setCurrentTime(time) {
      this.currentTime = time
      this.updatePlayedTrackWidth()
    },
    updatePlayedTrackWidth() {
      const time = this.useChapterTrack ? Math.max(0, this.currentTime - this.currentChapterStart) : this.currentTime
      const duration = this.useChapterTrack ? this.currentChapterDuration : this.duration

      const ptWidth = Math.round((time / duration) * this.trackWidth)
      if (this.playedTrackWidth === ptWidth) {
        return
      }
      if (this.$refs.playedTrack) this.$refs.playedTrack.style.width = ptWidth + 'px'
      this.playedTrackWidth = ptWidth
    },
    setChapterTicks() {
      this.chapterTicks = this.chapters.map((chap) => {
        const perc = chap.start / this.duration
        return {
          title: chap.title,
          left: perc * this.trackWidth
        }
      })
    },
    mousemoveTrack(e) {
      if (this.isMobile) {
        return
      }
      const offsetX = e.offsetX

      const baseTime = this.useChapterTrack ? this.currentChapterStart : 0
      const duration = this.useChapterTrack ? this.currentChapterDuration : this.duration
      const progressTime = (offsetX / this.trackWidth) * duration
      const totalTime = baseTime + progressTime

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
        var hoverText = this.$secondsToTimestamp(progressTime / this._playbackRate)

        var chapter = this.chapters.find((chapter) => chapter.start <= totalTime && totalTime < chapter.end)
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
    setTrackWidth() {
      if (this.$refs.track) {
        this.trackWidth = this.$refs.track.clientWidth
        this.trackOffsetLeft = this.$refs.track.getBoundingClientRect().left
      } else {
        console.error('Track not loaded', this.$refs)
      }
    },
    windowResize() {
      this.setTrackWidth()
      this.setChapterTicks()
      this.updatePlayedTrackWidth()
      this.updateBufferTrack()
    }
  },
  mounted() {
    this.setTrackWidth()
    this.setChapterTicks()
    window.addEventListener('resize', this.windowResize)
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.windowResize)
  }
}
</script>
