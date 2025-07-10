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
    <a v-if="pages && numPages" :href="mainImg" :download="pages[page - 1]" class="absolute top-0 bg-bg text-gray-100 border-b border-l border-r border-gray-400 hover:bg-black-200 cursor-pointer rounded-b-md w-10 h-9 flex items-center justify-center text-center z-20" :class="comicMetadata ? 'left-28 sm:left-32' : 'left-16 sm:left-20'">
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
          <img v-if="mainImg" :style="{ minWidth: scale + '%', width: scale + '%' }" :src="mainImg" class="object-contain m-auto" />
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
import { Archive } from 'libarchive.js/main.js'
import { CompressedFile } from 'libarchive.js/src/compressed-file'

// This is % with respect to the screen width
const MAX_SCALE = 400
const MIN_SCALE = 10

Archive.init({
  workerUrl: '/libarchive/worker-bundle.js'
})

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
      filesObject: null,
      mainImg: null,
      page: 0,
      numPages: 0,
      pageMenuWidth: 256,
      showPageMenu: false,
      showInfoMenu: false,
      loadTimeout: null,
      loadedFirstPage: false,
      comicMetadata: null,
      scale: 80
    }
  },
  watch: {
    url: {
      immediate: true,
      handler() {
        this.extract()
      }
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem?.id
    },
    ebookUrl() {
      if (this.fileId) {
        return `/api/items/${this.libraryItemId}/ebook/${this.fileId}`
      }
      return `/api/items/${this.libraryItemId}/ebook`
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
          if (p.length > 50) {
            let firstHalf = p.slice(0, 22)
            let lastHalf = p.slice(p.length - 23)
            return `${firstHalf} ... ${lastHalf}`
          }
          return p
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
    setPage(page) {
      if (page <= 0 || page > this.numPages) {
        return
      }
      this.showPageMenu = false
      this.showInfoMenu = false
      const filename = this.pages[page - 1]
      this.page = page
      this.updateProgress()
      return this.extractFile(filename)
    },
    setLoadTimeout() {
      this.loadTimeout = setTimeout(() => {
        this.loading = true
      }, 150)
    },
    extractFile(filename) {
      return new Promise(async (resolve) => {
        this.setLoadTimeout()
        var file = await this.filesObject[filename].extract()
        var reader = new FileReader()
        reader.onload = (e) => {
          this.mainImg = e.target.result
          this.loading = false
          resolve()
        }
        reader.onerror = (e) => {
          console.error(e)
          this.$toast.error('Read page file failed')
          this.loading = false
          resolve()
        }
        reader.readAsDataURL(file)
        clearTimeout(this.loadTimeout)
      })
    },
    async extract() {
      this.loading = true
      var buff = await this.$axios.$get(this.ebookUrl, {
        responseType: 'blob'
      })
      const archive = await Archive.open(buff)
      const originalFilesObject = await archive.getFilesObject()
      // to support images in subfolders we need to flatten the object
      //   ref: https://github.com/advplyr/audiobookshelf/issues/811
      this.filesObject = this.flattenFilesObject(originalFilesObject)
      console.log('Extracted files object', this.filesObject)
      var filenames = Object.keys(this.filesObject)
      this.parseFilenames(filenames)

      var xmlFile = filenames.find((f) => (Path.extname(f) || '').toLowerCase() === '.xml')
      if (xmlFile) await this.extractXmlFile(xmlFile)

      this.numPages = this.pages.length

      // Calculate page menu size
      const largestFilename = this.cleanedPageNames
        .map((p) => p)
        .sort((a, b) => a.length - b.length)
        .pop()
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

      if (this.pages.length) {
        this.loading = false

        const startPage = this.savedPage > 0 && this.savedPage <= this.numPages ? this.savedPage : 1
        await this.setPage(startPage)
        this.loadedFirstPage = true
      } else {
        this.$toast.error('Unable to extract pages')
        this.loading = false
      }
    },
    flattenFilesObject(filesObject) {
      const flattenObject = (obj, prefix = '') => {
        var _obj = {}
        for (const key in obj) {
          const newKey = prefix ? prefix + '/' + key : key
          if (obj[key] instanceof CompressedFile) {
            _obj[newKey] = obj[key]
          } else if (!key.startsWith('_') && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            _obj = {
              ..._obj,
              ...flattenObject(obj[key], newKey)
            }
          } else {
            _obj[newKey] = obj[key]
          }
        }
        return _obj
      }
      return flattenObject(filesObject)
    },
    async extractXmlFile(filename) {
      console.log('extracting xml filename', filename)
      try {
        var file = await this.filesObject[filename].extract()
        var reader = new FileReader()
        reader.onload = (e) => {
          this.comicMetadata = this.$xmlToJson(e.target.result)
          console.log('Metadata', this.comicMetadata)
        }
        reader.onerror = (e) => {
          console.error(e)
        }
        reader.readAsText(file)
      } catch (error) {
        console.error(error)
      }
    },
    parseImageFilename(filename) {
      var basename = Path.basename(filename, Path.extname(filename))
      var numbersinpath = basename.match(/\d+/g)
      if (!numbersinpath?.length) {
        return {
          index: -1,
          filename
        }
      } else {
        return {
          index: Number(numbersinpath[numbersinpath.length - 1]),
          filename
        }
      }
    },
    parseFilenames(filenames) {
      const acceptableImages = ['.jpeg', '.jpg', '.png', '.webp']
      var imageFiles = filenames.filter((f) => {
        return acceptableImages.includes((Path.extname(f) || '').toLowerCase())
      })
      var imageFileObjs = imageFiles.map((img) => {
        return this.parseImageFilename(img)
      })

      var imagesWithNum = imageFileObjs.filter((i) => i.index >= 0)
      var orderedImages = imagesWithNum.sort((a, b) => a.index - b.index).map((i) => i.filename)
      var noNumImages = imageFileObjs.filter((i) => i.index < 0)
      orderedImages = orderedImages.concat(noNumImages.map((i) => i.filename))

      this.pages = orderedImages
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
  }
}
</script>

<style scoped>
.pagemenu {
  max-height: calc(100% - 48px);
}
</style>
