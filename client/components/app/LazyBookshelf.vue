<template>
  <div id="bookshelf" class="w-full overflow-y-auto">
    <template v-for="shelf in totalShelves">
      <div :key="shelf" class="w-full px-8 bookshelfRow relative" :id="`shelf-${shelf - 1}`" :style="{ height: shelfHeight + 'px' }">
        <!-- <div class="absolute top-0 left-0 bottom-0 p-4 z-10">
          <p class="text-white text-2xl">{{ shelf }}</p>
        </div> -->
        <div class="bookshelfDivider w-full absolute bottom-0 left-0 right-0 z-10" :class="`h-${shelfDividerHeightIndex}`" />
      </div>
    </template>

    <div v-if="!totalShelves && initialized" class="w-full py-16">
      <p class="text-xl text-center">{{ emptyMessage }}</p>
    </div>
  </div>
</template>

<script>
import bookshelfCardsHelpers from '@/mixins/bookshelfCardsHelpers'

export default {
  props: {
    page: String
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
      bookWidth: 120,
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
      keywordFilter: null
    }
  },
  computed: {
    // booksFiltered() {
    //   const keywordFilterKeys = ['title', 'subtitle', 'author', 'series', 'narrator']
    //   const keyworkFilter = state.keywordFilter.toLowerCase()
    //   return this.books.filter((ab) => {
    //     if (!ab.book) return false
    //     return !!keywordFilterKeys.find((key) => ab.book[key] && ab.book[key].toLowerCase().includes(keyworkFilter))
    //   })
    // },
    emptyMessage() {
      if (this.page === 'series') return `You have no series`
      if (this.page === 'collections') return "You haven't made any collections yet"
      return 'No results'
    },
    entityName() {
      if (this.page === 'series') return 'series'
      if (this.page === 'collections') return 'collections'
      return 'books'
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
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    entityWidth() {
      if (this.entityName === 'series') return this.bookWidth * 1.6
      if (this.entityName === 'collections') return this.bookWidth * 2
      return this.bookWidth
    },
    bookHeight() {
      return this.bookWidth * 1.6
    },
    shelfDividerHeightIndex() {
      return 6
    },
    shelfHeight() {
      return this.bookHeight + 40
    },
    totalEntityCardWidth() {
      // Includes margin
      return this.entityWidth + 24
    },
    booksPerPage() {
      return this.shelvesPerPage * this.entitiesPerShelf
    },
    selectedAudiobooks() {
      return this.$store.state.selectedAudiobooks || []
    }
  },
  methods: {
    editEntity(entity) {
      if (this.entityName === 'books') {
        var bookIds = this.entities.map((e) => e.id)
        this.$store.commit('setBookshelfBookIds', bookIds)
        this.$store.commit('showEditModal', entity)
      }
    },
    clearSelectedBooks() {
      this.updateBookSelectionMode(false)
      this.isSelectionMode = false
      this.isSelectAll = false
    },
    selectAllBooks() {
      this.isSelectAll = true
      for (const key in this.entityComponentRefs) {
        if (this.entityIndexesMounted.includes(Number(key))) {
          this.entityComponentRefs[key].selected = true
        }
      }
    },
    selectEntity(entity) {
      if (this.entityName === 'books') {
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
      var sfQueryString = this.currentSFQueryString ? this.currentSFQueryString + '&' : ''
      var payload = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/${entityPath}?${sfQueryString}limit=${this.booksPerFetch}&page=${page}`).catch((error) => {
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
        console.log('Received payload', payload)
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
        console.warn('RESET BOOKS BUT ALREADY FETCHING, WAIT FOR FETCH')
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

      this.pagesLoaded[0] = true
      await this.fetchEntites(0)
      var lastBookIndex = Math.min(this.totalEntities, this.shelvesPerPage * this.entitiesPerShelf)
      this.mountEntites(0, lastBookIndex)
    },
    buildSearchParams() {
      if (this.page === 'search' || this.page === 'series' || this.page === 'collections') {
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
    async init(bookshelf) {
      this.checkUpdateSearchParams()

      var { clientHeight, clientWidth } = bookshelf
      this.bookshelfHeight = clientHeight
      this.bookshelfWidth = clientWidth
      this.entitiesPerShelf = Math.floor((this.bookshelfWidth - 64) / this.totalEntityCardWidth)
      this.shelvesPerPage = Math.ceil(this.bookshelfHeight / this.shelfHeight) + 2
      this.bookshelfMarginLeft = (this.bookshelfWidth - this.entitiesPerShelf * this.totalEntityCardWidth) / 2

      this.pagesLoaded[0] = true
      await this.fetchEntites(0)
      var lastBookIndex = Math.min(this.totalEntities, this.shelvesPerPage * this.entitiesPerShelf)
      this.mountEntites(0, lastBookIndex)
    },
    initListeners() {
      var bookshelf = document.getElementById('bookshelf')
      if (bookshelf) {
        this.init(bookshelf)
        bookshelf.addEventListener('scroll', this.scroll)
      }
      this.$eventBus.$on('bookshelf-clear-selection', this.clearSelectedBooks)
      this.$eventBus.$on('bookshelf-select-all', this.selectAllBooks)
      this.$eventBus.$on('bookshelf-keyword-filter', this.updateKeywordFilter)

      this.$store.commit('user/addSettingsListener', { id: 'lazy-bookshelf', meth: this.settingsUpdated })
    },
    removeListeners() {
      var bookshelf = document.getElementById('bookshelf')
      if (bookshelf) {
        bookshelf.removeEventListener('scroll', this.scroll)
      }
      this.$eventBus.$off('bookshelf-clear-selection', this.clearSelectedBooks)
      this.$eventBus.$off('bookshelf-select-all', this.selectAllBooks)
      this.$eventBus.$off('bookshelf-keyword-filter', this.updateKeywordFilter)

      this.$store.commit('user/removeSettingsListener', 'lazy-bookshelf')
    },
    destroyEntityComponents() {
      for (const key in this.entityComponentRefs) {
        if (this.entityComponentRefs[key] && this.entityComponentRefs[key].destroy) {
          this.entityComponentRefs[key].destroy()
        }
      }
    }
  },
  mounted() {
    this.initListeners()
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