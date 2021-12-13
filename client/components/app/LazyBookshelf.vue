<template>
  <div id="bookshelf" class="w-full overflow-y-auto">
    <template v-for="shelf in totalShelves">
      <div :key="shelf" class="w-full px-8 bookshelfRow relative" :id="`shelf-${shelf - 1}`" :style="{ height: shelfHeight + 'px' }">
        <!-- <div class="absolute top-0 left-0 bottom-0 p-4 z-10">
          <p class="text-white text-2xl">{{ shelf }}</p>
        </div> -->
        <div class="bookshelfDivider w-full absolute bottom-0 left-0 right-0 z-20" :class="`h-${shelfDividerHeightIndex}`" />
      </div>
    </template>

    <div v-if="initialized && !totalShelves && !hasFilter && isRootUser && entityName === 'books'" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl font-book mb-4 py-4">Audiobookshelf is empty!</p>
      <div class="flex">
        <ui-btn to="/config" color="primary" class="w-52 mr-2">Configure Scanner</ui-btn>
        <ui-btn color="success" class="w-52" @click="scan">Scan Audiobooks</ui-btn>
      </div>
    </div>
    <div v-else-if="!totalShelves && initialized" class="w-full py-16">
      <p class="text-xl text-center">{{ emptyMessage }}</p>
    </div>

    <widgets-cover-size-widget class="fixed bottom-4 right-4 z-30" />
    <!-- Experimental Bookshelf Texture -->
    <div v-show="showExperimentalFeatures" class="fixed bottom-4 right-28 z-40">
      <div class="rounded-full py-1 bg-primary hover:bg-bg cursor-pointer px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent @click="showBookshelfTextureModal"><p class="text-sm py-0.5">Texture</p></div>
    </div>
  </div>
</template>

<script>
import bookshelfCardsHelpers from '@/mixins/bookshelfCardsHelpers'

