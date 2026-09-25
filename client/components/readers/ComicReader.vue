<template>
  <div class="w-full h-full">
    <div v-show="showPageMenu" v-click-outside="clickOutside" class="pagemenu absolute top-9 left-8 rounded-md overflow-y-auto bg-bg shadow-lg z-20 border border-gray-400" :style="{ width: pageMenuWidth + 'px' }">
      <div v-for="(file, index) in cleanedPageNames" :key="file" class="w-full cursor-pointer hover:bg-black-200 px-2 py-1" :class="page === index + 1 ? 'bg-black-200' : ''" @click="setPage(index + 1)">
        <p class="text-sm truncate">{{ file }}</p>
      </div>
    </div>
    <div v-show="showInfoMenu" v-click-outside="clickOutside" class="pagemenu absolute top-9 left-20 rounded-md overflow-y-auto bg-bg shadow-lg z-20 border border-gray-400 w-96">
      <div v-for="key in comicMetadataKeys" :key="key" class="w-full px-2 py-1">
        <p class="text-xs">
          <strong>{{ key }}</strong
          >: {{ comicMetadata[key] }}
        </p>
      </div>
    </div>

    <div v-if="numPages" class="absolute top-0 left-4 sm:left-8 bg-bg text-gray-100 border-b border-l border-r border-gray-400 hover:bg-black-200 cursor-pointer rounded-b-md w-10 h-9 flex items-center justify-center text-center z-20" @mousedown.prevent @click.stop.prevent="clickShowPageMenu">
      <span class="material-symbols text-xl">menu</span>
    </div>
    <div v-if="comicMetadata" class="absolute top-0 left-16 sm:left-20 bg-bg text-gray-100 border-b border-l border-r border-gray-400 hover:bg-black-200 cursor-pointer rounded-b-md w-10 h-9 flex items-center justify-center text-center z-20" @mousedown.prevent @click.stop.prevent="clickShowInfoMenu">
      <span class="material-symbols text-xl">more</span>
    </div>
    <a v-if="pages && numPages && mainImg" :href="currentPageUrl" :download="pages[page - 1]" class="absolute top-0 bg-bg text-gray-100 border-b border-l border-r border-gray-400 hover:bg-black-200 cursor-pointer rounded-b-md w-10 h-9 flex items-center justify-center text-center z-20" :class="comicMetadata ? 'left-28 sm:left-32' : 'left-16 sm:left-20'">
      <span class="material-symbols text-xl">download</span>
    </a>

    <div v-if="numPages" class="absolute top-0 right-14 sm:right-16 bg-bg text-gray-100 border-b border-l border-r border-gray-400 rounded-b-md px-2 h-9 flex items-center text-center z-20">
      <p class="font-mono">{{ page }} / {{ numPages }}</p>
    </div>
    <div v-if="mainImg" class="absolute top-0 right-36 sm:right-40 bg-bg text-gray-100 border-b border-l border-r border-gray-400 rounded-b-md px-2 h-9 flex items-center text-center z-20">
      <ui-icon-btn icon="zoom_out" :size="8" :disabled="!canScaleDown" borderless class="mr-px" @click="zoomOut" />
      <ui-icon-btn icon="zoom_in" :size="8" :disabled="!canScaleUp" borderless class="ml-px" @click="zoomIn" />
    </div>

    <div class="w-full h-full relative">
      <div v-show="canGoPrev" ref="prevButton" class="absolute top-0 left-0 h-full w-1/2 lg:w-1/3 hover:opacity-100 opacity-0 z-10 cursor-pointer" @click.stop.prevent="prev" @mousedown.prevent>
        <div class="flex items-center justify-center h-full w-1/2">
          <span v-show="loadedFirstPage" class="material-symbols text-5xl text-white/30 cursor-pointer hover:text-white/90">arrow_back_ios</span>
        </div>
      </div>
      <div v-show="canGoNext" ref="nextButton" class="absolute top-0 right-0 h-full w-1/2 lg:w-1/3 hover:opacity-100 opacity-0 z-10 cursor-pointer" @click.stop.prevent="next" @mousedown.prevent>
        <div class="flex items-center justify-center h-full w-1/2 ml-auto">
          <span v-show="loadedFirstPage" class="material-symbols text-5xl text-white/30 cursor-pointer hover:text-white/90">arrow_forward_ios</span>
        </div>
      </div>
      <div ref="imageContainer" class="w-full h-full relative overflow-auto">
        <div class="h-full flex" :class="scale > 100 ? '' : 'justify-center'">
          <img v-if="mainImg" :style="{ minWidth: scale + '%', width: scale + '%' }" :src="mainImg" class="object-contain m-auto" @load="onImageLoad" @error="onImageError" />
        </div>
      </div>
      <div v-show="loading" class="w-full h-full absolute top-0 left-0 flex items-center justify-center z-10">
        <ui-loading-indicator />
      </div>
    </div>
  </div>
