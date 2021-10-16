<template>
  <div class="w-full pt-20">
    <div :style="{ height: pdfHeight + 'px' }" class="overflow-hidden m-auto">
      <div class="flex items-center justify-center">
        <div class="px-12">
          <span class="material-icons text-5xl text-black" :class="!canGoPrev ? 'text-opacity-10' : 'cursor-pointer text-opacity-30 hover:text-opacity-90'" @click.stop.prevent="goPrevPage" @mousedown.prevent>arrow_back_ios</span>
        </div>
        <div :style="{ width: pdfWidth + 'px', height: pdfHeight + 'px' }" class="w-full h-full overflow-auto">
          <div v-if="loadedRatio > 0 && loadedRatio < 1" style="background-color: green; color: white; text-align: center" :style="{ width: loadedRatio * 100 + '%' }">{{ Math.floor(loadedRatio * 100) }}%</div>
          <pdf ref="pdf" class="m-auto z-10 border border-black border-opacity-20 shadow-md" :src="src" :page="page" :rotate="rotate" @progress="loadedRatio = $event" @error="error" @num-pages="numPagesLoaded" @link-clicked="page = $event"></pdf>
        </div>

        <div class="px-12">
          <span class="material-icons text-5xl text-black" :class="!canGoNext ? 'text-opacity-10' : 'cursor-pointer text-opacity-30 hover:text-opacity-90'" @click.stop.prevent="goNextPage" @mousedown.prevent>arrow_forward_ios</span>
        </div>
      </div>
    </div>
    <div class="text-center py-2 text-lg">
      <p>{{ page }} / {{ numPages }}</p>
    </div>
  </div>
</template>

<script>
import pdf from 'vue-pdf'

export default {
  components: {
    pdf
  },
  props: {
    src: String
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
    goPrevPage() {
      if (this.page <= 1) return
      this.page--
    },
    goNextPage() {
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