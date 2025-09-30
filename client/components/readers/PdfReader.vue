<template>
  <div class="w-full h-full pt-20 relative">
    <div v-show="canGoPrev" class="absolute top-0 left-0 h-full w-1/2 h }, computed: { userToken() {00 opacity-0 z-0 cursor-pointer" @click.stop.prevent="prev" @mousedown.prevent>
      <div class="flex items-center justify-center h-full w-1/2">
        <span class="material-symbols text-5xl text-white/30 cursor-pointer hover:text-white/90">arrow_back_ios</span>
      </div>
    </div>
    <div v-show="canGoNext" class="absolute top-0 right-0 h-full w-1/2 hover:opacity-100 opacity-0 z-10 cursor-pointer" @click.stop.prevent="next" @mousedown.prevent>
      <div class="flex items-center justify-center h-full w-1/2 ml-auto">
        <span class="material-symbols text-5xl text-white/30 cursor-pointer hover:text-white/90">arrow_forward_ios</span>
      </div>
    </div>

    <div class="absolute top-0 right-12 bg-bg text-gray-100 border-b border-l border-r border-gray-400 z-20 rounded-b-md px-2 h-9 hidden md:flex items-center text-center">
      <input v-if="editingPage" v-model="pageInput" @keyup.enter="goToPage" @keyup.esc="cancelPageEdit" @blur="goToPage" ref="pageInputField" class="bg-transparent text-center font-mono text-sm border-none outline-none" :style="{ width: String(numPages).length * 8 + 16 + 'px' }" />
      <p v-else @click="startPageEdit" class="font-mono cursor-pointer hover:bg-white/10 px-1 rounded" title="Click to jump to page">{{ page }} / {{ numPages }}</p>
    </div>

    <div class="absolute top-0 right-40 bg-bg text-gray-100 border-b border-l border-r border-gray-400 z-20 rounded-b-md px-1 h-9 hidden md:flex items-center text-center">
      <ui-icon-btn icon="zoom_out" :size="8" :disabled="!canScaleDown" borderless class="mr-px" @click="zoomOut" />
      <select v-model="zoomLevel" @change="setZoomLevel" class="bg-bg text-xs mx-1 min-w-16 text-gray-100 border border-gray-400 rounded">
        <option value="fit-width">Fit Width</option>
        <option value="fit-page">Fit Page</option>
        <option value="1">100%</option>
        <option value="1.25">125%</option>
        <option value="1.5">150%</option>
        <option value="1.75">175%</option>
        <option value="2">200%</option>
      </select>
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
      isRefreshing: false,
      zoomLevel: '1',
      editingPage: false,
      pageInput: 1,
      viewMode: 'single', // 'single' or 'continuous'
      scrollPosition: 0
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
    fitToWidth() {
      return (this.windowWidth - 40) / this.fitToPageWidth
    },
    fitToPage() {
      return Math.min(this.fitToWidth, (this.pdfHeight - 40) / (this.fitToPageWidth * 1.4))
    },
    showContinuousView() {
      return this.viewMode === 'continuous'
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
      return this.scale < 2
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
  watch: {
    page(newVal) {
      this.pageInput = newVal
    },
    scale(newVal) {
      // Update zoom level dropdown when scale changes
      if (newVal >= 1 && newVal <= 2) {
        this.zoomLevel = newVal.toString()
      }
    }
  },
  methods: {
    zoomIn() {
      if (this.scale < 2) {
        this.scale = Math.min(2, this.scale + 0.25)
        this.updateZoomLevel()
      }
    },
    setZoomLevel() {
      switch (this.zoomLevel) {
        case 'fit-width':
          this.scale = this.fitToWidth
          break
        case 'fit-page':
          this.scale = this.fitToPage
          break
        default:
          this.scale = parseFloat(this.zoomLevel)
      }
    },
    zoomOut() {
      if (this.scale > 1) {
        this.scale = Math.max(1, this.scale - 0.25)
        this.updateZoomLevel()
      }
    },
    updateZoomLevel() {
      // Update the dropdown to show current zoom percentage
      if (this.scale >= 1 && this.scale <= 2) {
        this.zoomLevel = this.scale.toString()
      }
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
      this.pageInput = this.page
      this.updateProgress()
    },
    next() {
      if (this.page >= this.numPages) return
      this.page++
      this.pageInput = this.page
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
    toggleViewMode() {
      this.viewMode = this.viewMode === 'single' ? 'continuous' : 'single'
    },

    handleScroll(e) {
      if (this.viewMode === 'continuous') {
        const container = e.target
        const scrollPercent = container.scrollTop / (container.scrollHeight - container.clientHeight)
        const newPage = Math.ceil(scrollPercent * this.numPages) || 1
        if (newPage !== this.page) {
          this.page = newPage
          this.updateProgress()
        }
      }
    },
    startPageEdit() {
      this.editingPage = true
      this.pageInput = this.page
      this.$nextTick(() => {
        this.$refs.pageInputField?.focus()
        this.$refs.pageInputField?.select()
      })
    },
    goToPage() {
      const targetPage = parseInt(this.pageInput)
      if (targetPage >= 1 && targetPage <= this.numPages) {
        this.page = targetPage
        this.updateProgress()
      } else {
        this.pageInput = this.page
      }
      this.editingPage = false
    },

    cancelPageEdit() {
      this.pageInput = this.page
      this.editingPage = false
    },
    keyboardHandler(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          e.stopPropagation()
          this.prev()
          break
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          e.stopPropagation()
          this.next()
          break
        case 'Home':
          e.preventDefault()
          this.page = 1
          this.pageInput = 1
          this.updateProgress()
          break
        case 'End':
          e.preventDefault()
          this.page = this.numPages
          this.pageInput = this.numPages
          this.updateProgress()
          break
        case '+':
        case '=':
          e.preventDefault()
          if (this.canScaleUp) this.zoomIn()
          break
        case '-':
          e.preventDefault()
          if (this.canScaleDown) this.zoomOut()
          break
        case '0':
          e.preventDefault()
          this.scale = 1
          this.updateZoomLevel()
          break
      }
    },
    init() {
      this.pdfDocInitParams = {
        url: this.ebookUrl,
        httpHeaders: {
          Authorization: `Bearer ${this.userToken}`
        }
      }
      // Initialize zoom level to match default scale
      this.zoomLevel = this.scale.toString()
    }
  },
  mounted() {
    this.windowWidth = window.innerWidth
    this.windowHeight = window.innerHeight
    window.addEventListener('resize', this.resize)
    document.removeEventListener('keydown', this.keyboardHandler)
    document.addEventListener('keydown', this.keyboardHandler)

    this.init()
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('keydown', this.keyboardHandler)
  }
}
</script>
