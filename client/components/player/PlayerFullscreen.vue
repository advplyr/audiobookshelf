<template>
  <div id="playerFullscreen" class="fixed inset-0 w-full h-full flex flex-col bg-black text-white overflow-hidden" style="z-index: 100">
    <div class="absolute inset-0 w-full h-full overflow-hidden">
      <div class="absolute inset-0 w-full h-full bg-cover bg-center scale-110" :style="{ backgroundImage: `url(${cover})`, filter: 'blur(60px) brightness(0.55)' }" />
      <div class="absolute inset-0 w-full h-full bg-linear-to-b from-black/10 via-black/40 to-black" />
    </div>

    <div class="corner-zone absolute top-0 left-0 z-20 w-40 h-28 pt-4 pl-5">
      <button :aria-label="$strings.LabelClosePlayer" class="corner-btn flex items-center justify-center w-10 h-10 rounded-full text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 backdrop-blur-sm" @click="minimize">
        <span class="material-symbols text-2xl">keyboard_arrow_down</span>
      </button>
    </div>

    <!-- No overflow-hidden here: it would clip the speed/volume popups. The root already clips. -->
    <div class="relative z-10 flex grow min-h-0">
      <div ref="coverColumn" class="flex flex-col grow min-w-0 min-h-0 items-center justify-center px-6 pt-14 pb-2">
        <div class="relative shrink-0 group" :style="{ width: coverPxWidth + 'px', height: coverPxWidth * (coverAspectRatio || 1) + 'px' }">
          <svg ref="ringSvg" class="absolute cursor-pointer" :style="{ top: -ringPad + 'px', left: -ringPad + 'px', width: ringW + 'px', height: ringH + 'px' }" :viewBox="`0 0 ${ringW} ${ringH}`">
            <rect :x="ringStroke / 2" :y="ringStroke / 2" :width="ringW - ringStroke" :height="ringH - ringStroke" :rx="ringRadius" fill="none" stroke="rgba(255,255,255,0.18)" :stroke-width="ringStroke" style="pointer-events: none" />
            <rect
              :x="ringStroke / 2"
              :y="ringStroke / 2"
              :width="ringW - ringStroke"
              :height="ringH - ringStroke"
              :rx="ringRadius"
              fill="none"
              stroke="white"
              stroke-linecap="round"
              :stroke-width="isDraggingRing ? ringStroke + 2 : ringStroke"
              pathLength="100"
              :stroke-dasharray="`${displayRingPercent} ${100 - displayRingPercent}`"
              :stroke-dashoffset="-ringStartOffset"
              style="pointer-events: none; transition: stroke-width 0.1s ease"
            />
            <rect :x="ringStroke / 2" :y="ringStroke / 2" :width="ringW - ringStroke" :height="ringH - ringStroke" :rx="ringRadius" fill="none" stroke="transparent" :stroke-width="ringHitWidth" style="pointer-events: stroke" @mousedown="startRingDrag" />
          </svg>
          <div class="w-full h-full rounded-2xl overflow-hidden shadow-2xl" style="box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6)">
            <covers-book-cover :library-item="libraryItem" :width="coverPxWidth" :book-cover-aspect-ratio="coverAspectRatio" />
          </div>
          <div class="absolute inset-0 rounded-2xl bg-black/55 transition-opacity duration-200 flex items-center justify-center pointer-events-none" :class="isDraggingRing ? 'opacity-100' : 'opacity-0'">
            <p class="font-mono text-sm text-white">{{ $secondsToTimestamp(displayRingTime / _playbackRate) }} / {{ $secondsToTimestamp(duration / _playbackRate) }}</p>
          </div>

          <!-- Jump feedback burst — the only visible confirmation when the jump came from a hotkey -->
          <div v-if="jumpBurst" :key="jumpBurstKey" class="jump-burst absolute inset-0 rounded-2xl flex items-center justify-center pointer-events-none z-20" :class="jumpBurst.direction === 'backward' ? 'jump-burst-back' : 'jump-burst-fwd'">
            <div class="jump-burst-pill flex flex-col items-center justify-center gap-0.5 w-24 h-24 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-white/15">
              <span class="jump-burst-icon material-symbols text-3xl leading-none">{{ jumpBurst.direction === 'backward' ? 'replay' : 'forward_media' }}</span>
              <span class="font-mono text-sm font-semibold tabular-nums leading-none">{{ jumpBurstLabel }}</span>
            </div>
          </div>

          <!-- pl-5 (not ml-5) so the gap between cover and stack is part of the hover target -->
          <div class="fab-stack absolute z-30 top-1/2 -translate-y-1/2 left-full pl-5 flex flex-col items-center gap-1.5 pointer-events-none group-hover:pointer-events-auto">
            <div class="fab-slot flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/15">
              <controls-volume-control ref="volumeControl" v-model="volume" @input="setVolume" />
            </div>

            <!-- inline margin resets the shared control's ml-4/sm:ml-8 so it centers in the slot -->
            <div class="fab-slot flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/15">
              <controls-playback-speed-control style="margin-left: 0" :menu-left-offset="14" v-model="playbackRate" @input="setPlaybackRate" @change="playbackRateChanged" :playbackRateIncrementDecrement="playbackRateIncrementDecrement" />
            </div>

            <button v-if="!hideSleepTimer" :aria-label="$strings.LabelSleepTimer" class="text-gray-300 hover:text-white flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/15" @click.stop="$emit('showSleepTimer')">
              <span v-if="!sleepTimerSet" class="material-symbols text-2xl">snooze</span>
              <div v-else class="flex items-center">
                <span class="material-symbols text-lg text-warning">snooze</span>
                <p class="text-sm text-warning font-semibold text-center px-0.5">{{ sleepTimerRemainingString }}</p>
              </div>
            </button>

            <button v-if="!isPodcast && !hideBookmarks" :aria-label="$strings.LabelViewBookmarks" class="text-gray-300 hover:text-white flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/15" @click.stop="$emit('showBookmarks')">
              <span class="material-symbols text-2xl">{{ bookmarks.length ? 'bookmarks' : 'bookmark_border' }}</span>
            </button>
          </div>
        </div>

        <div class="w-full max-w-xl mt-5 text-center shrink-0">
          <nuxt-link :to="`/item/${libraryItemId}`" class="hover:underline cursor-pointer text-xl sm:text-2xl font-bold block truncate">{{ title }}</nuxt-link>
          <p v-if="podcastAuthor" class="text-gray-300 truncate mt-1 text-base">{{ podcastAuthor }}</p>
          <p v-else-if="authors.length" class="text-gray-300 truncate mt-1 text-base">
            <nuxt-link v-for="(author, index) in authors" :key="index" :to="`/author/${author.id}`" class="hover:underline">{{ author.name }}<span v-if="index < authors.length - 1">,&nbsp;</span></nuxt-link>
          </p>
          <p class="font-mono text-lg text-gray-300 mt-2">{{ $secondsToTimestamp(displayRingTime / _playbackRate) }} <span class="text-gray-600">/</span> {{ $secondsToTimestamp(duration / _playbackRate) }}</p>
        </div>
      </div>

      <transition name="chapter-panel">
        <div v-if="showChapterPanel" class="chapter-panel-wrap shrink-0 w-96 max-w-full h-full p-3 pl-0">
          <div class="w-full h-full bg-neutral-950/97 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div class="flex items-center px-5 py-4 shrink-0 border-b border-white/10">
              <p class="text-sm uppercase tracking-widest text-gray-300">{{ $strings.LabelChapters || 'Chapters' }}</p>
              <div class="grow" />
              <button :aria-label="$strings.LabelClosePlayer" class="material-symbols text-xl text-gray-400 hover:text-white flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10" @click="showChapterPanel = false">close</button>
            </div>
            <div ref="chapterList" class="grow overflow-y-auto px-2 py-2">
              <div v-for="chap in chapters" :key="chap.id" :id="`fs-chapter-row-${chap.id}`" class="flex items-center px-3 py-3 rounded-lg cursor-pointer relative" :class="chap.id === currentChapterId ? 'bg-yellow-400/20 hover:bg-yellow-400/10' : 'hover:bg-white/10'" @click="selectChapter(chap)">
                <p class="truncate text-sm pr-2">{{ chap.title }}</p>
                <div class="grow" />
                <span class="font-mono text-xs text-gray-400 whitespace-nowrap">{{ $secondsToTimestamp(chap.start / _playbackRate) }}</span>
                <div v-show="chap.id === currentChapterId" class="w-1 h-3/5 absolute top-1/2 -translate-y-1/2 left-0 rounded-full bg-yellow-400" />
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <div class="relative z-10 shrink-0 bg-black px-6 pt-3 pb-5 lg:px-10 lg:pb-6">
      <div class="grid items-end gap-4" style="grid-template-columns: 1fr minmax(260px, 560px) 1fr">
        <div />

        <div class="w-full min-w-0">
          <div class="flex items-center justify-center gap-2 mb-2">
            <p v-if="currentChapterName" class="text-sm text-gray-300 truncate">{{ currentChapterName }}</p>
            <span v-else class="text-sm text-gray-500">{{ $strings.LabelChapter || 'Chapter' }}</span>
            <span class="font-mono text-xs text-gray-500 shrink-0">· {{ chapterProgressPercent }}%</span>
          </div>

          <div class="flex items-center gap-2.5">
            <!-- -mt-1 offsets the 8px chapter-tick strip the track bar renders below its 10px bar, so the timestamps center on the bar itself -->
            <p ref="chapterCurrentTimestamp" class="font-mono text-base text-gray-300 leading-none shrink-0 w-24 text-right -mt-1">00:00:00</p>
            <div class="grow min-w-0">
              <player-track-bar ref="chapterTrackBar" rounded :loading="loading" :duration="duration" :current-chapter="currentChapter" :playback-rate="playbackRate" @seek="seek" />
            </div>
            <p ref="chapterRemainingTimestamp" class="font-mono text-base text-gray-300 leading-none shrink-0 w-24 -mt-1">00:00:00</p>
          </div>

          <player-playback-controls white-play-button no-tooltips class="mt-1" :loading="loading" :seek-loading="seekLoading" :paused="paused" :hasNextChapter="hasNextChapter" :hasNextItemInQueue="hasNextItemInQueue" @prevChapter="prevChapter" @next="goToNext" @jumpForward="jumpForward" @jumpBackward="jumpBackward" @playPause="playPause" />
        </div>

        <div class="flex items-center gap-2.5 justify-self-end pr-1">
          <!-- Only surfaces once the rate is off 1x - the speed menu on the artwork stays the primary control -->
          <transition name="speed-pill">
            <div v-if="isPlaybackRateModified" class="speed-pill flex items-center h-8 pl-0.5 pr-0.5 rounded-full bg-accent/15 text-accent">
              <ui-tooltip direction="top" :text="$strings.ButtonSlower || 'Slower'">
                <button :aria-label="$strings.ButtonSlower || 'Slower'" :disabled="!canDecrementPlaybackRate" class="speed-pill-btn flex items-center justify-center w-7 h-7 rounded-full hover:bg-accent/25 disabled:opacity-40 disabled:hover:bg-transparent" @click.stop="decrementPlaybackRate">
                  <span class="material-symbols text-base">remove</span>
                </button>
              </ui-tooltip>

              <ui-tooltip direction="top" :text="$strings.ButtonResetToDefault || 'Reset to default'">
                <button :aria-label="$strings.ButtonResetToDefault || 'Reset to default'" class="speed-pill-value font-mono text-xs font-semibold tabular-nums px-1.5 h-7 rounded-full hover:bg-accent/25" @click.stop="resetPlaybackRate">{{ playbackRateDisplay }}x</button>
              </ui-tooltip>

              <ui-tooltip direction="top" :text="$strings.ButtonFaster || 'Faster'">
                <button :aria-label="$strings.ButtonFaster || 'Faster'" :disabled="!canIncrementPlaybackRate" class="speed-pill-btn flex items-center justify-center w-7 h-7 rounded-full hover:bg-accent/25 disabled:opacity-40 disabled:hover:bg-transparent" @click.stop="incrementPlaybackRate">
                  <span class="material-symbols text-base">add</span>
                </button>
              </ui-tooltip>
            </div>
          </transition>

          <button v-if="sleepTimerSet" :aria-label="$strings.LabelSleepTimer" class="flex items-center gap-1 h-8 pl-2 pr-2.5 rounded-full bg-warning/15 text-warning hover:bg-warning/25" @click.stop="$emit('showSleepTimer')">
            <span class="material-symbols text-lg">snooze</span>
            <span class="font-mono text-xs font-semibold">{{ sleepTimerRemainingString }}</span>
          </button>

          <button v-if="chapters.length" :aria-label="$strings.LabelViewChapters || 'Chapters'" class="mx-1 flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10" :class="showChapterPanel ? 'text-accent' : 'text-gray-300 hover:text-white'" @click.stop="showChapterPanel = !showChapterPanel">
            <span class="material-symbols text-2xl">queue_music</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => null
    },
    title: String,
    authors: {
      type: Array,
      default: () => []
    },
    podcastAuthor: String,
    cover: String,
    coverAspectRatio: Number,
    loading: Boolean,
    paused: Boolean,
    chapters: {
      type: Array,
      default: () => []
    },
    currentChapter: Object,
    bookmarks: {
      type: Array,
      default: () => []
    },
    sleepTimerSet: Boolean,
    sleepTimerRemaining: Number,
    sleepTimerType: String,
    isPodcast: Boolean,
    hideBookmarks: Boolean,
    hideSleepTimer: Boolean,
    hasNextItemInQueue: Boolean
  },
  data() {
    return {
      volume: 1,
      playbackRate: 1,
      seekLoading: false,
      showChapterPanel: false,
      currentTime: 0,
      duration: 0,
      ringStroke: 6,
      ringHitWidth: 26,
      coverRadius: 16, // must match the artwork's rounded-2xl
      ringPad: 6, // == ringStroke, so the ring's inner edge sits flush on the cover edge
      coverPxWidth: 420,
      ringSamples: [],
      isDraggingRing: false,
      dragPercent: null,
      MIN_PLAYBACK_RATE: 0.5, // must match controls/PlaybackSpeedControl
      MAX_PLAYBACK_RATE: 10,
      jumpBurst: null,
      jumpBurstKey: 0,
      jumpBurstTimeout: null
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem?.id || null
    },
    jumpForwardAmount() {
      return this.$store.getters['user/getUserSetting']('jumpForwardAmount') || 10
    },
    jumpBackwardAmount() {
      return this.$store.getters['user/getUserSetting']('jumpBackwardAmount') || 10
    },
    jumpBurstLabel() {
      if (!this.jumpBurst) return ''
      const sign = this.jumpBurst.direction === 'backward' ? '−' : '+'
      return `${sign}${this.jumpBurst.amount}s`
    },
    // Concentric with the artwork corners: the ring stroke centerline sits
    // (ringPad - ringStroke/2) outside the cover edge.
    ringRadius() {
      return this.coverRadius + this.ringPad - this.ringStroke / 2
    },
    ringW() {
      return this.coverPxWidth + this.ringPad * 2
    },
    ringH() {
      return this.coverPxWidth * (this.coverAspectRatio || 1) + this.ringPad * 2
    },
    displayRingPercent() {
      return this.isDraggingRing && this.dragPercent !== null ? this.dragPercent : this.totalProgressPercent
    },
    displayRingTime() {
      if (this.isDraggingRing && this.dragPercent !== null) return (this.dragPercent / 100) * this.duration
      return this.currentTime
    },
    ringStartOffset() {
      // Fraction (0-100, matching pathLength) of the perimeter from the rect's
      // native path start (top edge) clockwise to the bottom-center point,
      // where we want the progress arc to begin.
      const w = this.ringW - this.ringStroke
      const h = this.ringH - this.ringStroke
      const r = Math.min(this.ringRadius, w / 2, h / 2)
      const segTop = w - 2 * r
      const segCornerArc = (Math.PI / 2) * r
      const segRight = h - 2 * r
      const segBottomToCenter = w / 2 - r
      const offsetLength = segTop + segCornerArc + segRight + segCornerArc + segBottomToCenter
      const perimeter = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r
      return (100 * offsetLength) / perimeter
    },
    currentChapterId() {
      return this.currentChapter?.id || null
    },
    currentChapterName() {
      return this.currentChapter?.title || ''
    },
    currentChapterDuration() {
      if (!this.currentChapter) return 0
      return this.currentChapter.end - this.currentChapter.start
    },
    currentChapterStart() {
      if (!this.currentChapter) return 0
      return this.currentChapter.start
    },
    currentChapterIndex() {
      if (!this.currentChapter) return 0
      return this.chapters.findIndex((ch) => ch.id === this.currentChapter.id)
    },
    hasNextChapter() {
      if (!this.chapters.length) return false
      return this.currentChapterIndex < this.chapters.length - 1
    },
    _playbackRate() {
      if (!this.playbackRate || isNaN(this.playbackRate)) return 1
      return this.playbackRate
    },
    totalProgressPercent() {
      if (!this.duration) return 0
      return Math.min(100, Math.round((100 * this.currentTime) / this.duration))
    },
    chapterProgressPercent() {
      if (!this.currentChapter || !this.currentChapterDuration) return 0
      const time = Math.max(0, this.currentTime - this.currentChapterStart)
      return Math.min(100, Math.round((100 * time) / this.currentChapterDuration))
    },
    playerQueueItems() {
      return this.$store.state.playerQueueItems || []
    },
    playbackRateIncrementDecrement() {
      return this.$store.getters['user/getUserSetting']('playbackRateIncrementDecrement')
    },
    isPlaybackRateModified() {
      return this._playbackRate !== 1
    },
    // Mirrors PlaybackSpeedControl's formatting so the pill and the menu never disagree
    playbackRateDisplay() {
      if (this.playbackRateIncrementDecrement == 0.05) return this._playbackRate.toFixed(2)
      const numDecimals = String(this._playbackRate).split('.')[1]?.length || 0
      if (numDecimals <= 1) return this._playbackRate.toFixed(1)
      return this._playbackRate.toFixed(2)
    },
    canIncrementPlaybackRate() {
      return this._playbackRate + this.playbackRateStep <= this.MAX_PLAYBACK_RATE
    },
    canDecrementPlaybackRate() {
      return this._playbackRate - this.playbackRateStep >= this.MIN_PLAYBACK_RATE
    },
    playbackRateStep() {
      return this.playbackRateIncrementDecrement || 0.1
    },
    sleepTimerRemainingString() {
      if (this.sleepTimerType === this.$constants.SleepTimerTypes.CHAPTER) {
        return 'EoC'
      }
      var rounded = Math.round(this.sleepTimerRemaining)
      if (rounded < 90) return `${rounded}s`
      var minutesRounded = Math.round(rounded / 60)
      if (minutesRounded <= 90) return `${minutesRounded}m`
      var hoursRounded = Math.round(minutesRounded / 60)
      return `${hoursRounded}h`
    }
  },
  methods: {
    minimize() {
      this.$store.commit('setPlayerIsFullscreen', false)
    },
    // Walk the rounded-rect perimeter clockwise from its native SVG path start
    // (top edge) and return the {x, y} point at arc-length `s`.
    getRingPointAtArcLength(s) {
      const w = this.ringW - this.ringStroke
      const h = this.ringH - this.ringStroke
      const r = Math.min(this.ringRadius, w / 2, h / 2)
      const x0 = this.ringStroke / 2
      const y0 = this.ringStroke / 2
      const arc = (Math.PI / 2) * r
      const segTop = w - 2 * r
      const segRight = h - 2 * r
      const segBottom = w - 2 * r
      const segLeft = h - 2 * r

      let d = s
      if (d <= segTop) {
        return { x: x0 + r + d, y: y0 }
      }
      d -= segTop
      if (d <= arc) {
        const theta = -Math.PI / 2 + d / r
        return { x: x0 + w - r + r * Math.cos(theta), y: y0 + r + r * Math.sin(theta) }
      }
      d -= arc
      if (d <= segRight) {
        return { x: x0 + w, y: y0 + r + d }
      }
      d -= segRight
      if (d <= arc) {
        const theta = 0 + d / r
        return { x: x0 + w - r + r * Math.cos(theta), y: y0 + h - r + r * Math.sin(theta) }
      }
      d -= arc
      if (d <= segBottom) {
        return { x: x0 + w - r - d, y: y0 + h }
      }
      d -= segBottom
      if (d <= arc) {
        const theta = Math.PI / 2 + d / r
        return { x: x0 + r + r * Math.cos(theta), y: y0 + h - r + r * Math.sin(theta) }
      }
      d -= arc
      if (d <= segLeft) {
        return { x: x0, y: y0 + h - r - d }
      }
      d -= segLeft
      const theta = Math.PI + d / r
      return { x: x0 + r + r * Math.cos(theta), y: y0 + r + r * Math.sin(theta) }
    },
    computeRingSamples() {
      const w = this.ringW - this.ringStroke
      const h = this.ringH - this.ringStroke
      const r = Math.min(this.ringRadius, w / 2, h / 2)
      const perimeter = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r
      const N = 240
      const samples = []
      for (let i = 0; i < N; i++) {
        const s = (i / N) * perimeter
        const pt = this.getRingPointAtArcLength(s)
        samples.push({ x: pt.x, y: pt.y, fracPercent: (100 * s) / perimeter })
      }
      this.ringSamples = samples
    },
    ringLocalPointFromEvent(e) {
      const svg = this.$refs.ringSvg
      if (!svg) return null
      const rect = svg.getBoundingClientRect()
      const scaleX = this.ringW / rect.width
      const scaleY = this.ringH / rect.height
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
    },
    percentFromEvent(e) {
      const pt = this.ringLocalPointFromEvent(e)
      if (!pt || !this.ringSamples.length) return null
      let nearest = this.ringSamples[0]
      let nearestDist = Infinity
      for (const sample of this.ringSamples) {
        const dist = (sample.x - pt.x) ** 2 + (sample.y - pt.y) ** 2
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = sample
        }
      }
      return (nearest.fracPercent - this.ringStartOffset + 100) % 100
    },
    startRingDrag(e) {
      if (!this.duration) return
      e.preventDefault()
      this.isDraggingRing = true
      const percent = this.percentFromEvent(e)
      if (percent !== null) this.dragPercent = percent
      window.addEventListener('mousemove', this.onRingDragMove)
      window.addEventListener('mouseup', this.endRingDrag)
    },
    onRingDragMove(e) {
      const percent = this.percentFromEvent(e)
      if (percent !== null) this.dragPercent = percent
    },
    endRingDrag() {
      if (this.isDraggingRing && this.dragPercent !== null && this.duration) {
        this.seek((this.dragPercent / 100) * this.duration)
      }
      this.isDraggingRing = false
      this.dragPercent = null
      window.removeEventListener('mousemove', this.onRingDragMove)
      window.removeEventListener('mouseup', this.endRingDrag)
    },
    playPause() {
      this.$emit('playPause')
    },
    jumpBackward() {
      this.$eventBus.$emit('player-jump', { direction: 'backward', amount: this.jumpBackwardAmount })
      this.$emit('jumpBackward')
    },
    jumpForward() {
      this.$eventBus.$emit('player-jump', { direction: 'forward', amount: this.jumpForwardAmount })
      this.$emit('jumpForward')
    },
    onPlayerJump({ direction, amount } = {}) {
      if (direction !== 'backward' && direction !== 'forward') return
      this.jumpBurst = { direction, amount }
      // Key change forces the node to remount so the animation replays on rapid presses
      this.jumpBurstKey++
      clearTimeout(this.jumpBurstTimeout)
      this.jumpBurstTimeout = setTimeout(() => {
        this.jumpBurst = null
      }, 600)
    },
    setVolume(volume) {
      this.$emit('setVolume', volume)
    },
    setPlaybackRate(playbackRate) {
      this.$emit('setPlaybackRate', playbackRate)
    },
    playbackRateChanged(playbackRate) {
      this.setPlaybackRate(playbackRate)
      this.$store.dispatch('user/updateUserSettings', { playbackRate }).catch((err) => {
        console.error('Failed to update settings', err)
      })
    },
    // The pill applies + persists in one step, unlike the menu which persists on close
    applyPlaybackRate(rate) {
      const clamped = Math.min(this.MAX_PLAYBACK_RATE, Math.max(this.MIN_PLAYBACK_RATE, Number(rate.toFixed(2))))
      if (clamped === this._playbackRate) return
      this.playbackRate = clamped
      this.playbackRateChanged(clamped)
    },
    incrementPlaybackRate() {
      if (!this.canIncrementPlaybackRate) return
      this.applyPlaybackRate(this._playbackRate + this.playbackRateStep)
    },
    decrementPlaybackRate() {
      if (!this.canDecrementPlaybackRate) return
      this.applyPlaybackRate(this._playbackRate - this.playbackRateStep)
    },
    resetPlaybackRate() {
      this.applyPlaybackRate(1)
    },
    seek(time) {
      this.$emit('seek', time)
    },
    restart() {
      this.seek(0)
    },
    prevChapter() {
      if (!this.currentChapter || this.currentChapterIndex === 0) {
        return this.restart()
      }
      var timeInCurrentChapter = this.currentTime - this.currentChapter.start
      if (timeInCurrentChapter <= 3 && this.chapters[this.currentChapterIndex - 1]) {
        this.seek(this.chapters[this.currentChapterIndex - 1].start)
      } else {
        this.seek(this.currentChapter.start)
      }
    },
    goToNext() {
      if (this.hasNextChapter) {
        this.seek(this.chapters[this.currentChapterIndex + 1].start)
      } else if (this.hasNextItemInQueue) {
        this.$emit('nextItemInQueue')
      }
    },
    selectChapter(chapter) {
      this.seek(chapter.start)
      this.showChapterPanel = false
    },
    setDuration(duration) {
      this.duration = duration
    },
    setCurrentTime(time) {
      this.currentTime = time
      if (this.$refs.chapterTrackBar) this.$refs.chapterTrackBar.setCurrentTime(time)
      this.updateTimestamps()
    },
    setBufferTime(bufferTime) {
      if (this.$refs.chapterTrackBar) this.$refs.chapterTrackBar.setBufferTime(bufferTime)
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
      if (this.$refs.chapterTrackBar) this.$refs.chapterTrackBar.setPercentageReady(percentageReady)
    },
    setStreamReady() {
      if (this.$refs.chapterTrackBar) this.$refs.chapterTrackBar.setPercentageReady(1)
    },
    updateTimestamps() {
      if (this.$refs.chapterCurrentTimestamp) {
        const chapTime = this.currentChapter ? Math.max(0, this.currentTime - this.currentChapterStart) : this.currentTime
        this.$refs.chapterCurrentTimestamp.innerText = this.$secondsToTimestamp(chapTime / this._playbackRate)
      }
      if (this.$refs.chapterRemainingTimestamp) {
        const chapDuration = this.currentChapter ? this.currentChapterDuration : this.duration
        const chapTime = this.currentChapter ? Math.max(0, this.currentTime - this.currentChapterStart) : this.currentTime
        const remaining = (chapDuration - chapTime) / this._playbackRate
        this.$refs.chapterRemainingTimestamp.innerText = '-' + this.$secondsToTimestamp(Math.max(0, remaining))
      }
    },
    checkUpdateChapterTrack() {},
    updateCoverWidth() {
      // Leave room for the hover FAB stack (~64px) on the right of the cover
      const columnWidth = this.$refs.coverColumn?.clientWidth || window.innerWidth
      const maxByWidth = Math.round(columnWidth - 130)
      this.coverPxWidth = Math.max(160, Math.min(Math.round(window.innerHeight * 0.5), 420, maxByWidth))
      this.computeRingSamples()
    },
    scrollToCurrentChapter() {
      if (!this.currentChapterId || !this.$refs.chapterList) return
      const el = document.getElementById(`fs-chapter-row-${this.currentChapterId}`)
      if (el) {
        const containerHeight = this.$refs.chapterList.clientHeight
        this.$refs.chapterList.scrollTo({ top: el.offsetTop - containerHeight / 2 })
      }
    },
    handleKeydown(e) {
      const target = e.target
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (e.key === 'Escape') {
        // Only intercept Escape to close the chapter panel; otherwise let the
        // global player hotkey handler (layouts/default.vue) close the player.
        if (this.showChapterPanel) {
          e.preventDefault()
          e.stopPropagation()
          this.showChapterPanel = false
        }
        // Space (play/pause) is handled by the global player-hotkey system.
        // Handling it here too would double-toggle and cancel itself out.
      } else if ((e.key === ',' || e.key === '<') && !isTyping) {
        e.preventDefault()
        this.seek(Math.max(0, this.currentTime - 10))
      } else if ((e.key === '.' || e.key === '>') && !isTyping) {
        e.preventDefault()
        this.seek(Math.min(this.duration, this.currentTime + 10))
      }
    },
    init() {
      this.playbackRate = this.$store.getters['user/getUserSetting']('playbackRate') || 1
      if (this.$refs.chapterTrackBar) this.$refs.chapterTrackBar.setUseChapterTrack(true)
    }
  },
  watch: {
    currentChapterId() {
      this.updateTimestamps()
      this.$nextTick(this.scrollToCurrentChapter)
    },
    showChapterPanel(val) {
      if (val) this.$nextTick(this.scrollToCurrentChapter)
      // Re-fit the cover once the panel's slide-in/out has settled
      setTimeout(this.updateCoverWidth, 340)
    },
    coverAspectRatio() {
      this.computeRingSamples()
    }
  },
  mounted() {
    this.init()
    this.updateCoverWidth()
    window.addEventListener('keydown', this.handleKeydown)
    window.addEventListener('resize', this.updateCoverWidth)
    this.$eventBus.$on('player-jump', this.onPlayerJump)
  },
  beforeDestroy() {
    clearTimeout(this.jumpBurstTimeout)
    this.$eventBus.$off('player-jump', this.onPlayerJump)
    window.removeEventListener('keydown', this.handleKeydown)
    window.removeEventListener('resize', this.updateCoverWidth)
    window.removeEventListener('mousemove', this.onRingDragMove)
    window.removeEventListener('mouseup', this.endRingDrag)
  }
}
</script>

