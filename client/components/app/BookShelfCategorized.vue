<template>
  <div id="bookshelf" ref="wrapper" class="w-full h-full overflow-y-scroll relative">
    <!-- Cover size widget -->
    <div class="fixed bottom-4 right-4 z-40">
      <div class="rounded-full py-1 bg-primary px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent>
        <span class="material-icons" :class="selectedSizeIndex === 0 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="decreaseSize">remove</span>
        <p class="px-2 font-mono">{{ bookCoverWidth }}</p>
        <span class="material-icons" :class="selectedSizeIndex === availableSizes.length - 1 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="increaseSize">add</span>
      </div>
    </div>
    <!-- Experimental Bookshelf Texture -->
    <div v-show="showExperimentalFeatures" class="fixed bottom-4 right-28 z-40">
      <div class="rounded-full py-1 bg-primary hover:bg-bg cursor-pointer px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent @click="showBookshelfTextureModal"><p class="text-sm py-0.5">Texture</p></div>
    </div>

    <div v-if="loaded && !shelves.length" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl font-book mb-4 py-4">Your Audiobookshelf is empty!</p>
      <div class="flex">
        <ui-btn to="/config" color="primary" class="w-52 mr-2" @click="scan">Configure Scanner</ui-btn>
        <ui-btn color="success" class="w-52" @click="scan">Scan Audiobooks</ui-btn>
      </div>
    </div>
    <div v-else class="w-full flex flex-col items-center">
      <template v-for="(shelf, index) in shelves">
        <app-book-shelf-row :key="index" :index="index" :shelf="shelf" :size-multiplier="sizeMultiplier" :book-cover-width="bookCoverWidth" />
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    search: Boolean,
    results: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      loaded: false,
      availableSizes: [60, 80, 100, 120, 140, 160, 180, 200, 220],
      selectedSizeIndex: 3,
      keywordFilterTimeout: null,
      scannerParseSubtitle: false,
      wrapperClientWidth: 0,
      shelves: []
    }
  },
  computed: {
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    bookCoverWidth() {
      return this.availableSizes[this.selectedSizeIndex]
    },
    sizeMultiplier() {
      return this.bookCoverWidth / 120
    }
  },
  methods: {
    showBookshelfTextureModal() {
      this.$store.commit('globals/setShowBookshelfTextureModal', true)
    },
    increaseSize() {
      this.selectedSizeIndex = Math.min(this.availableSizes.length - 1, this.selectedSizeIndex + 1)
      this.resize()
      this.$store.dispatch('user/updateUserSettings', { bookshelfCoverSize: this.bookCoverWidth })
    },
    decreaseSize() {
      this.selectedSizeIndex = Math.max(0, this.selectedSizeIndex - 1)
      this.resize()
      this.$store.dispatch('user/updateUserSettings', { bookshelfCoverSize: this.bookCoverWidth })
    },
    async init() {
      this.wrapperClientWidth = this.$refs.wrapper ? this.$refs.wrapper.clientWidth : 0

      var bookshelfCoverSize = this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
      var sizeIndex = this.availableSizes.findIndex((s) => s === bookshelfCoverSize)
      if (!isNaN(sizeIndex)) this.selectedSizeIndex = sizeIndex

      // await this.$store.dispatch('audiobooks/load')
      if (this.search) {
        this.setShelvesFromSearch()
      } else {
        var categories = await this.$axios
          .$get(`/api/libraries/${this.currentLibraryId}/categories`)
          .then((data) => {
            console.log('Category data', data)
            return data
          })
          .catch((error) => {
            console.error('Failed to fetch cats', error)
          })
        this.shelves = categories
      }

      this.loaded = true
    },
    async setShelvesFromSearch() {
      var shelves = []
      if (this.results.audiobooks) {
        shelves.push({
          id: 'audiobooks',
          label: 'Books',
          type: 'books',
          entities: this.results.audiobooks.map((ab) => ab.audiobook)
        })
      }
      if (this.results.authors) {
        shelves.push({
          id: 'authors',
          label: 'Authors',
          type: 'authors',
          entities: this.results.authors.map((a) => a.author)
        })
      }
      if (this.results.series) {
        shelves.push({
          id: 'series',
          label: 'Series',
          type: 'series',
          entities: this.results.series.map((seriesObj) => {
            return {
              name: seriesObj.series,
              books: seriesObj.audiobooks,
              type: 'series'
            }
          })
        })
      }
      if (this.results.tags) {
        shelves.push({
          id: 'tags',
          label: 'Tags',
          type: 'tags',
          entities: this.results.tags.map((tagObj) => {
            return {
              name: tagObj.tag,
              books: tagObj.audiobooks,
              type: 'tags'
            }
          })
        })
      }
      this.shelves = shelves
    },
    resize() {},
    settingsUpdated(settings) {
      if (settings.bookshelfCoverSize !== this.bookCoverWidth && settings.bookshelfCoverSize !== undefined) {
        var index = this.availableSizes.indexOf(settings.bookshelfCoverSize)
        if (index >= 0) {
          this.selectedSizeIndex = index
          this.resize()
        }
      }
    },
    scan() {
      this.$root.socket.emit('scan', this.$store.state.libraries.currentLibraryId)
    }
  },
  mounted() {
    this.$store.commit('user/addSettingsListener', { id: 'bookshelf', meth: this.settingsUpdated })

    this.init()
  },
  beforeDestroy() {
    this.$store.commit('user/removeSettingsListener', 'bookshelf')
  }
}
</script>
