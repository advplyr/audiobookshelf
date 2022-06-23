<template>
  <modals-modal v-model="show" name="chapters" :width="600" :height="'unset'">
    <div id="chapter-modal-wrapper" ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <template v-for="chap in chapters">
        <div :key="chap.id" :id="`chapter-row-${chap.id}`" class="flex items-center px-6 py-3 justify-start cursor-pointer hover:bg-bg relative" :class="chap.id === currentChapterId ? 'bg-yellow-400 bg-opacity-10' : chap.end <= currentChapterStart ? 'bg-success bg-opacity-5' : 'bg-opacity-20'" @click="clickChapter(chap)">
          <p class="chapter-title truncate text-sm md:text-base">
            {{ chap.title }}
          </p>
          <span class="font-mono text-xxs sm:text-xs text-gray-400 pl-2 whitespace-nowrap">{{ $elapsedPrettyExtended(chap.end - chap.start) }}</span>
          <span class="flex-grow" />
          <span class="font-mono text-xs sm:text-sm text-gray-300">{{ $secondsToTimestamp(chap.start) }}</span>

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
    }
  },
  data() {
    return {}
  },
  watch: {
    value(newVal) {
      this.$nextTick(this.scrollToChapter)
    }
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
    currentChapterId() {
      return this.currentChapter ? this.currentChapter.id : null
    },
    currentChapterStart() {
      return this.currentChapter ? this.currentChapter.start : 0
    }
  },
  methods: {
    clickChapter(chap) {
      this.$emit('select', chap)
    },
    scrollToChapter() {
      if (!this.currentChapterId) return

      var container = this.$refs.container
      if (container) {
        var currChapterEl = document.getElementById(`chapter-row-${this.currentChapterId}`)
        if (currChapterEl) {
          var offsetTop = currChapterEl.offsetTop
          var containerHeight = container.clientHeight
          container.scrollTo({ top: offsetTop - containerHeight / 2 })
        }
      }
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