<template>
  <div id="bookshelf" ref="wrapper" class="w-full max-w-full h-full overflow-y-scroll relative">
    <!-- Cover size widget -->
    <widgets-cover-size-widget class="fixed bottom-4 right-4 z-30" />

    <div v-if="loaded && !shelves.length && !search" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl font-book mb-4 py-4">{{ libraryName }} Library is empty!</p>
      <div v-if="userIsAdminOrUp" class="flex">
        <ui-btn to="/config" color="primary" class="w-52 mr-2">Configure Scanner</ui-btn>
        <ui-btn color="success" class="w-52" @click="scan">Scan Library</ui-btn>
      </div>
    </div>
    <div v-else-if="loaded && !shelves.length && search" class="w-full h-40 flex items-center justify-center">
      <p class="text-center text-xl font-book py-4">No results for query</p>
    </div>
    <!-- Alternate plain view -->
    <div v-else-if="isAlternativeBookshelfView" class="w-full mb-24">
      <template v-for="(shelf, index) in shelves">
        <widgets-item-slider v-if="shelf.type === 'book' || shelf.type === 'podcast'" :key="index + '.'" :items="shelf.entities" :height="232 * sizeMultiplier" class="bookshelf-row pl-8 my-6">
          <p class="font-semibold text-gray-100" :style="{ fontSize: sizeMultiplier + 'rem' }">{{ shelf.label }}</p>
        </widgets-item-slider>
        <widgets-episode-slider v-else-if="shelf.type === 'episode'" :key="index + '.'" :items="shelf.entities" :height="232 * sizeMultiplier" class="bookshelf-row pl-8 my-6">
          <p class="font-semibold text-gray-100" :style="{ fontSize: sizeMultiplier + 'rem' }">{{ shelf.label }}</p>
        </widgets-episode-slider>
        <widgets-series-slider v-else-if="shelf.type === 'series'" :key="index + '.'" :items="shelf.entities" :height="232 * sizeMultiplier" class="bookshelf-row pl-8 my-6">
          <p class="font-semibold text-gray-100" :style="{ fontSize: sizeMultiplier + 'rem' }">{{ shelf.label }}</p>
        </widgets-series-slider>
        <widgets-authors-slider v-else-if="shelf.type === 'authors'" :key="index + '.'" :items="shelf.entities" :height="192 * sizeMultiplier" class="bookshelf-row pl-8 my-6">
          <p class="font-semibold text-gray-100" :style="{ fontSize: sizeMultiplier + 'rem' }">{{ shelf.label }}</p>
        </widgets-authors-slider>
      </template>
    </div>
    <!-- Regular bookshelf view -->
    <div v-else class="w-full">
      <template v-for="(shelf, index) in shelves">
        <app-book-shelf-row :key="index" :index="index" :shelf="shelf" :size-multiplier="sizeMultiplier" :book-cover-width="bookCoverWidth" :book-cover-aspect-ratio="coverAspectRatio" />
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
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryName() {
      return this.$store.getters['libraries/getCurrentLibraryName']
    },
    isAlternativeBookshelfView() {
      return this.$store.getters['getHomeBookshelfView'] === this.$constants.BookshelfView.TITLES
    },
    bookCoverWidth() {
      var coverSize = this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
      if (this.isCoverSquareAspectRatio) return coverSize * 1.6
      return coverSize
    },
    coverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    isCoverSquareAspectRatio() {
      return this.coverAspectRatio == 1
    },
    sizeMultiplier() {
      var baseSize = this.isCoverSquareAspectRatio ? 192 : 120
      return this.bookCoverWidth / baseSize
    }
  },
  methods: {
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
        .$get(`/api/libraries/${this.currentLibraryId}/personalized`)
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
      if (this.results.books && this.results.books.length) {
        shelves.push({
          id: 'books',
          label: 'Books',
          type: 'book',
          entities: this.results.books.map((res) => res.libraryItem)
        })
      }

      if (this.results.podcasts && this.results.podcasts.length) {
        shelves.push({
          id: 'podcasts',
          label: 'Podcasts',
          type: 'podcast',
          entities: this.results.podcasts.map((res) => res.libraryItem)
        })
      }

      if (this.results.series && this.results.series.length) {
        shelves.push({
          id: 'series',
          label: 'Series',
          type: 'series',
          entities: this.results.series.map((seriesObj) => {
            return {
              ...seriesObj.series,
              books: seriesObj.books,
              type: 'series'
            }
          })
        })
      }
      if (this.results.tags && this.results.tags.length) {
        shelves.push({
          id: 'tags',
          label: 'Tags',
          type: 'tags',
          entities: this.results.tags.map((tagObj) => {
            return {
              name: tagObj.name,
              books: tagObj.books || [],
              type: 'tags'
            }
          })
        })
      }
      if (this.results.authors && this.results.authors.length) {
        shelves.push({
          id: 'authors',
          label: 'Authors',
          type: 'authors',
          entities: this.results.authors.map((a) => {
            return {
              ...a,
              type: 'author'
            }
          })
        })
      }
      this.shelves = shelves
    },
    settingsUpdated(settings) {},
    scan() {
      this.$store
        .dispatch('libraries/requestLibraryScan', { libraryId: this.$store.state.libraries.currentLibraryId })
        .then(() => {
          this.$toast.success('Library scan started')
        })
        .catch((error) => {
          console.error('Failed to start scan', error)
          this.$toast.error('Failed to start scan')
        })
    },
    libraryItemAdded(libraryItem) {
      console.log('libraryItem added', libraryItem)
      // TODO: Check if libraryItem would be on this shelf
      if (!this.search) {
        this.fetchCategories()
      }
    },
    libraryItemUpdated(libraryItem) {
      console.log('libraryItem updated', libraryItem)
      this.shelves.forEach((shelf) => {
        if (shelf.type == 'book' || shelf.type == 'podcast') {
          shelf.entities = shelf.entities.map((ent) => {
            if (ent.id === libraryItem.id) {
              return libraryItem
            }
            return ent
          })
        } else if (shelf.type === 'series') {
          shelf.entities.forEach((ent) => {
            ent.books = ent.books.map((book) => {
              if (book.id === libraryItem.id) return libraryItem
              return book
            })
          })
        }
      })
    },
    removeBookFromShelf(libraryItem) {
      this.shelves.forEach((shelf) => {
        if (shelf.type == 'book' || shelf.type == 'podcast') {
          shelf.entities = shelf.entities.filter((ent) => {
            return ent.id !== libraryItem.id
          })
        } else if (shelf.type === 'series') {
          shelf.entities.forEach((ent) => {
            ent.books = ent.books.filter((book) => {
              return book.id !== libraryItem.id
            })
          })
        }
      })
    },
    libraryItemRemoved(libraryItem) {
      this.removeBookFromShelf(libraryItem)
    },
    libraryItemsAdded(libraryItems) {
      console.log('libraryItems added', libraryItems)
      // TODO: Check if audiobook would be on this shelf
      if (!this.search) {
        this.fetchCategories()
      }
    },
    libraryItemsUpdated(items) {
      items.forEach((li) => {
        this.libraryItemUpdated(li)
      })
    },
    seriesUpdated(series) {
      if (series.hideFromHome) {
        this.shelves.forEach((shelf) => {
          if (shelf.type == 'book' && shelf.id == 'continue-series') {
            // Filter out series books from continue series shelf
            shelf.entities = shelf.entities.filter((ent) => {
              if (ent.media.metadata.series && ent.media.metadata.series.id == series.id) return false
              return true
            })
          } else if (shelf.type == 'series') {
            // Filter out series from series shelf
            shelf.entities = shelf.entities.filter((ent) => {
              return ent.id != series.id
            })
          }
        })
      }
    },
    authorUpdated(author) {
      this.shelves.forEach((shelf) => {
        if (shelf.type == 'authors') {
          shelf.entities = shelf.entities.map((ent) => {
            if (ent.id === author.id) {
              return {
                ...ent,
                ...author
              }
            }
            return ent
          })
        }
      })
    },
    authorRemoved(author) {
      this.shelves.forEach((shelf) => {
        if (shelf.type == 'authors') {
          shelf.entities = shelf.entities.filter((ent) => ent.id != author.id)
        }
      })
    },
    initListeners() {
      this.$store.commit('user/addSettingsListener', { id: 'bookshelf', meth: this.settingsUpdated })

      if (this.$root.socket) {
        this.$root.socket.on('series_updated', this.seriesUpdated)
        this.$root.socket.on('author_updated', this.authorUpdated)
        this.$root.socket.on('author_removed', this.authorRemoved)
        this.$root.socket.on('item_updated', this.libraryItemUpdated)
        this.$root.socket.on('item_added', this.libraryItemAdded)
        this.$root.socket.on('item_removed', this.libraryItemRemoved)
        this.$root.socket.on('items_updated', this.libraryItemsUpdated)
        this.$root.socket.on('items_added', this.libraryItemsAdded)
      } else {
        console.error('Error socket not initialized')
      }
    },
    removeListeners() {
      this.$store.commit('user/removeSettingsListener', 'bookshelf')

      if (this.$root.socket) {
        this.$root.socket.off('series_updated', this.seriesUpdated)
        this.$root.socket.off('author_updated', this.authorUpdated)
        this.$root.socket.off('author_removed', this.authorRemoved)
        this.$root.socket.off('item_updated', this.libraryItemUpdated)
        this.$root.socket.off('item_added', this.libraryItemAdded)
        this.$root.socket.off('item_removed', this.libraryItemRemoved)
        this.$root.socket.off('items_updated', this.libraryItemsUpdated)
        this.$root.socket.off('items_added', this.libraryItemsAdded)
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