export default {
  props: {
    page: String,
    seriesId: String
  },
  mixins: [bookshelfCardsHelpers],
  data() {
    return {
      initialized: false,
      bookshelfHeight: 0,
      bookshelfWidth: 0,
      shelvesPerPage: 0,
      entitiesPerShelf: 8,
      currentPage: 0,
      totalEntities: 0,
      entities: [],
      pagesLoaded: {},
      entityIndexesMounted: [],
      entityComponentRefs: {},
      currentBookWidth: 0,
      pageLoadQueue: [],
      isFetchingEntities: false,
      scrollTimeout: null,
      booksPerFetch: 250,
      totalShelves: 0,
      bookshelfMarginLeft: 0,
      isSelectionMode: false,
      isSelectAll: false,
      currentSFQueryString: null,
      pendingReset: false,
      keywordFilter: null,
      currScrollTop: 0,
      resizeTimeout: null,
      mountWindowWidth: 0
    }
  },
  watch: {
    '$route.query.filter'() {
      if (this.$route.query.filter && this.$route.query.filter !== this.filterBy) {
        this.$store.dispatch('user/updateUserSettings', { filterBy: this.$route.query.filter })
      } else if (!this.$route.query.filter && this.filterBy) {
        this.$store.dispatch('user/updateUserSettings', { filterBy: 'all' })
      }
    }
  },
  computed: {
    isRootUser() {
      return this.$store.getters['user/getIsRoot']
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    emptyMessage() {
      if (this.page === 'series') return `You have no series`
      if (this.page === 'collections') return "You haven't made any collections yet"
      return 'No results'
    },
    entityName() {
      if (!this.page) return 'books'
      return this.page
    },
    orderBy() {
      return this.$store.getters['user/getUserSetting']('orderBy')
    },
    orderDesc() {
      return this.$store.getters['user/getUserSetting']('orderDesc')
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    coverAspectRatio() {
      return this.$store.getters['getServerSetting']('coverAspectRatio')
    },
    isCoverSquareAspectRatio() {
      return this.coverAspectRatio === this.$constants.BookCoverAspectRatio.SQUARE
    },
    bookCoverAspectRatio() {
      return this.isCoverSquareAspectRatio ? 1 : 1.6
    },
    hasFilter() {
      return this.filterBy && this.filterBy !== 'all'
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    isEntityBook() {
      return this.entityName === 'series-books' || this.entityName === 'books'
    },
    bookWidth() {
      var coverSize = this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
      if (this.isCoverSquareAspectRatio) return coverSize * 1.6
      return coverSize
    },
    bookHeight() {
      if (this.isCoverSquareAspectRatio) return this.bookWidth
      return this.bookWidth * 1.6
    },
    entityWidth() {
      if (this.entityName === 'series') return this.bookWidth * 2
      if (this.entityName === 'collections') return this.bookWidth * 2
      return this.bookWidth
    },
    entityHeight() {
      if (this.entityName === 'series') return this.bookHeight
      if (this.entityName === 'collections') return this.bookHeight
      return this.bookHeight
    },
    shelfDividerHeightIndex() {
      return 6
    },
    shelfHeight() {
      return this.entityHeight + 40
    },
    totalEntityCardWidth() {
      // Includes margin
      return this.entityWidth + 24
    },
    selectedAudiobooks() {
      return this.$store.state.selectedAudiobooks || []
    }
  },
  methods: {
    showBookshelfTextureModal() {
      this.$store.commit('globals/setShowBookshelfTextureModal', true)
    },
    editEntity(entity) {
      if (this.entityName === 'books' || this.entityName === 'series-books') {
        var bookIds = this.entities.map((e) => e.id)
        this.$store.commit('setBookshelfBookIds', bookIds)
        this.$store.commit('showEditModal', entity)
      } else if (this.entityName === 'collections') {
        this.$store.commit('globals/setEditCollection', entity)
      }
    },
    clearSelectedEntities() {
      this.updateBookSelectionMode(false)
      this.isSelectionMode = false
      this.isSelectAll = false
    },
    selectAllEntities() {
      this.isSelectAll = true
      if (this.entityName === 'books' || this.entityName === 'series-books') {
        var allAvailableEntityIds = this.entities.map((ent) => ent.id).filter((ent) => !!ent)
        this.$store.commit('setSelectedAudiobooks', allAvailableEntityIds)
      }

      for (const key in this.entityComponentRefs) {
        if (this.entityIndexesMounted.includes(Number(key))) {
          this.entityComponentRefs[key].selected = true
        }
      }
    },
    selectEntity(entity) {
      if (this.entityName === 'books' || this.entityName === 'series-books') {
        this.$store.commit('toggleAudiobookSelected', entity.id)

        var newIsSelectionMode = !!this.selectedAudiobooks.length
        if (this.isSelectionMode !== newIsSelectionMode) {
          this.isSelectionMode = newIsSelectionMode
          this.updateBookSelectionMode(newIsSelectionMode)
        }
      }
    },
    updateBookSelectionMode(isSelectionMode) {
      for (const key in this.entityComponentRefs) {
        if (this.entityIndexesMounted.includes(Number(key))) {
          this.entityComponentRefs[key].setSelectionMode(isSelectionMode)
        }
      }
    },
    async fetchEntites(page = 0) {
      var startIndex = page * this.booksPerFetch

      this.isFetchingEntities = true

      if (!this.initialized) {
        this.currentSFQueryString = this.buildSearchParams()
      }

      var entityPath = this.entityName === 'books' ? `books/all` : this.entityName
      if (this.entityName === 'series-books') entityPath = `series/${this.seriesId}`
      var sfQueryString = this.currentSFQueryString ? this.currentSFQueryString + '&' : ''
      var fullQueryString = this.entityName === 'series-books' ? '' : `?${sfQueryString}limit=${this.booksPerFetch}&page=${page}`
      var payload = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/${entityPath}${fullQueryString}`).catch((error) => {
        console.error('failed to fetch books', error)
        return null
      })
      this.isFetchingEntities = false
      if (this.pendingReset) {
        this.pendingReset = false
        this.resetEntities()
        return
      }
      if (payload) {
        // console.log('Received payload', payload)
        if (!this.initialized) {
          this.initialized = true
          this.totalEntities = payload.total
          this.totalShelves = Math.ceil(this.totalEntities / this.entitiesPerShelf)
          this.entities = new Array(this.totalEntities)
          this.$eventBus.$emit('bookshelf-total-entities', this.totalEntities)
        }

        for (let i = 0; i < payload.results.length; i++) {
          var index = i + startIndex
          this.entities[index] = payload.results[i]

          if (this.entityComponentRefs[index]) {
            this.entityComponentRefs[index].setEntity(this.entities[index])
          }
        }
      }
    },
    loadPage(page) {
      this.pagesLoaded[page] = true
      this.fetchEntites(page)
    },
    showHideBookPlaceholder(index, show) {
      var el = document.getElementById(`book-${index}-placeholder`)
      if (el) el.style.display = show ? 'flex' : 'none'
    },
    mountEntites(fromIndex, toIndex) {
      for (let i = fromIndex; i < toIndex; i++) {
        if (!this.entityIndexesMounted.includes(i)) {
          this.cardsHelpers.mountEntityCard(i)
        }
      }
    },
    handleScroll(scrollTop) {
      this.currScrollTop = scrollTop
      var firstShelfIndex = Math.floor(scrollTop / this.shelfHeight)
      var lastShelfIndex = Math.ceil((scrollTop + this.bookshelfHeight) / this.shelfHeight)
      lastShelfIndex = Math.min(this.totalShelves - 1, lastShelfIndex)

      var firstBookIndex = firstShelfIndex * this.entitiesPerShelf
      var lastBookIndex = lastShelfIndex * this.entitiesPerShelf + this.entitiesPerShelf
      lastBookIndex = Math.min(this.totalEntities, lastBookIndex)

      var firstBookPage = Math.floor(firstBookIndex / this.booksPerFetch)
      var lastBookPage = Math.floor(lastBookIndex / this.booksPerFetch)
      if (!this.pagesLoaded[firstBookPage]) {
        console.log('Must load next batch', firstBookPage, 'book index', firstBookIndex)
        this.loadPage(firstBookPage)
      }
      if (!this.pagesLoaded[lastBookPage]) {
        console.log('Must load last next batch', lastBookPage, 'book index', lastBookIndex)
        this.loadPage(lastBookPage)
      }

      this.entityIndexesMounted = this.entityIndexesMounted.filter((_index) => {
        if (_index < firstBookIndex || _index >= lastBookIndex) {
          var el = document.getElementById(`book-card-${_index}`)
          if (el) el.remove()
          return false
        }
        return true
      })
      this.mountEntites(firstBookIndex, lastBookIndex)
    },
    async resetEntities() {
      if (this.isFetchingEntities) {
        this.pendingReset = true
        return
      }
      this.destroyEntityComponents()
      this.entityIndexesMounted = []
      this.entityComponentRefs = {}
      this.pagesLoaded = {}
      this.entities = []
      this.totalShelves = 0
      this.totalEntities = 0
      this.currentPage = 0
      this.isSelectionMode = false
      this.isSelectAll = false
      this.initialized = false

      this.initSizeData()
      this.pagesLoaded[0] = true
      await this.fetchEntites(0)
      var lastBookIndex = Math.min(this.totalEntities, this.shelvesPerPage * this.entitiesPerShelf)
      this.mountEntites(0, lastBookIndex)
    },
    remountEntities() {
      for (const key in this.entityComponentRefs) {
        if (this.entityComponentRefs[key]) {
          this.entityComponentRefs[key].destroy()
        }
      }
      this.entityComponentRefs = {}
      this.entityIndexesMounted.forEach((i) => {
        this.cardsHelpers.mountEntityCard(i)
      })
    },
    rebuild() {
      this.initSizeData()

      var lastBookIndex = Math.min(this.totalEntities, this.shelvesPerPage * this.entitiesPerShelf)
      this.entityIndexesMounted = []
      for (let i = 0; i < lastBookIndex; i++) {
        this.entityIndexesMounted.push(i)
      }
      var bookshelfEl = document.getElementById('bookshelf')
      if (bookshelfEl) {
        bookshelfEl.scrollTop = 0
      }

      this.$nextTick(this.remountEntities)
    },
    buildSearchParams() {
      if (this.page === 'search' || this.page === 'series' || this.page === 'collections' || this.page === 'series-books') {
        return ''
      }

      let searchParams = new URLSearchParams()
      if (this.filterBy && this.filterBy !== 'all') {
        searchParams.set('filter', this.filterBy)
      }
      if (this.orderBy) {
        searchParams.set('sort', this.orderBy)
        searchParams.set('desc', this.orderDesc ? 1 : 0)
      }
      return searchParams.toString()
    },
    checkUpdateSearchParams() {
      var newSearchParams = this.buildSearchParams()
      var currentQueryString = window.location.search
      if (currentQueryString && currentQueryString.startsWith('?')) currentQueryString = currentQueryString.slice(1)

      if (newSearchParams === '') {
        return false
      }
      if (newSearchParams !== this.currentSFQueryString || newSearchParams !== currentQueryString) {
        let newurl = window.location.protocol + '//' + window.location.host + window.location.pathname + '?' + newSearchParams
        window.history.replaceState({ path: newurl }, '', newurl)
        return true
      }

      return false
    },
    settingsUpdated(settings) {
      var wasUpdated = this.checkUpdateSearchParams()
      if (wasUpdated) {
        this.resetEntities()
      } else if (settings.bookshelfCoverSize !== this.currentBookWidth) {
        this.rebuild()
      }
    },
    scroll(e) {
      if (!e || !e.target) return
      var { scrollTop } = e.target
      // clearTimeout(this.scrollTimeout)
      // this.scrollTimeout = setTimeout(() => {
      this.handleScroll(scrollTop)
      // }, 250)
    },
    audiobookAdded(audiobook) {
      console.log('Audiobook added', audiobook)
      // TODO: Check if audiobook would be on this shelf
      this.resetEntities()
    },
    audiobookUpdated(audiobook) {
      console.log('Audiobook updated', audiobook)
      if (this.entityName === 'books' || this.entityName === 'series-books') {
        var indexOf = this.entities.findIndex((ent) => ent && ent.id === audiobook.id)
        if (indexOf >= 0) {
          this.entities[indexOf] = audiobook
          if (this.entityComponentRefs[indexOf]) {
            this.entityComponentRefs[indexOf].setEntity(audiobook)
          }
        }
      }
    },
    audiobookRemoved(audiobook) {
      if (this.entityName === 'books' || this.entityName === 'series-books') {
        var indexOf = this.entities.findIndex((ent) => ent && ent.id === audiobook.id)
        if (indexOf >= 0) {
          this.entities = this.entities.filter((ent) => ent.id !== audiobook.id)
          this.totalEntities = this.entities.length
          this.$eventBus.$emit('bookshelf-total-entities', this.totalEntities)
          this.remountEntities()
        }
      }
    },
    audiobooksAdded(audiobooks) {
      console.log('audiobooks added', audiobooks)
      // TODO: Check if audiobook would be on this shelf
      this.resetEntities()
    },
    audiobooksUpdated(audiobooks) {
      audiobooks.forEach((ab) => {
        this.audiobookUpdated(ab)
      })
    },
    initSizeData(_bookshelf) {
      var bookshelf = _bookshelf || document.getElementById('bookshelf')
      if (!bookshelf) {
        console.error('Failed to init size data')
        return
      }
      var entitiesPerShelfBefore = this.entitiesPerShelf

      var { clientHeight, clientWidth } = bookshelf
      console.log('Init bookshelf width', clientWidth, 'window width', window.innerWidth)
      this.mountWindowWidth = window.innerWidth
      this.bookshelfHeight = clientHeight
      this.bookshelfWidth = clientWidth
      this.entitiesPerShelf = Math.floor((this.bookshelfWidth - 64) / this.totalEntityCardWidth)
      this.shelvesPerPage = Math.ceil(this.bookshelfHeight / this.shelfHeight) + 2
      this.bookshelfMarginLeft = (this.bookshelfWidth - this.entitiesPerShelf * this.totalEntityCardWidth) / 2

      this.currentBookWidth = this.bookWidth
      if (this.totalEntities) {
        this.totalShelves = Math.ceil(this.totalEntities / this.entitiesPerShelf)
      }
      return entitiesPerShelfBefore < this.entitiesPerShelf // Books per shelf has changed
    },
    async init(bookshelf) {
      this.checkUpdateSearchParams()
      this.initSizeData(bookshelf)

      this.pagesLoaded[0] = true
      await this.fetchEntites(0)
      var lastBookIndex = Math.min(this.totalEntities, this.shelvesPerPage * this.entitiesPerShelf)
      this.mountEntites(0, lastBookIndex)
    },
    windowResize() {
      clearTimeout(this.resizeTimeout)
      this.resizeTimeout = setTimeout(() => {
        this.rebuild()
      }, 200)
    },
    initListeners() {
      window.addEventListener('resize', this.windowResize)

      this.$nextTick(() => {
        var bookshelf = document.getElementById('bookshelf')
        if (bookshelf) {
          this.init(bookshelf)
          bookshelf.addEventListener('scroll', this.scroll)
        }
      })

      this.$eventBus.$on('bookshelf-clear-selection', this.clearSelectedEntities)
      this.$eventBus.$on('bookshelf-select-all', this.selectAllEntities)
      this.$eventBus.$on('bookshelf-keyword-filter', this.updateKeywordFilter)

      this.$store.commit('user/addSettingsListener', { id: 'lazy-bookshelf', meth: this.settingsUpdated })

      if (this.$root.socket) {
        this.$root.socket.on('audiobook_updated', this.audiobookUpdated)
        this.$root.socket.on('audiobook_added', this.audiobookAdded)
        this.$root.socket.on('audiobook_removed', this.audiobookRemoved)
        this.$root.socket.on('audiobooks_updated', this.audiobooksUpdated)
        this.$root.socket.on('audiobooks_added', this.audiobooksAdded)
      } else {
        console.error('Bookshelf - Socket not initialized')
      }
    },
    removeListeners() {
      window.removeEventListener('resize', this.windowResize)
      var bookshelf = document.getElementById('bookshelf')
      if (bookshelf) {
        bookshelf.removeEventListener('scroll', this.scroll)
      }
      this.$eventBus.$off('bookshelf-clear-selection', this.clearSelectedEntities)
      this.$eventBus.$off('bookshelf-select-all', this.selectAllEntities)
      this.$eventBus.$off('bookshelf-keyword-filter', this.updateKeywordFilter)

      this.$store.commit('user/removeSettingsListener', 'lazy-bookshelf')

      if (this.$root.socket) {
        this.$root.socket.off('audiobook_updated', this.audiobookUpdated)
        this.$root.socket.off('audiobook_added', this.audiobookAdded)
        this.$root.socket.off('audiobook_removed', this.audiobookRemoved)
        this.$root.socket.off('audiobooks_updated', this.audiobooksUpdated)
        this.$root.socket.off('audiobooks_added', this.audiobooksAdded)
      } else {
        console.error('Bookshelf - Socket not initialized')
      }
    },
    destroyEntityComponents() {
      for (const key in this.entityComponentRefs) {
        if (this.entityComponentRefs[key] && this.entityComponentRefs[key].destroy) {
          this.entityComponentRefs[key].destroy()
        }
      }
    },
    scan() {
      this.$root.socket.emit('scan', this.currentLibraryId)
    }
  },
  mounted() {
    this.initListeners()
  },
  updated() {
    if (window.innerWidth > 0 && window.innerWidth !== this.mountWindowWidth) {
      console.log('Updated window width', window.innerWidth, 'from', this.mountWindowWidth)
      this.rebuild()
    }
  },
  beforeDestroy() {
    this.destroyEntityComponents()
    this.removeListeners()
  }
}
</script>

<style>
.bookshelfRow {
  background-image: var(--bookshelf-texture-img);
}
.bookshelfDivider {
  background: rgb(149, 119, 90);
  background: var(--bookshelf-divider-bg);
  box-shadow: 2px 14px 8px #111111aa;
}
</style>