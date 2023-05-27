<template>
  <div class="w-full h-full pt-20 relative">
    <div v-show="canGoPrev" class="absolute top-0 left-0 h-full w-1/2 hover:opacity-100 opacity-0 z-10 cursor-pointer" @click.stop.prevent="prev" @mousedown.prevent>
      <div class="flex items-center justify-center h-full w-1/2">
        <span class="material-icons text-5xl text-white cursor-pointer text-opacity-30 hover:text-opacity-90">arrow_back_ios</span>
      </div>
    </div>
    <div v-show="canGoNext" class="absolute top-0 right-0 h-full w-1/2 hover:opacity-100 opacity-0 z-10 cursor-pointer" @click.stop.prevent="next" @mousedown.prevent>
      <div class="flex items-center justify-center h-full w-1/2 ml-auto">
        <span class="material-icons text-5xl text-white cursor-pointer text-opacity-30 hover:text-opacity-90">arrow_forward_ios</span>
      </div>
    </div>

    <div class="absolute top-0 right-20 bg-bg text-gray-100 border-b border-l border-r border-gray-400 rounded-b-md px-2 h-9 flex items-center text-center">
      <p class="font-mono">{{ page }} / {{ numPages }}</p>
    </div>

    <div :style="{ height: pdfHeight + 'px' }" class="overflow-hidden m-auto">
      <div class="flex items-center justify-center">
        <div :style="{ width: pdfWidth + 'px', height: pdfHeight + 'px' }" class="w-full h-full overflow-auto">
          <div v-if="loadedRatio > 0 && loadedRatio < 1" style="background-color: green; color: white; text-align: center" :style="{ width: loadedRatio * 100 + '%' }">{{ Math.floor(loadedRatio * 100) }}%</div>
          <pdf ref="pdf" class="m-auto z-10 border border-black border-opacity-20 shadow-md" :src="url" :page="page" :rotate="rotate" @progress="progressEvt" @error="error" @num-pages="numPagesLoaded" @link-clicked="page = $event" @loaded="loadedEvt"></pdf>
        </div>
      </div>
    </div>
    <!-- <div class="text-center py-2 text-lg">
      <p>{{ page }} / {{ numPages }}</p>
    </div> -->
  </div>
</template>

<script>
import pdf from '@teckel/vue-pdf'

export default {
  components: {
    pdf
  },
  props: {
    url: String,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      rotate: 0,
      loadedRatio: 0,
      page: 1,
      numPages: 0
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem?.id
    },
    pdfWidth() {
      return this.pdfHeight * 0.6667
    },
    pdfHeight() {
      return window.innerHeight - 120
    },
    canGoNext() {
      return this.page < this.numPages
    },
    canGoPrev() {
      return this.page > 1
    },
    userMediaProgress() {
      if (!this.libraryItemId) return
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    savedPage() {
      return Number(this.userMediaProgress?.ebookLocation || 0)
    }
  },
  methods: {
    updateProgress() {
      if (!this.numPages) {
        console.error('Num pages not loaded')
        return
      }

      const payload = {
        ebookLocation: this.page,
        ebookProgress: Math.max(0, Math.min(1, (Number(this.page) - 1) / Number(this.numPages)))
      }
      this.$axios.$patch(`/api/me/progress/${this.libraryItemId}`, payload).catch((error) => {
        console.error('EpubReader.updateProgress failed:', error)
      })
    },
    loadedEvt() {
      if (this.savedPage && this.savedPage > 0 && this.savedPage <= this.numPages) {
        this.page = this.savedPage
      }
    },
    progressEvt(progress) {
      this.loadedRatio = progress
    },
    numPagesLoaded(e) {
      this.numPages = e
    },
    prev() {
      if (this.page <= 1) return
      this.page--
      this.updateProgress()
    },
    next() {
      if (this.page >= this.numPages) return
      this.page++
      this.updateProgress()
    },
    error(err) {
      console.error(err)
    }
  },
  mounted() {}
}
</script>