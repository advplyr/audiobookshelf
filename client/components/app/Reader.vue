<template>
  <div v-if="value" class="w-screen h-screen fixed top-0 left-0 z-50 bg-white text-black">
    <div class="absolute top-4 right-4 z-10">
      <span class="material-icons cursor-pointer text-4xl" @click="show = false">close</span>
    </div>
    <!-- <div v-if="chapters.length" class="absolute top-0 left-0 w-52">
      <select v-model="selectedChapter" class="w-52" @change="changedChapter">
        <option v-for="chapter in chapters" :key="chapter.href" :value="chapter.href">{{ chapter.label }}</option>
      </select>
    </div> -->
    <div class="absolute top-4 left-4 font-book">
      <h1 class="text-2xl mb-1">{{ title }}</h1>

      <p v-if="author">by {{ author }}</p>
    </div>
    <div class="h-full flex items-center">
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
  </div>
</template>

<script>
import ePub from 'epubjs'

export default {
  props: {
    value: Boolean,
    url: String
  },
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
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
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

      console.log('epub', this.url)
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