</template>

<script>
import Path from 'path'

// This is % with respect to the screen width
const MAX_SCALE = 400
const MIN_SCALE = 10

export default {
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
      loading: false,
      pages: null,
      fileIno: null,
      mainImg: null,
      page: 0,
      numPages: 0,
      pageMenuWidth: 256,
      showPageMenu: false,
      showInfoMenu: false,
      loadTimeout: null,
      loadedFirstPage: false,
      comicMetadata: null,
      scale: 80,
      // Preload adjacent pages
      preloadedPages: new Map()
    }
  },
  watch: {
    libraryItemId: {
      immediate: true,
      handler() {
        this.loadComicMetadata()
      }
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem?.id
    },
    comicPagesUrl() {
      if (this.fileId) {
        return `/api/items/${this.libraryItemId}/comic-pages/${this.fileId}`
      }
      return `/api/items/${this.libraryItemId}/comic-pages`
    },
    currentPageUrl() {
      if (!this.libraryItemId || !this.page) return null
      if (this.fileId) {
        return `/api/items/${this.libraryItemId}/comic-page/${this.page}/${this.fileId}`
      }
      return `/api/items/${this.libraryItemId}/comic-page/${this.page}`
    },
    comicMetadataKeys() {
      return this.comicMetadata ? Object.keys(this.comicMetadata) : []
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
      if (!this.keepProgress) return 0

      // Validate ebookLocation is a number
      if (!this.userMediaProgress?.ebookLocation || isNaN(this.userMediaProgress.ebookLocation)) return 0
      return Number(this.userMediaProgress.ebookLocation)
    },
    cleanedPageNames() {
      return (
        this.pages?.map((p) => {
          const filename = typeof p === 'object' ? p.filename : p
          if (filename.length > 50) {
            let firstHalf = filename.slice(0, 22)
            let lastHalf = filename.slice(filename.length - 23)
            return `${firstHalf} ... ${lastHalf}`
          }
          return filename
        }) || []
      )
    },
    canScaleUp() {
      return this.scale < MAX_SCALE
    },
    canScaleDown() {
      return this.scale > MIN_SCALE
    }
  },
  methods: {
    clickShowPageMenu() {
      this.showInfoMenu = false
      this.showPageMenu = !this.showPageMenu
    },
    clickShowInfoMenu() {
      this.showPageMenu = false
      this.showInfoMenu = !this.showInfoMenu
    },
    updateProgress() {
      if (!this.keepProgress) return

      if (!this.numPages) {
        console.error('Num pages not loaded')
        return
      }
      if (this.savedPage === this.page) {
        return
      }

      const payload = {
        ebookLocation: this.page,
        ebookProgress: Math.max(0, Math.min(1, (Number(this.page) - 1) / Number(this.numPages)))
      }
      this.$axios.$patch(`/api/me/progress/${this.libraryItemId}`, payload, { progress: false }).catch((error) => {
        console.error('ComicReader.updateProgress failed:', error)
      })
    },
    clickOutside() {
      if (this.showPageMenu) this.showPageMenu = false
      if (this.showInfoMenu) this.showInfoMenu = false
    },
    next() {
      if (!this.canGoNext) return
      this.setPage(this.page + 1)
    },
    prev() {
      if (!this.canGoPrev) return
      this.setPage(this.page - 1)
    },
    getPageUrl(pageNum) {
      if (this.fileId) {
        return `/api/items/${this.libraryItemId}/comic-page/${pageNum}/${this.fileId}`
      }
      return `/api/items/${this.libraryItemId}/comic-page/${pageNum}`
    },
    setPage(pageNum) {
      if (pageNum <= 0 || pageNum > this.numPages) {
        return
      }
      this.showPageMenu = false
      this.showInfoMenu = false
      this.page = pageNum
      this.updateProgress()
      this.loadPage(pageNum)
      // Preload adjacent pages
      this.preloadAdjacentPages(pageNum)
    },
    setLoadTimeout() {
      this.loadTimeout = setTimeout(() => {
        this.loading = true
      }, 150)
    },
    loadPage(pageNum) {
      this.setLoadTimeout()
      // Check if already preloaded
      const preloaded = this.preloadedPages.get(pageNum)
      if (preloaded) {
        this.mainImg = preloaded
        this.loading = false
        clearTimeout(this.loadTimeout)
        return
      }
      // Load from server
      this.mainImg = this.getPageUrl(pageNum)
    },
    onImageLoad() {
      this.loading = false
      clearTimeout(this.loadTimeout)
      if (!this.loadedFirstPage) {
        this.loadedFirstPage = true
      }
    },
    onImageError() {
      this.loading = false
      clearTimeout(this.loadTimeout)
      this.$toast.error('Failed to load page')
    },
    preloadAdjacentPages(currentPage) {
      // Preload next 2 and previous 1 pages
      const pagesToPreload = [currentPage + 1, currentPage + 2, currentPage - 1].filter(
        (p) => p >= 1 && p <= this.numPages && !this.preloadedPages.has(p)
      )

      for (const pageNum of pagesToPreload) {
        const img = new Image()
        img.src = this.getPageUrl(pageNum)
        img.onload = () => {
          this.preloadedPages.set(pageNum, img.src)
          // Limit cache size
          if (this.preloadedPages.size > 10) {
            const firstKey = this.preloadedPages.keys().next().value
            this.preloadedPages.delete(firstKey)
          }
        }
      }
    },
    async loadComicMetadata() {
      if (!this.libraryItemId) return
      
      this.loading = true
      try {
        const response = await this.$axios.$get(this.comicPagesUrl)
        console.log('Comic metadata:', response)
        
        this.fileIno = response.fileIno
        this.pages = response.pages.map(p => p.filename)
        this.numPages = response.numPages

        // Calculate page menu size
        const largestFilename = this.cleanedPageNames
          .map((p) => p)
          .sort((a, b) => a.length - b.length)
          .pop()
        if (largestFilename) {
          const pEl = document.createElement('p')
          pEl.innerText = largestFilename
          pEl.style.fontSize = '0.875rem'
          pEl.style.opacity = 0
          pEl.style.position = 'absolute'
          document.body.appendChild(pEl)
          const textWidth = pEl.getBoundingClientRect()?.width
          if (textWidth) {
            this.pageMenuWidth = textWidth + (16 + 5 + 2 + 5)
          }
          pEl.remove()
        }

        if (this.numPages > 0) {
          this.loading = false
          const startPage = this.savedPage > 0 && this.savedPage <= this.numPages ? this.savedPage : 1
          this.setPage(startPage)
        } else {
          this.$toast.error('Comic has no pages')
          this.loading = false
        }
      } catch (error) {
        console.error('Failed to load comic metadata:', error)
        this.$toast.error('Failed to load comic')
        this.loading = false
      }
    },
    zoomIn() {
      this.scale += 10
    },
    zoomOut() {
      this.scale -= 10
    },
    scroll(event) {
      const imageContainer = this.$refs.imageContainer

      imageContainer.scrollBy({
        top: event.deltaY,
        left: event.deltaX,
        behavior: 'auto'
      })
    }
  },
  mounted() {
    const prevButton = this.$refs.prevButton
    const nextButton = this.$refs.nextButton

    prevButton.addEventListener('wheel', this.scroll, { passive: false })
    nextButton.addEventListener('wheel', this.scroll, { passive: false })
  },
  beforeDestroy() {
    const prevButton = this.$refs.prevButton
    const nextButton = this.$refs.nextButton

    prevButton.removeEventListener('wheel', this.scroll, { passive: false })
    nextButton.removeEventListener('wheel', this.scroll, { passive: false })
    
    // Clear preloaded pages
    this.preloadedPages.clear()
  }
}
</script>

<style scoped>
.pagemenu {
  max-height: calc(100% - 48px);
}
</style>
