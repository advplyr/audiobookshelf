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
          <pdf ref="pdf" class="m-auto z-10 border border-black border-opacity-20 shadow-md" :src="url" :page="page" :rotate="rotate" @progress="loadedRatio = $event" @error="error" @num-pages="numPagesLoaded" @link-clicked="page = $event"></pdf>
        </div>
      </div>
    </div>
    <!-- <div class="text-center py-2 text-lg">
      <p>{{ page }} / {{ numPages }}</p>
    </div> -->
  </div>
</template>

<script>
import pdf from 'vue-pdf'

export default {
  components: {
    pdf
  },
  props: {
    url: String
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
    }
  },
  methods: {
    numPagesLoaded(e) {
      this.numPages = e
    },
    prev() {
      if (this.page <= 1) return
      this.page--
    },
    next() {
      if (this.page >= this.numPages) return
      this.page++
    },
    error(err) {
      console.error(err)
    }
  },
  mounted() {}
}
</script>