<template>
  <div class="h-full w-full">
    <div class="h-full flex items-center">
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center overflow-x-hidden justify-center">
        <span v-show="hasPrev" class="material-icons text-white text-opacity-50 hover:text-opacity-80 cursor-pointer text-6xl" @mousedown.prevent @click="prev">chevron_left</span>
      </div>
      <div id="frame" class="w-full" style="height: 650px">
        <div id="viewer" class="border border-gray-100 bg-white shadow-md"></div>

        <div class="py-4 flex justify-center" style="height: 50px">
          <p>{{ progress }}%</p>
        </div>
      </div>
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center justify-center overflow-x-hidden">
        <span v-show="hasNext" class="material-icons text-white text-opacity-50 hover:text-opacity-80 cursor-pointer text-6xl" @mousedown.prevent @click="next">chevron_right</span>
      </div>
    </div>
  </div>
</template>

<script>
import ePub from 'epubjs'

export default {
  props: {
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
  computed: {},
  methods: {
    changedChapter() {
      if (this.rendition) {
        this.rendition.display(this.selectedChapter)
      }
    },
    prev() {
      if (this.rendition) {
        this.rendition.prev()
      }
    },
    next() {
      if (this.rendition) {
        this.rendition.next()
      }
    },
    keyUp() {
      if ((e.keyCode || e.which) == 37) {
        this.prev()
      } else if ((e.keyCode || e.which) == 39) {
        this.next()
      }
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
        this.progress = Math.floor(percent * 100)

        this.hasNext = !location.atEnd
        this.hasPrev = !location.atStart
      })
    }
  },
  mounted() {
    this.initEpub()
  }
}
</script>
