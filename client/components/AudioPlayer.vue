<template>
  <div class="w-full">
    <div class="w-full relative mb-4">
      <div class="absolute left-2 top-0 bottom-0 h-full flex items-center">
        <p ref="currentTimestamp" class="font-mono text-sm">00:00:00</p>
      </div>
      <div class="absolute right-2 top-0 bottom-0 h-full flex items-center">
        <p class="font-mono text-sm">{{ totalDurationPretty }}</p>
      </div>

      <div class="absolute right-24 top-0 bottom-0">
        <controls-volume-control v-model="volume" @input="updateVolume" />
      </div>
      <div class="flex my-2">
        <div class="flex-grow" />

        <template v-if="!loading">
          <div class="cursor-pointer flex items-center justify-center text-gray-300 mr-8" @mousedown.prevent @mouseup.prevent @click.stop="restart">
            <span class="material-icons text-3xl">first_page</span>
          </div>
          <div class="cursor-pointer flex items-center justify-center text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="backward10">
            <span class="material-icons text-3xl">replay_10</span>
          </div>
          <div class="cursor-pointer p-2 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-8" :class="seekLoading ? 'animate-spin' : ''" @mousedown.prevent @mouseup.prevent @click.stop="playPauseClick">
            <span class="material-icons">{{ seekLoading ? 'autorenew' : isPaused ? 'play_arrow' : 'pause' }}</span>
          </div>
          <div class="cursor-pointer flex items-center justify-center text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="forward10">
            <span class="material-icons text-3xl">forward_10</span>
          </div>
          <controls-playback-speed-control v-model="playbackRate" @change="updatePlaybackRate" />
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

      <!-- Hover timestamp -->
      <div ref="hoverTimestamp" class="absolute -top-8 left-0 bg-white text-black rounded-full opacity-0 pointer-events-none">
        <p ref="hoverTimestampText" class="text-xs font-mono text-center px-2 py-0.5">00:00</p>
        <div class="absolute -bottom-1.5 left-0 right-0 w-full flex justify-center">
          <div class="arrow-down" />
        </div>
      </div>
    </div>

    <audio ref="audio" @pause="paused" @playing="playing" @progress="progress" @timeupdate="timeupdate" @loadeddata="audioLoadedData" />
  </div>
</template>

<script>
import Hls from 'hls.js'

