<template>
  <div id="bookshelf" class="bookshelf overflow-hidden relative block max-h-full">
    <div ref="wrapper" class="h-full w-full relative" :class="isGridMode ? 'overflow-y-scroll' : 'overflow-hidden'">
      <!-- Cover size widget -->
      <div v-show="!isSelectionMode && isGridMode" class="fixed bottom-2 right-4 z-30">
        <div class="rounded-full py-1 bg-primary px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent>
          <span class="material-icons" :class="selectedSizeIndex === 0 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="decreaseSize">remove</span>
          <p class="px-2 font-mono">{{ bookCoverWidth }}</p>
          <span class="material-icons" :class="selectedSizeIndex === availableSizes.length - 1 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="increaseSize">add</span>
        </div>
      </div>

      <div v-if="!audiobooks.length" class="w-full flex flex-col items-center justify-center py-12">
        <p class="text-center text-2xl font-book mb-4 py-4">Your Audiobookshelf is empty!</p>
        <div class="flex">
          <ui-btn to="/config" color="primary" class="w-52 mr-2" @click="scan">Configure Scanner</ui-btn>
          <ui-btn color="success" class="w-52" @click="scan">Scan Audiobooks</ui-btn>
        </div>
      </div>
      <div v-else-if="page === 'search'" id="bookshelf-categorized" class="w-full flex flex-col items-center">
        <template v-for="(shelf, index) in categorizedShelves">
          <app-book-shelf-row :key="index" :index="index" :shelf="shelf" :size-multiplier="sizeMultiplier" :book-cover-width="bookCoverWidth" />
        </template>
        <div v-show="!categorizedShelves.length" class="w-full py-16 text-center text-xl">
          <div class="py-4 mb-6"><p class="text-2xl">No Results</p></div>
        </div>
      </div>
      <div v-else class="w-full">
        <template v-if="viewMode === 'grid'">
          <div class="w-full flex flex-col items-center">
            <template v-for="(shelf, index) in shelves">
              <div :key="index" class="w-full bookshelfRow relative">
                <div class="flex justify-center items-center">
                  <template v-for="entity in shelf">
                    <cards-group-card v-if="showGroups" :key="entity.id" :width="bookCoverWidth" :group="entity" @click="clickGroup" />
                    <!-- <cards-book-3d :key="entity.id" v-else :width="100" :src="$store.getters['audiobooks/getBookCoverSrc'](entity.book)" /> -->
                    <cards-book-card v-else :key="entity.id" :show-volume-number="!!selectedSeries" :width="bookCoverWidth" :user-progress="userAudiobooks[entity.id]" :audiobook="entity" @edit="editBook" />
                  </template>
                </div>
                <div class="bookshelfDivider h-4 w-full absolute bottom-0 left-0 right-0 z-10" />
              </div>
            </template>
          </div>
        </template>
        <template v-else>
          <app-book-list :books="entities" />
        </template>
        <div v-show="!shelves.length" class="w-full py-16 text-center text-xl">
          <div v-if="page === 'search'" class="py-4 mb-6"><p class="text-2xl">No Results</p></div>
          <div v-else class="py-4">No {{ showGroups ? 'Series' : 'Audiobooks' }}</div>
          <ui-btn v-if="!showGroups && (filterBy !== 'all' || keywordFilter)" @click="clearFilter">Clear Filter</ui-btn>
          <ui-btn v-else-if="page === 'search'" to="/library">Back to Library</ui-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    page: String,
    selectedSeries: String,
    searchResults: {
      type: Object,
      default: () => {}
    },
    searchQuery: String,
    viewMode: String
  },
  data() {
    return {
      shelves: [],
      currSearchParams: null,
      availableSizes: [60, 80, 100, 120, 140, 160, 180, 200, 220],
      selectedSizeIndex: 3,
      rowPaddingX: 40,
      keywordFilterTimeout: null,
      scannerParseSubtitle: false,
      wrapperClientWidth: 0
    }
  },
  watch: {
    keywordFilter() {
      this.checkKeywordFilter()
    },
    selectedSeries() {
      this.$nextTick(() => {
        this.$store.commit('audiobooks/setSelectedSeries', this.selectedSeries)
        this.setBookshelfEntities()
      })
    },
    searchResults() {
      this.$nextTick(() => {
        // this.$store.commit('audiobooks/setSearchResults', this.searchResults)
        this.setBookshelfEntities()
      })
    },
    '$route.query.filter'() {
      if (this.$route.query.filter && this.$route.query.filter !== this.filterBy) {
        this.$store.dispatch('user/updateUserSettings', { filterBy: this.$route.query.filter })
      } else if (!this.$route.query.filter && this.filterBy) {
        this.$store.dispatch('user/updateUserSettings', { filterBy: 'all' })
      }
    }
  },
  computed: {
    isGridMode() {
      return this.viewMode === 'grid'
    },
    keywordFilter() {
      return this.$store.state.audiobooks.keywordFilter
    },
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    },
    audiobooks() {
      return this.$store.state.audiobooks.audiobooks
    },
    sizeMultiplier() {
      return this.bookCoverWidth / 120
    },
    bookCoverWidth() {
      var coverWidth = this.availableSizes[this.selectedSizeIndex]
      return coverWidth
    },
    sizeMultiplier() {
      return this.bookCoverWidth / 120
    },
    paddingX() {
      return 16 * this.sizeMultiplier
    },
    bookWidth() {
      var _width = this.bookCoverWidth + this.paddingX * 2
      return this.showGroups ? _width * 1.6 : _width
    },
    isSelectionMode() {
      return this.$store.getters['getNumAudiobooksSelected']
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    orderBy() {
      return this.$store.getters['user/getUserSetting']('orderBy')
    },
    orderDesc() {
      return this.$store.getters['user/getUserSetting']('orderDesc')
    },
    showGroups() {
      return this.page !== '' && this.page !== 'search' && !this.selectedSeries
    },
    categorizedShelves() {
      if (this.page !== 'search') return []
      var audiobookSearchResults = this.searchResults ? this.searchResults.audiobooks || [] : []
      const shelves = []

      if (audiobookSearchResults.length) {
        shelves.push({
          label: 'Books',
          books: audiobookSearchResults.map((absr) => absr.audiobook)
        })
      }

      if (this.searchResults.series && this.searchResults.series.length) {
        var seriesGroups = this.searchResults.series.map((seriesResult) => {
          return {
            type: 'series',
            name: seriesResult.series || '',
            books: seriesResult.audiobooks || []
          }
        })
        shelves.push({
          label: 'Series',
          series: seriesGroups
        })
      }

      if (this.searchResults.tags && this.searchResults.tags.length) {
        var tagGroups = this.searchResults.tags.map((tagResult) => {
          return {
            type: 'tags',
            name: tagResult.tag || '',
            books: tagResult.audiobooks || []
          }
        })
        shelves.push({
          label: 'Tags',
          series: tagGroups
        })
      }

      return shelves
    },
    entities() {
      if (this.page === '') {
        return this.$store.getters['audiobooks/getFilteredAndSorted']()
      } else if (this.page === 'search') {
        var audiobookSearchResults = this.searchResults ? this.searchResults.audiobooks || [] : []
        return audiobookSearchResults.map((absr) => absr.audiobook)
      } else {
        var seriesGroups = this.$store.getters['audiobooks/getSeriesGroups']()
        if (this.selectedSeries) {
          var group = seriesGroups.find((group) => group.name === this.selectedSeries)
          return group.books
        }
        return seriesGroups
      }
    }
  },
  methods: {
    editBook(audiobook) {
      var bookIds = this.entities.map((e) => e.id)
      this.$store.commit('setBookshelfBookIds', bookIds)
      this.$store.commit('showEditModal', audiobook)
    },
    clickGroup(group) {
      this.$emit('update:selectedSeries', group.name)
    },
    clearFilter() {
      this.$store.commit('audiobooks/setKeywordFilter', null)
      if (this.filterBy !== 'all') {
        this.$store.dispatch('user/updateUserSettings', {
          filterBy: 'all'
        })
      } else {
        this.setBookshelfEntities()
      }
    },
    checkKeywordFilter() {
      clearTimeout(this.keywordFilterTimeout)
      this.keywordFilterTimeout = setTimeout(() => {
        this.setBookshelfEntities()
      }, 500)
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
    setBookshelfEntities() {
      this.wrapperClientWidth = this.$refs.wrapper.clientWidth
      var width = Math.max(0, this.wrapperClientWidth - this.rowPaddingX * 2)

      var booksPerRow = Math.floor(width / this.bookWidth)

      this.currSearchParams = this.buildSearchParams()

      var entities = this.entities

      var groups = []
      var currentRow = 0
      var currentGroup = []

      for (let i = 0; i < entities.length; i++) {
        var row = Math.floor(i / booksPerRow)
        if (row > currentRow) {
          groups.push([...currentGroup])
          currentRow = row
          currentGroup = []
        }
        currentGroup.push(entities[i])
      }
      if (currentGroup.length) {
        groups.push([...currentGroup])
      }
      this.shelves = groups
    },
    async init() {
      this.checkUpdateSearchParams()

      this.wrapperClientWidth = this.$refs.wrapper ? this.$refs.wrapper.clientWidth : 0

      var bookshelfCoverSize = this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
      var sizeIndex = this.availableSizes.findIndex((s) => s === bookshelfCoverSize)
      if (!isNaN(sizeIndex)) this.selectedSizeIndex = sizeIndex

      var isLoading = await this.$store.dispatch('audiobooks/load')
      if (!isLoading) {
        this.setBookshelfEntities()
      }
    },
    resize() {
      this.$nextTick(this.setBookshelfEntities)
    },
    audiobooksUpdated() {
      console.log('[AudioBookshelf] Audiobooks Updated')
      this.setBookshelfEntities()
    },
    buildSearchParams() {
      if (this.page === 'search' || this.page === 'series') {
        return ''
      }

      let searchParams = new URLSearchParams()
      if (this.filterBy && this.filterBy !== 'all') {
        searchParams.set('filter', this.filterBy)
      }
      if (this.orderBy) {
        searchParams.set('order', this.orderBy)
        searchParams.set('orderdesc', this.orderDesc ? 1 : 0)
      }
      return searchParams.toString()
    },
    checkUpdateSearchParams() {
      var newSearchParams = this.buildSearchParams()
      var currentQueryString = window.location.search

      if (newSearchParams === '') {
        return false
      }

      if (newSearchParams !== this.currSearchParams || newSearchParams !== currentQueryString) {
        let newurl = window.location.protocol + '//' + window.location.host + window.location.pathname + '?' + newSearchParams
        window.history.replaceState({ path: newurl }, '', newurl)
        return true
      }

      return false
    },
    settingsUpdated(settings) {
      var wasUpdated = this.checkUpdateSearchParams()
      if (wasUpdated) this.setBookshelfEntities()

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
  updated() {
    if (this.$refs.wrapper) {
      if (this.wrapperClientWidth !== this.$refs.wrapper.clientWidth) {
        this.$nextTick(this.setBookshelfEntities)
      }
    }
  },
  mounted() {
    window.addEventListener('resize', this.resize)
    this.$store.commit('audiobooks/addListener', { id: 'bookshelf', meth: this.audiobooksUpdated })
    this.$store.commit('user/addSettingsListener', { id: 'bookshelf', meth: this.settingsUpdated })

    this.init()
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    this.$store.commit('audiobooks/removeListener', 'bookshelf')
    this.$store.commit('user/removeSettingsListener', 'bookshelf')
  }
}
</script>

<style>
.bookshelf {
  /* height: calc(100% - 40px); */
  width: calc(100vw - 80px);
}
@media (max-width: 768px) {
  .bookshelf {
    /* height: calc(100% - 80px); */
    width: 100vw;
  }
}

.bookshelfRow {
  background-image: url(/wood_panels.jpg);
}
.bookshelfDivider {
  background: rgb(149, 119, 90);
  background: linear-gradient(180deg, rgba(149, 119, 90, 1) 0%, rgba(103, 70, 37, 1) 17%, rgba(103, 70, 37, 1) 88%, rgba(71, 48, 25, 1) 100%);
  box-shadow: 2px 14px 8px #111111aa;
}
</style>