<style>
/* Artwork/ring hover FAB stack — staggered slide-in from behind the cover */
.fab-stack > * {
  opacity: 0;
  transform: translateX(-14px) scale(0.9);
  transition: opacity 0.18s ease, transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.group:hover .fab-stack > * {
  opacity: 1;
  transform: translateX(0) scale(1);
}
.group:hover .fab-stack > *:nth-child(1) {
  transition-delay: 0.02s;
}
.group:hover .fab-stack > *:nth-child(2) {
  transition-delay: 0.06s;
}
.group:hover .fab-stack > *:nth-child(3) {
  transition-delay: 0.1s;
}
.group:hover .fab-stack > *:nth-child(4) {
  transition-delay: 0.14s;
}

/* Top-left corner: button only appears while the corner is hovered */
.corner-zone .corner-btn {
  opacity: 0;
  transform: translateY(-6px);
  transition: opacity 0.18s ease, transform 0.22s ease, background-color 0.15s ease;
}
.corner-zone:hover .corner-btn {
  opacity: 1;
  transform: translateY(0);
}

/* Panel takes real layout width, so the artwork column re-centers as it slides in */
.chapter-panel-enter-active,
.chapter-panel-leave-active {
  transition: margin-right 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease;
}
.chapter-panel-enter,
.chapter-panel-leave-to {
  margin-right: -24rem; /* -w-96 */
  opacity: 0;
}

/* Speed pill: springs in when the rate leaves 1x, collapses away when it returns */
.speed-pill {
  transition: background-color 0.15s ease;
}
.speed-pill-btn,
.speed-pill-value {
  transition: background-color 0.15s ease, opacity 0.15s ease;
}
.speed-pill-enter-active {
  transition: opacity 0.2s ease, transform 0.32s cubic-bezier(0.34, 1.45, 0.64, 1);
}
.speed-pill-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.speed-pill-enter,
.speed-pill-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.88);
}

