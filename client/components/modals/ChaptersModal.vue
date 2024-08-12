<template>
  <modals-modal v-model="show" name="chapters" :width="600" :height="'unset'">
    <div id="chapter-modal-wrapper" ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <template v-for="chap in chapters">
        <div :key="chap.id" :id="`chapter-row-${chap.id}`" class="flex items-center px-6 py-3 justify-start cursor-pointer relative" :class="chap.id === currentChapterId ? 'bg-yellow-400/20 hover:bg-yellow-400/10' : chap.end / _playbackRate <= currentChapterStart ? 'bg-success/10 hover:bg-success/5' : 'hover:bg-primary/10'" @click="clickChapter(chap)">
          <p class="chapter-title truncate text-sm md:text-base">
            {{ chap.title }}
          </p>
          <span class="font-mono text-xxs sm:text-xs text-gray-400 pl-2 whitespace-nowrap">{{ $elapsedPrettyExtended((chap.end - chap.start) / _playbackRate) }}</span>
          <span class="flex-grow" />
          <span class="font-mono text-xs sm:text-sm text-gray-300">{{ $secondsToTimestamp(chap.start / _playbackRate) }}</span>

          <div v-show="chap.id === currentChapterId" class="w-0.5 h-full absolute top-0 left-0 bg-yellow-400" />
        </div>
      </template>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    chapters: {
      type: Array,
      default: () => []
    },
    currentChapter: {
      type: Object,
      default: () => null
    },
    playbackRate: Number
  },
  data() {
    return {}
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    _playbackRate() {
      if (!this.playbackRate || isNaN(this.playbackRate)) return 1
      return this.playbackRate
    },
    currentChapterId() {
      return this.currentChapter?.id || null
    },
    currentChapterStart() {
      return (this.currentChapter?.start || 0) / this._playbackRate
    }
  },
  methods: {
    clickChapter(chap) {
      this.$emit('select', chap)
    },
    scrollToChapter() {
      if (!this.currentChapterId) return

      if (this.$refs.container) {
        const currChapterEl = document.getElementById(`chapter-row-${this.currentChapterId}`)
        if (currChapterEl) {
          const containerHeight = this.$refs.container.clientHeight
          this.$refs.container.scrollTo({ top: currChapterEl.offsetTop - containerHeight / 2 })
        }
      }
    }
  },
  updated() {
    if (this.value) {
      this.$nextTick(this.scrollToChapter)
    }
  }
}
</script>

<style>
#chapter-modal-wrapper .chapter-title {
  max-width: calc(100% - 120px);
}
@media (min-width: 640px) {
  #chapter-modal-wrapper .chapter-title {
    max-width: calc(100% - 150px);
  }
}
</style>
