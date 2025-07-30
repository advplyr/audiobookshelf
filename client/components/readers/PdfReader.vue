<template>
  <div class="w-full h-full pt-20 relative">
    <div v-show="canGoPrev" class="absolute top-0 left-0 h-full w-1/2 hover:opacity-100 opacity-0 z-10 cursor-pointer" @click.stop.prevent="prev" @mousedown.prevent>
      <div class="flex items-center justify-center h-full w-1/2">
        <span class="material-symbols text-5xl text-white/30 cursor-pointer hover:text-white/90">arrow_back_ios</span>
      </div>
    </div>
    <div v-show="canGoNext" class="absolute top-0 right-0 h-full w-1/2 hover:opacity-100 opacity-0 z-10 cursor-pointer" @click.stop.prevent="next" @mousedown.prevent>
      <div class="flex items-center justify-center h-full w-1/2 ml-auto">
        <span class="material-symbols text-5xl text-white/30 cursor-pointer hover:text-white/90">arrow_forward_ios</span>
      </div>
    </div>

    <div class="absolute top-0 right-20 bg-bg text-gray-100 border-b border-l border-r border-gray-400 z-20 rounded-b-md px-2 h-9 hidden md:flex items-center text-center">
      <p class="font-mono">{{ page }} / {{ numPages }}</p>
    </div>
    <div class="absolute top-0 right-40 bg-bg text-gray-100 border-b border-l border-r border-gray-400 z-20 rounded-b-md px-2 h-9 hidden md:flex items-center text-center">
      <ui-icon-btn icon="zoom_out" :size="8" :disabled="!canScaleDown" borderless class="mr-px" @click="zoomOut" />
      <ui-icon-btn icon="zoom_in" :size="8" :disabled="!canScaleUp" borderless class="ml-px" @click="zoomIn" />
    </div>

    <div :style="{ height: pdfHeight + 'px' }" class="overflow-hidden m-auto">
      <div class="flex items-center justify-center">
        <div :style="{ width: pdfWidth + 'px', height: pdfHeight + 'px' }" class="overflow-auto">
          <div v-if="loadedRatio > 0 && loadedRatio < 1" style="background-color: green; color: white; text-align: center" :style="{ width: loadedRatio * 100 + '%' }">{{ Math.floor(loadedRatio * 100) }}%</div>
          <pdf v-if="pdfDocInitParams" ref="pdf" class="m-auto z-10 border border-black/20 shadow-md" :src="pdfDocInitParams" :page="page" :rotate="rotate" @progress="progressEvt" @error="error" @num-pages="numPagesLoaded" @link-clicked="page = $event" @loaded="loadedEvt"></pdf>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import pdf from '@teckel/vue-pdf'

export default {
  components: {
    pdf
  },
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    },
    playerOpen: Boolean,
    keepProgress: Boolean,
    fileId: String
  },
  data() {
    return {
      windowWidth: 0,
      windowHeight: 0,
      scale: 1,
      rotate: 0,
      loadedRatio: 0,
      page: 1,
      numPages: 0,
      pdfDocInitParams: null,
      isRefreshing: false
    }
  },
  computed: {
    userToken() {
      return this.$store.getters['user/getToken']
    },
    libraryItemId() {
      return this.libraryItem?.id
    },
    fitToPageWidth() {
      return this.pdfHeight * 0.6
    },
    pdfWidth() {
      return this.fitToPageWidth * this.scale
    },
    pdfHeight() {
      if (this.windowHeight < 400 || !this.playerOpen) return this.windowHeight - 120
      return this.windowHeight - 284
    },
    maxScale() {
      return Math.floor((this.windowWidth * 10) / this.fitToPageWidth) / 10
    },
    canGoNext() {
      return this.page < this.numPages
    },
    canGoPrev() {
      return this.page > 1
    },
    canScaleUp() {
      return this.scale < this.maxScale
    },
    canScaleDown() {
      return this.scale > 1
    },
    userMediaProgress() {
      if (!this.libraryItemId) return
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId)
    },
    savedPage() {
      if (!this.keepProgress) return 0

      // Validate ebookLocation is a number
      if (!this.userMediaProgress?.ebookLocation || isNaN(this.userMediaProgress.ebookLocation)) return 0
      return Number(this.userMediaProgress.ebookLocation)
    },
    ebookUrl() {
      if (this.fileId) {
        return `/api/items/${this.libraryItemId}/ebook/${this.fileId}`
      }
      return `/api/items/${this.libraryItemId}/ebook`
    }
  },
  methods: {
    zoomIn() {
      this.scale += 0.1
    },
    zoomOut() {
      this.scale -= 0.1
    },
    updateProgress() {
      if (!this.keepProgress) return
      if (!this.numPages) {
        console.error('Num pages not loaded')
        return
      }

      const payload = {
        ebookLocation: this.page,
        ebookProgress: Math.max(0, Math.min(1, (Number(this.page) - 1) / Number(this.numPages)))
      }
      this.$axios.$patch(`/api/me/progress/${this.libraryItemId}`, payload, { progress: false }).catch((error) => {
        console.error('EpubReader.updateProgress failed:', error)
      })
    },
    loadedEvt() {
      if (this.savedPage > 0 && this.savedPage <= this.numPages) {
        this.page = this.savedPage
      }
    },
    progressEvt(progress) {
      this.loadedRatio = progress
    },
    numPagesLoaded(e) {
      if (!e) return
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
    async refreshToken() {
      if (this.isRefreshing) return
      this.isRefreshing = true
      const newAccessToken = await this.$store.dispatch('user/refreshToken').catch((error) => {
        console.error('Failed to refresh token', error)
        return null
      })
      if (!newAccessToken) {
        // Redirect to login on failed refresh
        this.$router.push('/login')
        return
      }

      // Force Vue to re-render the PDF component by creating a new object
      this.pdfDocInitParams = {
        url: this.ebookUrl,
        httpHeaders: {
          Authorization: `Bearer ${newAccessToken}`
        }
      }
      this.isRefreshing = false
    },
    async error(err) {
      if (err && err.status === 401) {
        console.log('Received 401 error, refreshing token')
        await this.refreshToken()
        return
      }
      console.error(err)
    },
    resize() {
      this.windowWidth = window.innerWidth
      this.windowHeight = window.innerHeight
    },
    init() {
      this.pdfDocInitParams = {
        url: this.ebookUrl,
        httpHeaders: {
          Authorization: `Bearer ${this.userToken}`
        }
      }
    }
  },
  mounted() {
    this.windowWidth = window.innerWidth
    this.windowHeight = window.innerHeight
    window.addEventListener('resize', this.resize)

    this.init()
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
  }
}
</script>
