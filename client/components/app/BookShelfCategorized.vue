<template>
  <div id="bookshelf" ref="wrapper" class="w-full h-full overflow-y-scroll relative">
    <!-- Cover size widget -->
    <widgets-cover-size-widget class="fixed bottom-4 right-4 z-30" />
    <!-- Experimental Bookshelf Texture -->
    <div v-show="showExperimentalFeatures" class="fixed bottom-4 right-28 z-40">
      <div class="rounded-full py-1 bg-primary hover:bg-bg cursor-pointer px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent @click="showBookshelfTextureModal"><p class="text-sm py-0.5">Texture</p></div>
    </div>

    <div v-if="loaded && !shelves.length && isRootUser" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl font-book mb-4 py-4">Audiobookshelf is empty!</p>
      <div class="flex">
        <ui-btn to="/config" color="primary" class="w-52 mr-2">Configure Scanner</ui-btn>
        <ui-btn color="success" class="w-52" @click="scan">Scan Audiobooks</ui-btn>
      </div>
    </div>
    <div v-else class="w-full flex flex-col items-center">
      <template v-for="(shelf, index) in shelves">
        <app-book-shelf-row :key="index" :index="index" :shelf="shelf" :size-multiplier="sizeMultiplier" :book-cover-width="bookCoverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
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
      keywordFilterTimeout: null,
      scannerParseSubtitle: false,
      wrapperClientWidth: 0,
      shelves: []
    }
  },
  computed: {
    isRootUser() {
      return this.$store.getters['user/getIsRoot']
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    bookCoverWidth() {
      var coverSize = this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
      if (this.isCoverSquareAspectRatio) return coverSize * 1.6
      return coverSize
    },
    coverAspectRatio() {
      return this.$store.getters['settings/getServerSetting']('coverAspectRatio')
    },
    isCoverSquareAspectRatio() {
      return this.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE
    },
    bookCoverAspectRatio() {
      return this.isCoverSquareAspectRatio ? 1 : 1.6
    },
    sizeMultiplier() {
      var baseSize = this.isCoverSquareAspectRatio ? 192 : 120
      return this.bookCoverWidth / baseSize
    }
  },
  methods: {
    showBookshelfTextureModal() {
      this.$store.commit('globals/setShowBookshelfTextureModal', true)
    },
    async init() {
      this.wrapperClientWidth = this.$refs.wrapper ? this.$refs.wrapper.clientWidth : 0

      if (this.search) {
        this.setShelvesFromSearch()
      } else {
        await this.fetchCategories()
      }
      this.loaded = true
    },
    async fetchCategories() {
      var categories = await this.$axios
        .$get(`/api/libraries/${this.currentLibraryId}/categories?minified=1`)
        .then((data) => {
          return data
        })
        .catch((error) => {
          console.error('Failed to fetch categories', error)
          return []
        })
      this.shelves = categories
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
      if (this.results.authors) {
        shelves.push({
          id: 'authors',
          label: 'Authors',
          type: 'authors',
          entities: this.results.authors.map((a) => {
            return {
              id: a.author,
              name: a.author,
              numBooks: a.numBooks,
              type: 'author'
            }
          })
        })
      }
      this.shelves = shelves
    },
    settingsUpdated(settings) {},
    scan() {
      this.$root.socket.emit('scan', this.$store.state.libraries.currentLibraryId)
    },
    audiobookAdded(audiobook) {
      console.log('Audiobook added', audiobook)
      // TODO: Check if audiobook would be on this shelf
      if (!this.search) {
        this.fetchCategories()
      }
    },
    audiobookUpdated(audiobook) {
      console.log('Audiobook updated', audiobook)
      this.shelves.forEach((shelf) => {
        if (shelf.type === 'books') {
          shelf.entities = shelf.entities.map((ent) => {
            if (ent.id === audiobook.id) {
              return audiobook
            }
            return ent
          })
        } else if (shelf.type === 'series') {
          shelf.entities.forEach((ent) => {
            ent.books = ent.books.map((book) => {
              if (book.id === audiobook.id) return audiobook
              return book
            })
          })
        }
      })
    },
    removeBookFromShelf(audiobook) {
      this.shelves.forEach((shelf) => {
        if (shelf.type === 'books') {
          shelf.entities = shelf.entities.filter((ent) => {
            return ent.id !== audiobook.id
          })
        } else if (shelf.type === 'series') {
          shelf.entities.forEach((ent) => {
            ent.books = ent.books.filter((book) => {
              return book.id !== audiobook.id
            })
          })
        }
      })
    },
    audiobookRemoved(audiobook) {
      this.removeBookFromShelf(audiobook)
    },
    audiobooksAdded(audiobooks) {
      console.log('audiobooks added', audiobooks)
      // TODO: Check if audiobook would be on this shelf
      if (!this.search) {
        this.fetchCategories()
      }
    },
    audiobooksUpdated(audiobooks) {
      audiobooks.forEach((ab) => {
        this.audiobookUpdated(ab)
      })
    },
    initListeners() {
      this.$store.commit('user/addSettingsListener', { id: 'bookshelf', meth: this.settingsUpdated })

      if (this.$root.socket) {
        this.$root.socket.on('audiobook_updated', this.audiobookUpdated)
        this.$root.socket.on('audiobook_added', this.audiobookAdded)
        this.$root.socket.on('audiobook_removed', this.audiobookRemoved)
        this.$root.socket.on('audiobooks_updated', this.audiobooksUpdated)
        this.$root.socket.on('audiobooks_added', this.audiobooksAdded)
      } else {
        console.error('Error socket not initialized')
      }
    },
    removeListeners() {
      this.$store.commit('user/removeSettingsListener', 'bookshelf')

      if (this.$root.socket) {
        this.$root.socket.off('audiobook_updated', this.audiobookUpdated)
        this.$root.socket.off('audiobook_added', this.audiobookAdded)
        this.$root.socket.off('audiobook_removed', this.audiobookRemoved)
        this.$root.socket.off('audiobooks_updated', this.audiobooksUpdated)
        this.$root.socket.off('audiobooks_added', this.audiobooksAdded)
      } else {
        console.error('Error socket not initialized')
      }
    }
  },
  mounted() {
    this.initListeners()
    this.init()
  },
  beforeDestroy() {
    this.removeListeners()
  }
}
</script>
