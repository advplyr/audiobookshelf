<template>
  <div v-if="show" class="w-screen h-screen fixed top-0 left-0 z-50 bg-white text-black">
    <div class="absolute top-4 right-4 z-10">
      <span class="material-icons cursor-pointer text-4xl" @click="show = false">close</span>
    </div>
    <!-- <div v-if="chapters.length" class="absolute top-0 left-0 w-52">
      <select v-model="selectedChapter" class="w-52" @change="changedChapter">
        <option v-for="chapter in chapters" :key="chapter.href" :value="chapter.href">{{ chapter.label }}</option>
      </select>
    </div> -->
    <div class="absolute top-4 left-4 font-book">
      <h1 class="text-2xl mb-1">{{ title || abTitle }}</h1>
      <p v-if="author || abAuthor">by {{ author || abAuthor }}</p>
    </div>
    <div v-if="!epubEbook && mobiEbook" class="absolute top-4 left-0 w-full flex justify-center">
      <p class="text-error font-semibold">Warning: Reading mobi & azw3 files is in the very early stages</p>
    </div>

    <div v-if="epubEbook" class="h-full flex items-center">
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center overflow-x-hidden">
        <span v-show="hasPrev" class="material-icons text-black text-opacity-30 hover:text-opacity-80 cursor-pointer text-8xl" @mousedown.prevent @click="pageLeft">chevron_left</span>
      </div>
      <div id="frame" class="w-full" style="height: 650px">
        <div id="viewer" class="spreads"></div>

        <div class="px-16 flex justify-center" style="height: 50px">
          <p class="px-4">{{ progress }}%</p>
        </div>
      </div>
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center overflow-x-hidden">
        <span v-show="hasNext" class="material-icons text-black text-opacity-30 hover:text-opacity-80 cursor-pointer text-8xl" @mousedown.prevent @click="pageRight">chevron_right</span>
      </div>
    </div>
    <div v-else class="h-full flex items-center justify-center">
      <div class="w-full max-w-4xl overflow-y-auto border border-black border-opacity-10 p-4" style="max-height: 80vh">
        <div id="viewer" />
      </div>
    </div>
  </div>
</template>

<script>
import ePub from 'epubjs'
import mobijs from '@/assets/mobi.js'

export default {
  data() {
    return {
      book: null,
      rendition: null,
      chapters: [],
      title: '',
      author: '',
      progress: 0,
      hasNext: true,
      hasPrev: false
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.init()
      } else {
        this.close()
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.showEReader
      },
      set(val) {
        this.$store.commit('setShowEReader', val)
      }
    },
    abTitle() {
      return this.selectedAudiobook.book.title
    },
    abAuthor() {
      return this.selectedAudiobook.book.author
    },
    selectedAudiobook() {
      return this.$store.state.selectedAudiobook
    },
    libraryId() {
      return this.selectedAudiobook.libraryId
    },
    folderId() {
      return this.selectedAudiobook.folderId
    },
    ebooks() {
      return this.selectedAudiobook.ebooks || []
    },
    epubEbook() {
      return this.ebooks.find((eb) => eb.ext === '.epub')
    },
    epubPath() {
      return this.epubEbook ? this.epubEbook.path : null
    },
    mobiEbook() {
      return this.ebooks.find((eb) => eb.ext === '.mobi' || eb.ext === '.azw3')
    },
    mobiPath() {
      return this.mobiEbook ? this.mobiEbook.path : null
    },
    mobiUrl() {
      if (!this.mobiPath) return null
      return `/ebook/${this.libraryId}/${this.folderId}/${this.mobiPath}`
    },
    url() {
      if (!this.epubPath) return null
      return `/ebook/${this.libraryId}/${this.folderId}/${this.epubPath}`
    },
    userToken() {
      return this.$store.getters['user/getToken']
    }
    // fullUrl() {
    // var serverUrl = process.env.serverUrl || `/s/book/${this.audiobookId}`
    // return `${serverUrl}/${this.url}`
    // }
  },
  methods: {
    changedChapter() {
      if (this.rendition) {
        this.rendition.display(this.selectedChapter)
      }
    },
    pageLeft() {
      if (this.rendition) {
        this.rendition.prev()
      }
    },
    pageRight() {
      if (this.rendition) {
        this.rendition.next()
      }
    },
    keyUp(e) {
      if (!this.rendition) {
        console.error('No rendition')
        return
      }

      if ((e.keyCode || e.which) == 37) {
        this.rendition.prev()
      } else if ((e.keyCode || e.which) == 39) {
        this.rendition.next()
      } else if ((e.keyCode || e.which) == 27) {
        this.show = false
      }
    },
    registerListeners() {
      document.addEventListener('keyup', this.keyUp)
    },
    unregisterListeners() {
      document.removeEventListener('keyup', this.keyUp)
    },
    init() {
      this.registerListeners()

      if (this.epubEbook) {
        this.initEpub()
      } else if (this.mobiEbook) {
        this.initMobi()
      }
    },
    async initMobi() {
      var buff = await this.$axios.$get(this.mobiUrl, {
        responseType: 'blob'
      })
      var reader = new FileReader()
      reader.onload = function (event) {
        var file_content = event.target.result
        new mobijs(file_content).render_to('viewer')
      }
      reader.readAsArrayBuffer(buff)
    },
    initEpub() {
      // var book = ePub(this.url, {
      //   requestHeaders: {
      //     Authorization: `Bearer ${this.userToken}`
      //   }
      // })
      var book = ePub(this.url)
      this.book = book

      this.rendition = book.renderTo('viewer', {
        width: window.innerWidth - 200,
        height: 600,
        ignoreClass: 'annotator-hl',
        manager: 'continuous',
        spread: 'always'
      })
      var displayed = this.rendition.display()

      book.ready
        .then(() => {
          console.log('Book ready')
          return book.locations.generate(1600)
        })
        .then((locations) => {
          // console.log('Loaded locations', locations)
          // Wait for book to be rendered to get current page
          displayed.then(() => {
            // Get the current CFI
            var currentLocation = this.rendition.currentLocation()
            if (!currentLocation.start) {
              console.error('No Start', currentLocation)
            } else {
              var currentPage = book.locations.percentageFromCfi(currentLocation.start.cfi)
              // console.log('current page', currentPage)
            }
          })
        })

      book.loaded.navigation.then((toc) => {
        var _chapters = []
        toc.forEach((chapter) => {
          _chapters.push(chapter)
        })
        this.chapters = _chapters
      })
      book.loaded.metadata.then((metadata) => {
        this.author = metadata.creator
        this.title = metadata.title
      })

      this.rendition.on('keyup', this.keyUp)

      this.rendition.on('relocated', (location) => {
        var percent = book.locations.percentageFromCfi(location.start.cfi)
        var percentage = Math.floor(percent * 100)
        this.progress = percentage

        this.hasNext = !location.atEnd
        this.hasPrev = !location.atStart
      })
    },
    close() {
      this.unregisterListeners()
    }
  },
  mounted() {
    if (this.show) this.init()
  },
  beforeDestroy() {
    this.unregisterListeners()
  }
}
</script>