export default {
  props: {
    loading: Boolean
  },
  data() {
    return {
      hlsInstance: null,
      staleHlsInstance: null,
      volume: 0.5,
      playbackRate: 1,
      trackWidth: 0,
      isPaused: true,
      url: null,
      src: null,
      playedTrackWidth: 0,
      bufferTrackWidth: 0,
      readyTrackWidth: 0,
      audioEl: null,
      totalDuration: 0,
      seekedTime: 0,
      seekLoading: false
    }
  },
  computed: {
    token() {
      return this.$store.getters.getToken
    },
    totalDurationPretty() {
      return this.$secondsToTimestamp(this.totalDuration)
    }
  },
  methods: {
    seek(time) {
      if (this.loading) {
        return
      }
      if (this.seekLoading) {
        console.error('Already seek loading', this.seekedTime)
        return
      }
      if (!this.audioEl) {
        console.error('No Audio el for seek', time)
        return
      }
      this.seekedTime = time
      this.seekLoading = true
      console.warn('SEEK TO', this.$secondsToTimestamp(time))
      this.audioEl.currentTime = time

      if (this.$refs.playedTrack) {
        var perc = time / this.audioEl.duration
        var ptWidth = Math.round(perc * this.trackWidth)
        this.$refs.playedTrack.style.width = ptWidth + 'px'
        this.playedTrackWidth = ptWidth

        this.$refs.playedTrack.classList.remove('bg-gray-200')
        this.$refs.playedTrack.classList.add('bg-yellow-300')
      }
    },
    updateVolume(volume) {
      if (this.audioEl) {
        this.audioEl.volume = volume
      }
    },
    updatePlaybackRate(playbackRate) {
      if (this.audioEl) {
        console.log('UpdatePlaybackRate', playbackRate)
        this.audioEl.playbackRate = playbackRate
      } else {
        console.error('No Audio El updatePlaybackRate')
      }
    },
    mousemoveTrack(e) {
      var offsetX = e.offsetX
      var time = (offsetX / this.trackWidth) * this.totalDuration
      if (this.$refs.hoverTimestamp) {
        var width = this.$refs.hoverTimestamp.clientWidth
        this.$refs.hoverTimestamp.style.opacity = 1
        this.$refs.hoverTimestamp.style.left = offsetX - width / 2 + 'px'
      }
      if (this.$refs.hoverTimestampText) {
        this.$refs.hoverTimestampText.innerText = this.$secondsToTimestamp(time)
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
      if (this.$refs.trackCursor) {
        this.$refs.trackCursor.style.opacity = 0
      }
    },
    restart() {
      this.seek(0)
    },
    backward10() {
      var newTime = this.audioEl.currentTime - 10
      newTime = Math.max(0, newTime)
      this.seek(newTime)
    },
    forward10() {
      var newTime = this.audioEl.currentTime + 10
      newTime = Math.min(this.audioEl.duration, newTime)
      this.seek(newTime)
    },
    sendStreamUpdate() {
      if (!this.audioEl) return
      this.$emit('updateTime', this.audioEl.currentTime)
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
      if (!this.audioEl) {
        console.error('No Audio El')
        return
      }
      var currTimeClean = this.$secondsToTimestamp(this.audioEl.currentTime)
      ts.innerText = currTimeClean
    },
    clickTrack(e) {
      var offsetX = e.offsetX
      var perc = offsetX / this.trackWidth
      var time = perc * this.audioEl.duration
      if (isNaN(time) || time === null) {
        console.error('Invalid time', perc, time)
        return
      }
      this.seek(time)
    },
    playPauseClick() {
      if (this.isPaused) {
        this.play()
      } else {
        this.pause()
      }
    },
    isValidDuration(duration) {
      if (duration && !isNaN(duration) && duration !== Number.POSITIVE_INFINITY && duration !== Number.NEGATIVE_INFINITY) {
        return true
      }
      return false
    },
    getBufferedRanges() {
      if (!this.audioEl) return []

      const ranges = []
      const seekable = this.audioEl.buffered || []

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
    },
    getLastBufferedTime() {
      var bufferedRanges = this.getBufferedRanges()
      if (!bufferedRanges.length) return 0

      var buff = bufferedRanges.find((buff) => buff.start < this.audioEl.currentTime && buff.end > this.audioEl.currentTime)
      if (buff) return buff.end

      var last = bufferedRanges[bufferedRanges.length - 1]
      return last.end
    },
    progress() {
      if (!this.audioEl) {
        return
      }
      var lastbuff = this.getLastBufferedTime()
      this.sendStreamUpdate()
      var bufferlen = (lastbuff / this.audioEl.duration) * this.trackWidth
      bufferlen = Math.round(bufferlen)
      if (this.bufferTrackWidth === bufferlen || !this.$refs.bufferTrack) return
      this.$refs.bufferTrack.style.width = bufferlen + 'px'
      this.bufferTrackWidth = bufferlen
    },
    timeupdate() {
      // console.log('Time update', this.audioEl.currentTime)
      if (!this.$refs.playedTrack) {
        console.error('Invalid no played track ref')
        return
      }
      if (!this.audioEl) {
        console.error('No Audio El')
        return
      }

      if (this.seekLoading) {
        this.seekLoading = false
        if (this.$refs.playedTrack) {
          this.$refs.playedTrack.classList.remove('bg-yellow-300')
          this.$refs.playedTrack.classList.add('bg-gray-200')
        }
      }

      this.updateTimestamp()

      var perc = this.audioEl.currentTime / this.audioEl.duration
      var ptWidth = Math.round(perc * this.trackWidth)
      if (this.playedTrackWidth === ptWidth) {
        return
      }
      this.$refs.playedTrack.style.width = ptWidth + 'px'
      this.playedTrackWidth = ptWidth
    },
    paused() {
      if (!this.$refs.audio) {
        console.error('No audio on paused()')
        return
      }
      this.isPaused = this.$refs.audio.paused
    },
    playing() {
      if (!this.$refs.audio) {
        console.error('No audio on playing()')
        return
      }
      this.isPaused = this.$refs.audio.paused
    },
    audioLoadedData() {
      this.totalDuration = this.audioEl.duration
    },
    set(url, currentTime, playOnLoad = false) {
      if (this.hlsInstance) {
        this.terminateStream()
      }
      if (!this.$refs.audio) {
        console.error('No audio widget')
        return
      }
      this.url = url
      if (process.env.NODE_ENV === 'development') {
        url = `${process.env.serverUrl}${url}`
      }
      this.src = url
      console.log('[AudioPlayer-Set] Set url', url)

      var hlsOptions = {
        startPosition: currentTime || -1,
        xhrSetup: (xhr) => {
          xhr.setRequestHeader('Authorization', `Bearer ${this.token}`)
        }
      }
      console.log('[AudioPlayer-Set] HLS Config', hlsOptions)
      this.hlsInstance = new Hls(hlsOptions)
      var audio = this.$refs.audio
      audio.volume = this.volume
      audio.playbackRate = this.playbackRate
      this.hlsInstance.attachMedia(audio)
      this.hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
        // console.log('[HLS] MEDIA ATTACHED')
        this.hlsInstance.loadSource(url)

        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
          console.log('[HLS] Manifest Parsed')
          if (playOnLoad) {
            audio.play()
          }
        })

        this.hlsInstance.on(Hls.Events.ERROR, (e, data) => {
          console.error('[HLS] Error', data.type, data.details)
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            console.error('[HLS] BUFFER STALLED ERROR')
          }
        })
        this.hlsInstance.on(Hls.Events.DESTROYING, () => {
          console.warn('[HLS] Destroying HLS Instance')
        })
      })
    },
    play() {
      if (!this.$refs.audio) {
        console.error('No Audio ref')
        return
      }
      this.$refs.audio.play()
    },
    pause() {
      if (!this.$refs.audio) return
      this.$refs.audio.pause()
    },
    terminateStream() {
      if (this.hlsInstance) {
        if (!this.hlsInstance.destroy) {
          console.error('HLS Instance has no destroy property', this.hlsInstance)
          return
        }
        this.staleHlsInstance = this.hlsInstance
        this.staleHlsInstance.destroy()
        this.hlsInstance = null
        console.log('Terminated HLS Instance', this.staleHlsInstance)
      }
    },
    async resetStream(startTime) {
      if (this.$refs.audio) this.$refs.audio.pause()
      this.terminateStream()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log('Waited 1 second after terminating stream to start again')
      this.set(this.url, startTime, true)
    },
    init() {
      this.audioEl = this.$refs.audio
      if (this.$refs.track) {
        this.trackWidth = this.$refs.track.clientWidth
      } else {
        console.error('Track not loaded', this.$refs)
      }
    }
  },
  mounted() {
    // this.$nextTick(this.init)
    this.init()
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