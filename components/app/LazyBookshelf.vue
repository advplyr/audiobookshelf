<template>
  <div id="bookshelf" ref="bookshelf" class="w-full overflow-y-auto" :style="{ fontSize: sizeMultiplier + 'rem' }">
    <template v-for="shelf in totalShelves">
      <div :key="shelf" :id="`shelf-${shelf - 1}`" class="w-full px-4e sm:px-8e relative" :class="{ bookshelfRow: !isAlternativeBookshelfView }" :style="{ height: shelfHeight + 'px' }">
        <div v-if="!isAlternativeBookshelfView" class="bookshelfDivider w-full absolute bottom-0 left-0 right-0 z-20 h-6e" />
      </div>
    </template>

    <div v-if="initialized && !totalShelves && !hasFilter && entityName === 'items'" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl mb-4 py-4">{{ $getString('MessageXLibraryIsEmpty', [libraryName]) }}</p>
      <div v-if="userIsAdminOrUp" class="flex">
        <ui-btn to="/config" color="primary" class="w-52 mr-2">{{ $strings.ButtonConfigureScanner }}</ui-btn>
        <ui-btn color="success" class="w-52" :loading="isScanningLibrary || tempIsScanning" @click="scan">{{ $strings.ButtonScanLibrary }}</ui-btn>
      </div>
    </div>
    <div v-else-if="!totalShelves && initialized" class="w-full py-16">
      <p class="text-xl text-center">{{ emptyMessage }}</p>
      <!-- Clear filter only available on Library bookshelf -->
      <div v-if="entityName === 'items'" class="flex justify-center mt-2">
        <ui-btn v-if="hasFilter" color="primary" @click="clearFilter">{{ $strings.ButtonClearFilter }}</ui-btn>
      </div>
    </div>

    <widgets-cover-size-widget class="fixed right-4 z-50" :style="{ bottom: streamLibraryItem ? '181px' : '16px' }" />
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
      routeFullPath: null,
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
      isFetchingEntities: false,
      scrollTimeout: null,
      booksPerFetch: 0,
      totalShelves: 0,
      bookshelfMarginLeft: 0,
      isSelectionMode: false,
      currentSFQueryString: null,
      pendingReset: false,
      keywordFilter: null,
      currScrollTop: 0,
      resizeTimeout: null,
      mountWindowWidth: 0,
      lastItemIndexSelected: -1,
      tempIsScanning: false,
      cardWidth: 0,
      cardHeight: 0,
      resizeObserver: null
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
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    libraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    isPodcast() {
      return this.libraryMediaType === 'podcast'
    },
    emptyMessage() {
      if (this.page === 'series') return this.$strings.MessageBookshelfNoSeries
      if (this.page === 'collections') return this.$strings.MessageBookshelfNoCollections
      if (this.page === 'playlists') return this.$strings.MessageNoUserPlaylists
      if (this.page === 'authors') return this.$strings.MessageNoAuthors
      if (this.hasFilter) {
        if (this.filterName === 'Issues') return this.$strings.MessageNoIssues
        else if (this.filterName === 'Feed-open') return this.$strings.MessageBookshelfNoRSSFeeds
        return this.$getString('MessageBookshelfNoResultsForFilter', [this.filterName, this.filterValue])
      }
      return this.$strings.MessageNoResults
    },
    entityName() {
      if (!this.page) return 'items'
      return this.page
    },
    seriesSortBy() {
      return this.$store.getters['user/getUserSetting']('seriesSortBy')
    },
    seriesSortDesc() {
      return this.$store.getters['user/getUserSetting']('seriesSortDesc')
    },
    seriesFilterBy() {
      return this.$store.getters['user/getUserSetting']('seriesFilterBy')
    },
    authorSortBy() {
      return this.$store.getters['user/getUserSetting']('authorSortBy')
    },
    authorSortDesc() {
      return !!this.$store.getters['user/getUserSetting']('authorSortDesc')
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
    collapseSeries() {
      return this.$store.getters['user/getUserSetting']('collapseSeries')
    },
    collapseBookSeries() {
      return this.$store.getters['user/getUserSetting']('collapseBookSeries')
    },
    coverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    sortingIgnorePrefix() {
      return this.$store.getters['getServerSetting']('sortingIgnorePrefix')
    },
    isCoverSquareAspectRatio() {
      return this.coverAspectRatio == 1
    },
    bookshelfView() {
      return this.$store.getters['getBookshelfView']
    },
    isAlternativeBookshelfView() {
      return this.bookshelfView === this.$constants.BookshelfView.DETAIL
    },
    hasFilter() {
      return this.filterBy && this.filterBy !== 'all'
    },
    filterName() {
      if (!this.filterBy) return ''
      var filter = this.filterBy.split('.')[0]
      filter = filter.substr(0, 1).toUpperCase() + filter.substr(1)
      return filter
    },
    filterValue() {
      if (!this.filterBy) return ''
      if (!this.filterBy.includes('.')) return ''
      return this.$decode(this.filterBy.split('.')[1])
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryName() {
      return this.$store.getters['libraries/getCurrentLibraryName']
    },
    bookWidth() {
      return this.cardWidth
    },
    bookHeight() {
      return this.cardHeight
    },
    shelfPadding() {
      if (this.bookshelfWidth < 640) return 32 * this.sizeMultiplier
      return 64 * this.sizeMultiplier
    },
    totalPadding() {
      return this.shelfPadding * 2
    },
    entityWidth() {
      return this.cardWidth
    },
    entityHeight() {
      return this.cardHeight
    },
    shelfPaddingHeight() {
      return 16
    },
    shelfHeight() {
      const dividerHeight = this.isAlternativeBookshelfView ? 0 : 24 // h-6
      return this.cardHeight + (this.shelfPaddingHeight + dividerHeight) * this.sizeMultiplier
    },
    totalEntityCardWidth() {
      // Includes margin
      return this.entityWidth + 24 * this.sizeMultiplier
    },
    selectedMediaItems() {
      return this.$store.state.globals.selectedMediaItems || []
    },
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    isScanningLibrary() {
      return !!this.$store.getters['tasks/getRunningLibraryScanTask'](this.currentLibraryId)
    }
  },
  methods: {
    clearFilter() {
      this.$store.dispatch('user/updateUserSettings', { filterBy: 'all' })
    },
    editEntity(entity) {
      if (this.entityName === 'items' || this.entityName === 'series-books') {
        const bookIds = this.entities.map((e) => e.id)
        this.$store.commit('setBookshelfBookIds', bookIds)
        this.$store.commit('showEditModal', entity)
      } else if (this.entityName === 'collections') {
        this.$store.commit('globals/setEditCollection', entity)
      } else if (this.entityName === 'playlists') {
        this.$store.commit('globals/setEditPlaylist', entity)
      } else if (this.entityName === 'authors') {
        this.$store.commit('globals/showEditAuthorModal', entity)
      }
    },
    clearSelectedEntities() {
      this.updateBookSelectionMode(false)
      this.isSelectionMode = false
    },
    selectEntity(entity, shiftKey) {
      if (this.entityName === 'items' || this.entityName === 'series-books') {
        const indexOf = this.entities.findIndex((ent) => ent && ent.id === entity.id)
        const lastLastItemIndexSelected = this.lastItemIndexSelected
        if (!this.selectedMediaItems.some((i) => i.id === entity.id)) {
          this.lastItemIndexSelected = indexOf
        } else {
          this.lastItemIndexSelected = -1
        }

        if (shiftKey && lastLastItemIndexSelected >= 0) {
          let loopStart = indexOf
          let loopEnd = lastLastItemIndexSelected
          if (indexOf > lastLastItemIndexSelected) {
            loopStart = lastLastItemIndexSelected
            loopEnd = indexOf
          }

          let isSelecting = false
          // If any items in this range is not selected then select all otherwise unselect all
          for (let i = loopStart; i <= loopEnd; i++) {
            const thisEntity = this.entities[i]
            if (thisEntity && !thisEntity.collapsedSeries) {
              if (!this.selectedMediaItems.some((i) => i.id === thisEntity.id)) {
                isSelecting = true
                break
              }
            }
          }
          if (isSelecting) this.lastItemIndexSelected = indexOf

          for (let i = loopStart; i <= loopEnd; i++) {
            const thisEntity = this.entities[i]
            if (thisEntity.collapsedSeries) {
              console.warn('Ignoring collapsed series')
              continue
            }

            const entityComponentRef = this.entityComponentRefs[i]
            if (thisEntity && entityComponentRef) {
              entityComponentRef.selected = isSelecting

              const mediaItem = {
                id: thisEntity.id,
                mediaType: thisEntity.mediaType,
                hasTracks: thisEntity.mediaType === 'podcast' || thisEntity.media.audioFile || thisEntity.media.numTracks || (thisEntity.media.tracks && thisEntity.media.tracks.length)
              }
              this.$store.commit('globals/setMediaItemSelected', { item: mediaItem, selected: isSelecting })
            } else {
              console.error('Invalid entity index', i)
            }
          }
        } else {
          const mediaItem = {
            id: entity.id,
            mediaType: entity.mediaType,
            hasTracks: entity.mediaType === 'podcast' || entity.media.audioFile || entity.media.numTracks || (entity.media.tracks && entity.media.tracks.length)
          }
          this.$store.commit('globals/toggleMediaItemSelected', mediaItem)
        }

        const newIsSelectionMode = !!this.selectedMediaItems.length
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
      if (!isSelectionMode) {
        this.lastItemIndexSelected = -1
      }
    },
    async fetchEntites(page = 0) {
      const startIndex = page * this.booksPerFetch

      this.isFetchingEntities = true

      if (!this.initialized) {
        this.currentSFQueryString = this.buildSearchParams()
      }

      let entityPath = this.entityName === 'series-books' ? 'items' : this.entityName
      const sfQueryString = this.currentSFQueryString ? this.currentSFQueryString + '&' : ''
      const fullQueryString = `?${sfQueryString}limit=${this.booksPerFetch}&page=${page}&minified=1&include=rssfeed,numEpisodesIncomplete,share`

      const payload = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/${entityPath}${fullQueryString}`).catch((error) => {
        console.error('failed to fetch items', error)
        return null
      })

      this.isFetchingEntities = false
      if (this.pendingReset) {
        this.pendingReset = false
        this.resetEntities()
        return
      }
      if (payload) {
        if (!this.initialized) {
          this.initialized = true
          this.totalEntities = payload.total
          this.totalShelves = Math.ceil(this.totalEntities / this.entitiesPerShelf)
          this.entities = new Array(this.totalEntities)
        }

        for (let i = 0; i < payload.results.length; i++) {
          const index = i + startIndex
          this.entities[index] = payload.results[i]
          if (this.entityComponentRefs[index]) {
            this.entityComponentRefs[index].setEntity(this.entities[index])
          }
        }

        this.$eventBus.$emit('bookshelf-total-entities', this.totalEntities)
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
        // console.log('Must load next batch', firstBookPage, 'book index', firstBookIndex)
        this.loadPage(firstBookPage)
      }
      if (!this.pagesLoaded[lastBookPage]) {
        // console.log('Must load last next batch', lastBookPage, 'book index', lastBookIndex)
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

      var lastBookIndex = Math.min(this.totalEntities, this.booksPerFetch)
      this.entityIndexesMounted = []
      for (let i = 0; i < lastBookIndex; i++) {
        this.entityIndexesMounted.push(i)
        if (!this.entities[i]) {
          const page = Math.floor(i / this.booksPerFetch)
          this.loadPage(page)
        }
      }
      var bookshelfEl = document.getElementById('bookshelf')
      if (bookshelfEl) {
        bookshelfEl.scrollTop = 0
      }

      this.$nextTick(this.remountEntities)
    },
    buildSearchParams() {
      if (this.page === 'search' || this.page === 'collections') {
        return ''
      }

      let searchParams = new URLSearchParams()
      if (this.page === 'series') {
        searchParams.set('sort', this.seriesSortBy)
        searchParams.set('desc', this.seriesSortDesc ? 1 : 0)
        searchParams.set('filter', this.seriesFilterBy)
      } else if (this.page === 'series-books') {
        searchParams.set('filter', `series.${this.$encode(this.seriesId)}`)
        if (this.collapseBookSeries) {
          searchParams.set('collapseseries', 1)
        }
      } else if (this.page === 'authors') {
        searchParams.set('sort', this.authorSortBy)
        searchParams.set('desc', this.authorSortDesc ? 1 : 0)
      } else {
        if (this.filterBy && this.filterBy !== 'all') {
          searchParams.set('filter', this.filterBy)
        }
        if (this.orderBy) {
          searchParams.set('sort', this.orderBy)
          searchParams.set('desc', this.orderDesc ? 1 : 0)
        }
        if (this.collapseSeries && !this.isPodcast) {
          searchParams.set('collapseseries', 1)
        }
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

        this.routeFullPath = window.location.pathname + (window.location.search || '') // Update for saving scroll position
        return true
      }

      return false
    },
    seriesSortUpdated() {
      var wasUpdated = this.checkUpdateSearchParams()
      if (wasUpdated) {
        this.resetEntities()
      }
    },
    async settingsUpdated(settings) {
      await this.cardsHelpers.setCardSize()
      const wasUpdated = this.checkUpdateSearchParams()
      if (wasUpdated) {
        this.resetEntities()
      } else if (settings.bookshelfCoverSize !== this.currentBookWidth) {
        this.executeRebuild()
      }
    },
    scroll(e) {
      if (!e || !e.target) return
      var { scrollTop } = e.target
      this.handleScroll(scrollTop)
    },
    libraryItemAdded(libraryItem) {
      console.log('libraryItem added', libraryItem)
      // TODO: Check if audiobook would be on this shelf
      this.resetEntities()
    },
    libraryItemUpdated(libraryItem) {
      console.log('Item updated', libraryItem)
      if (this.entityName === 'items' || this.entityName === 'series-books') {
        var indexOf = this.entities.findIndex((ent) => ent && ent.id === libraryItem.id)
        if (indexOf >= 0) {
          this.entities[indexOf] = libraryItem
          if (this.entityComponentRefs[indexOf]) {
            this.entityComponentRefs[indexOf].setEntity(libraryItem)
          }
        }
      }
    },
    libraryItemRemoved(libraryItem) {
      if (this.entityName === 'items' || this.entityName === 'series-books') {
        var indexOf = this.entities.findIndex((ent) => ent && ent.id === libraryItem.id)
        if (indexOf >= 0) {
          this.entities = this.entities.filter((ent) => ent.id !== libraryItem.id)
          this.totalEntities--
          this.$eventBus.$emit('bookshelf-total-entities', this.totalEntities)
          this.executeRebuild()
        }
      }
    },
    libraryItemsAdded(libraryItems) {
      console.log('items added', libraryItems)
      // TODO: Check if audiobook would be on this shelf
      this.resetEntities()
    },
    libraryItemsUpdated(libraryItems) {
      libraryItems.forEach((ab) => {
        this.libraryItemUpdated(ab)
      })
    },
    collectionAdded(collection) {
      if (this.entityName !== 'collections') return
      console.log(`[LazyBookshelf] collectionAdded ${collection.id}`, collection)
      this.resetEntities()
    },
    collectionUpdated(collection) {
      if (this.entityName !== 'collections') return
      console.log(`[LazyBookshelf] collectionUpdated ${collection.id}`, collection)
      var indexOf = this.entities.findIndex((ent) => ent && ent.id === collection.id)
      if (indexOf >= 0) {
        this.entities[indexOf] = collection
        if (this.entityComponentRefs[indexOf]) {
          this.entityComponentRefs[indexOf].setEntity(collection)
        }
      }
    },
    collectionRemoved(collection) {
      if (this.entityName !== 'collections') return
      console.log(`[LazyBookshelf] collectionRemoved ${collection.id}`, collection)
      var indexOf = this.entities.findIndex((ent) => ent && ent.id === collection.id)
      if (indexOf >= 0) {
        this.entities = this.entities.filter((ent) => ent.id !== collection.id)
        this.totalEntities--
        this.$eventBus.$emit('bookshelf-total-entities', this.totalEntities)
        this.executeRebuild()
      }
    },
    playlistAdded(playlist) {
      if (this.entityName !== 'playlists') return
      console.log(`[LazyBookshelf] playlistAdded ${playlist.id}`, playlist)
      this.resetEntities()
    },
    playlistUpdated(playlist) {
      if (this.entityName !== 'playlists') return
      console.log(`[LazyBookshelf] playlistUpdated ${playlist.id}`, playlist)
      var indexOf = this.entities.findIndex((ent) => ent && ent.id === playlist.id)
      if (indexOf >= 0) {
        this.entities[indexOf] = playlist
        if (this.entityComponentRefs[indexOf]) {
          this.entityComponentRefs[indexOf].setEntity(playlist)
        }
      }
    },
    playlistRemoved(playlist) {
      if (this.entityName !== 'playlists') return
      console.log(`[LazyBookshelf] playlistRemoved ${playlist.id}`, playlist)
      var indexOf = this.entities.findIndex((ent) => ent && ent.id === playlist.id)
      if (indexOf >= 0) {
        this.entities = this.entities.filter((ent) => ent.id !== playlist.id)
        this.totalEntities--
        this.$eventBus.$emit('bookshelf-total-entities', this.totalEntities)
        this.executeRebuild()
      }
    },
    authorAdded(author) {
      if (this.entityName !== 'authors') return
      console.log(`[LazyBookshelf] authorAdded ${author.id}`, author)
      this.resetEntities()
    },
    authorUpdated(author) {
      if (this.entityName !== 'authors') return
      console.log(`[LazyBookshelf] authorUpdated ${author.id}`, author)
      const indexOf = this.entities.findIndex((ent) => ent && ent.id === author.id)
      if (indexOf >= 0) {
        this.entities[indexOf] = author
        if (this.entityComponentRefs[indexOf]) {
          this.entityComponentRefs[indexOf].setEntity(author)
        }
      }
    },
    authorRemoved(author) {
      if (this.entityName !== 'authors') return
      console.log(`[LazyBookshelf] authorRemoved ${author.id}`, author)
      const indexOf = this.entities.findIndex((ent) => ent && ent.id === author.id)
      if (indexOf >= 0) {
        this.entities = this.entities.filter((ent) => ent.id !== author.id)
        this.totalEntities--
        this.$eventBus.$emit('bookshelf-total-entities', this.totalEntities)
        this.executeRebuild()
      }
    },

    shareOpen(mediaItemShare) {
      if (this.entityName === 'items' || this.entityName === 'series-books') {
        var indexOf = this.entities.findIndex((ent) => ent?.media?.id === mediaItemShare.mediaItemId)
        if (indexOf >= 0) {
          if (this.entityComponentRefs[indexOf]) {
            const libraryItem = { ...this.entityComponentRefs[indexOf].libraryItem }
            libraryItem.mediaItemShare = mediaItemShare
            this.entityComponentRefs[indexOf].setEntity?.(libraryItem)
          }
        }
      }
    },
    shareClosed(mediaItemShare) {
      if (this.entityName === 'items' || this.entityName === 'series-books') {
        var indexOf = this.entities.findIndex((ent) => ent?.media?.id === mediaItemShare.mediaItemId)
        if (indexOf >= 0) {
          if (this.entityComponentRefs[indexOf]) {
            const libraryItem = { ...this.entityComponentRefs[indexOf].libraryItem }
            libraryItem.mediaItemShare = null
            this.entityComponentRefs[indexOf].setEntity?.(libraryItem)
          }
        }
      }
    },
    updatePagesLoaded() {
      let numPages = Math.ceil(this.totalEntities / this.booksPerFetch)
      for (let page = 0; page < numPages; page++) {
        let numEntities = Math.min(this.totalEntities - page * this.booksPerFetch, this.booksPerFetch)
        this.pagesLoaded[page] = true
        for (let i = 0; i < numEntities; i++) {
          const index = page * this.booksPerFetch + i
          if (!this.entities[index]) {
            this.pagesLoaded[page] = false
            break
          }
        }
      }
    },
    initSizeData(_bookshelf) {
      var bookshelf = _bookshelf || document.getElementById('bookshelf')
      if (!bookshelf) {
        console.error('Failed to init size data')
        return
      }
      var entitiesPerShelfBefore = this.entitiesPerShelf

      var { clientHeight, clientWidth } = bookshelf
      // console.log('Init bookshelf width', clientWidth, 'window width', window.innerWidth)
      this.mountWindowWidth = window.innerWidth
      this.bookshelfHeight = clientHeight
      this.bookshelfWidth = clientWidth
      this.entitiesPerShelf = Math.max(1, Math.floor((this.bookshelfWidth - this.shelfPadding) / this.totalEntityCardWidth))
      this.shelvesPerPage = Math.ceil(this.bookshelfHeight / this.shelfHeight) + 2
      this.bookshelfMarginLeft = (this.bookshelfWidth - this.entitiesPerShelf * this.totalEntityCardWidth) / 2
      const booksPerFetch = this.entitiesPerShelf * this.shelvesPerPage
      if (booksPerFetch !== this.booksPerFetch) {
        this.booksPerFetch = booksPerFetch
        if (this.totalEntities) {
          this.updatePagesLoaded()
        }
      }

      this.currentBookWidth = this.bookWidth
      if (this.totalEntities) {
        this.totalShelves = Math.ceil(this.totalEntities / this.entitiesPerShelf)
      }
      return entitiesPerShelfBefore < this.entitiesPerShelf // Books per shelf has changed
    },
    async init(bookshelf) {
      this.initSizeData(bookshelf)
      this.checkUpdateSearchParams()

      this.pagesLoaded[0] = true
      await this.fetchEntites(0)
      var lastBookIndex = Math.min(this.totalEntities, this.shelvesPerPage * this.entitiesPerShelf)
      this.mountEntites(0, lastBookIndex)

      // Set last scroll position for this bookshelf page
      if (this.$store.state.lastBookshelfScrollData[this.page] && window.bookshelf) {
        const { path, scrollTop } = this.$store.state.lastBookshelfScrollData[this.page]
        if (path === this.routeFullPath) {
          // Exact path match with query so use scroll position
          window.bookshelf.scrollTop = scrollTop
        }
      }
    },
    executeRebuild() {
      clearTimeout(this.resizeTimeout)
      this.resizeTimeout = setTimeout(() => {
        this.rebuild()
      }, 200)
    },
    windowResize() {
      this.executeRebuild()
    },
    socketInit() {
      // Server settings are set on socket init
      this.executeRebuild()
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

      this.$eventBus.$on('bookshelf_clear_selection', this.clearSelectedEntities)
      this.$eventBus.$on('socket_init', this.socketInit)
      this.$eventBus.$on('user-settings', this.settingsUpdated)

      if (this.$root.socket) {
        this.$root.socket.on('item_updated', this.libraryItemUpdated)
        this.$root.socket.on('item_added', this.libraryItemAdded)
        this.$root.socket.on('item_removed', this.libraryItemRemoved)
        this.$root.socket.on('items_updated', this.libraryItemsUpdated)
        this.$root.socket.on('items_added', this.libraryItemsAdded)
        this.$root.socket.on('collection_added', this.collectionAdded)
        this.$root.socket.on('collection_updated', this.collectionUpdated)
        this.$root.socket.on('collection_removed', this.collectionRemoved)
        this.$root.socket.on('playlist_added', this.playlistAdded)
        this.$root.socket.on('playlist_updated', this.playlistUpdated)
        this.$root.socket.on('playlist_removed', this.playlistRemoved)
        this.$root.socket.on('author_added', this.authorAdded)
        this.$root.socket.on('author_updated', this.authorUpdated)
        this.$root.socket.on('author_removed', this.authorRemoved)
        this.$root.socket.on('share_open', this.shareOpen)
        this.$root.socket.on('share_closed', this.shareClosed)
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

      this.$eventBus.$off('bookshelf_clear_selection', this.clearSelectedEntities)
      this.$eventBus.$off('socket_init', this.socketInit)
      this.$eventBus.$off('user-settings', this.settingsUpdated)

      if (this.$root.socket) {
        this.$root.socket.off('item_updated', this.libraryItemUpdated)
        this.$root.socket.off('item_added', this.libraryItemAdded)
        this.$root.socket.off('item_removed', this.libraryItemRemoved)
        this.$root.socket.off('items_updated', this.libraryItemsUpdated)
        this.$root.socket.off('items_added', this.libraryItemsAdded)
        this.$root.socket.off('collection_added', this.collectionAdded)
        this.$root.socket.off('collection_updated', this.collectionUpdated)
        this.$root.socket.off('collection_removed', this.collectionRemoved)
        this.$root.socket.off('playlist_added', this.playlistAdded)
        this.$root.socket.off('playlist_updated', this.playlistUpdated)
        this.$root.socket.off('playlist_removed', this.playlistRemoved)
        this.$root.socket.off('author_added', this.authorAdded)
        this.$root.socket.off('author_updated', this.authorUpdated)
        this.$root.socket.off('author_removed', this.authorRemoved)
        this.$root.socket.off('share_open', this.shareOpen)
        this.$root.socket.off('share_closed', this.shareClosed)
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
      this.tempIsScanning = true
      this.$store
        .dispatch('libraries/requestLibraryScan', { libraryId: this.currentLibraryId })
        .catch((error) => {
          console.error('Failed to start scan', error)
          this.$toast.error(this.$strings.ToastLibraryScanFailedToStart)
        })
        .finally(() => {
          this.tempIsScanning = false
        })
    }
  },
  async mounted() {
    await this.cardsHelpers.setCardSize()
    this.initListeners()

    this.routeFullPath = window.location.pathname + (window.location.search || '')
  },
  updated() {
    this.routeFullPath = window.location.pathname + (window.location.search || '')

    setTimeout(() => {
      if (window.innerWidth > 0 && window.innerWidth !== this.mountWindowWidth) {
        console.log('Updated window width', window.innerWidth, 'from', this.mountWindowWidth)
        this.executeRebuild()
      }
    }, 50)
  },
  beforeDestroy() {
    this.destroyEntityComponents()
    this.removeListeners()

    // Set bookshelf scroll position for specific bookshelf page and query
    if (window.bookshelf) {
      this.$store.commit('setLastBookshelfScrollData', { scrollTop: window.bookshelf.scrollTop || 0, path: this.routeFullPath, name: this.page })
    }
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
  box-shadow: 0.125em 0.875em 0.5em #111111aa;
}
</style>