/* Jump feedback burst: dark scrim wipes in from the side that was jumped toward,
   pill springs up then fades. Whole thing is done in ~0.6s and self-removes. */
.jump-burst {
  animation: jump-burst-scrim 0.6s ease forwards;
}
.jump-burst-back {
  background: linear-gradient(to right, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0) 65%);
}
.jump-burst-fwd {
  background: linear-gradient(to left, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0) 65%);
}
@keyframes jump-burst-scrim {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.jump-burst-pill {
  animation: jump-burst-pill 0.6s cubic-bezier(0.34, 1.45, 0.64, 1) forwards;
}
@keyframes jump-burst-pill {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }
  25% {
    opacity: 1;
    transform: scale(1.06);
  }
  45% {
    transform: scale(1);
  }
  70% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.12);
  }
}

/* Icon spins in the direction of travel — reads as "time moved" at a glance */
.jump-burst-icon {
  animation: jump-burst-spin-back 0.55s cubic-bezier(0.22, 0.9, 0.24, 1);
}
.jump-burst-fwd .jump-burst-icon {
  animation-name: jump-burst-spin-fwd;
}
@keyframes jump-burst-spin-back {
  from {
    transform: rotate(120deg);
  }
  to {
    transform: rotate(0deg);
  }
}
@keyframes jump-burst-spin-fwd {
  from {
    transform: rotate(-120deg);
  }
  to {
    transform: rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .speed-pill-enter-active,
  .speed-pill-leave-active {
    transition: opacity 0.16s ease !important;
  }
  .speed-pill-enter,
  .speed-pill-leave-to {
    transform: none;
  }
  .jump-burst-icon {
    animation: none !important;
  }
  .jump-burst-pill {
    animation: jump-burst-scrim 0.6s ease forwards !important;
  }
}
</style>
