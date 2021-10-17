<template>
  <div class="w-full">
    <div v-show="showPageMenu" v-click-outside="clickOutside" class="pagemenu absolute top-9 right-20 rounded-md overflow-y-auto bg-white shadow-lg z-20 border border-gray-400">
      <div v-for="(file, index) in pages" :key="file" class="w-full cursor-pointer hover:bg-gray-200 px-2 py-1" @click="setPage(index)">
        <p class="text-sm">{{ file }}</p>
      </div>
    </div>

    <div class="absolute top-0 right-40 border-b border-l border-r border-gray-400 hover:bg-gray-200 cursor-pointer rounded-b-md bg-gray-50 w-10 h-9 flex items-center justify-center text-center z-20" @mousedown.prevent @click.stop.prevent="showPageMenu = !showPageMenu">
      <span class="material-icons">menu</span>
    </div>
    <div class="absolute top-0 right-20 border-b border-l border-r border-gray-400 rounded-b-md bg-gray-50 px-2 h-9 flex items-center text-center">
      <p class="font-mono">{{ page + 1 }} / {{ numPages }}</p>
    </div>

    <div class="overflow-hidden m-auto comicwrapper relative">
      <div class="flex items-center justify-center">
        <div class="px-12">
          <span v-show="loadedFirstPage" class="material-icons text-5xl text-black" :class="!canGoPrev ? 'text-opacity-10' : 'cursor-pointer text-opacity-30 hover:text-opacity-90'" @click.stop.prevent="goPrevPage" @mousedown.prevent>arrow_back_ios</span>
        </div>

        <img v-if="mainImg" :src="mainImg" class="object-contain comicimg" />

        <div class="px-12">
          <span v-show="loadedFirstPage" class="material-icons text-5xl text-black" :class="!canGoNext ? 'text-opacity-10' : 'cursor-pointer text-opacity-30 hover:text-opacity-90'" @click.stop.prevent="goNextPage" @mousedown.prevent>arrow_forward_ios</span>
        </div>
      </div>

      <div v-show="loading" class="w-full h-full absolute top-0 left-0 flex items-center justify-center z-10">
        <ui-loading-indicator />
      </div>
    </div>

    <!-- <div v-show="loading" class="w-screen h-screen absolute top-0 left-0 bg-black bg-opacity-20 flex items-center justify-center">
      <ui-loading-indicator />
    </div> -->
  </div>
</template>

<script>
import Path from 'path'
import { Archive } from 'libarchive.js/main.js'

Archive.init({
  workerUrl: '/libarchive/worker-bundle.js'
})
// Archive.init()

export default {
  props: {
    src: String
  },
  data() {
    return {
      loading: false,
      pages: null,
      filesObject: null,
      mainImg: null,
      page: 0,
      numPages: 0,
      showPageMenu: false,
      loadTimeout: null,
      loadedFirstPage: false
    }
  },
  watch: {
    src: {
      immediate: true,
      handler(newVal) {
        this.extract()
      }
    }
  },
  computed: {
    canGoNext() {
      return this.page < this.numPages - 1
    },
    canGoPrev() {
      return this.page > 0
    }
  },
  methods: {
    clickOutside() {
      if (this.showPageMenu) this.showPageMenu = false
    },
    goNextPage() {
      if (!this.canGoNext) return
      this.setPage(this.page + 1)
    },
    goPrevPage() {
      if (!this.canGoPrev) return
      this.setPage(this.page - 1)
    },
    setPage(index) {
      if (index < 0 || index > this.numPages - 1) {
        return
      }
      var filename = this.pages[index]
      this.page = index
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
      console.log('Extracting', this.src)

      var buff = await this.$axios.$get(this.src, {
        responseType: 'blob'
      })
      const archive = await Archive.open(buff)
      this.filesObject = await archive.getFilesObject()
      var filenames = Object.keys(this.filesObject)
      this.parseFilenames(filenames)

      this.numPages = this.pages.length

      if (this.pages.length) {
        this.loading = false
        await this.setPage(0)
        this.loadedFirstPage = true
      } else {
        this.$toast.error('Unable to extract pages')
        this.loading = false
      }
    },
    parseImageFilename(filename) {
      var basename = Path.basename(filename, Path.extname(filename))
      var numbersinpath = basename.match(/\d{1,4}/g)
      if (!numbersinpath || !numbersinpath.length) {
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
      const acceptableImages = ['.jpeg', '.jpg', '.png']
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
    keyUp(e) {
      if ((e.keyCode || e.which) == 37) {
        this.goPrevPage()
      } else if ((e.keyCode || e.which) == 39) {
        this.goNextPage()
      } else if ((e.keyCode || e.which) == 27) {
        this.unregisterListeners()
        this.$emit('close')
      }
    },
    registerListeners() {
      document.addEventListener('keyup', this.keyUp)
    },
    unregisterListeners() {
      document.removeEventListener('keyup', this.keyUp)
    }
  },
  mounted() {
    this.registerListeners()
  },
  beforeDestroy() {
    this.unregisterListeners()
  }
}
</script>

<style scoped>
.pagemenu {
  max-height: calc(100vh - 60px);
}
.comicimg {
  height: calc(100vh - 40px);
  margin: auto;
}
.comicwrapper {
  width: calc(100vw - 300px);
  height: calc(100vh - 40px);
}
</style>