<template>
  <div id="bookshelf" ref="wrapper" class="w-full max-w-full h-full overflow-y-scroll relative" :style="{ fontSize: sizeMultiplier + 'rem' }">
    <!-- Cover size widget -->
    <widgets-cover-size-widget class="fixed right-4 z-50" :style="{ bottom: streamLibraryItem ? '181px' : '16px' }" />

    <div v-if="loaded && !shelves.length && !search" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl mb-4 py-4">{{ $getString('MessageXLibraryIsEmpty', [libraryName]) }}</p>
      <div v-if="userIsAdminOrUp" class="flex">
        <ui-btn to="/config" color="bg-primary" class="w-52 mr-2">{{ $strings.ButtonConfigureScanner }}</ui-btn>
        <ui-btn color="bg-success" class="w-52" :loading="isScanningLibrary || tempIsScanning" @click="scan">{{ $strings.ButtonScanLibrary }}</ui-btn>
      </div>
    </div>
    <div v-else-if="loaded && !shelves.length && search" class="w-full h-40 flex items-center justify-center">
      <p class="text-center text-xl py-4">{{ $strings.MessageBookshelfNoResultsForQuery }}</p>
    </div>
    <!-- Alternate plain view -->
    <div v-else-if="isAlternativeBookshelfView" class="w-full mb-24e">
      <template v-for="(shelf, index) in supportedShelves">
        <widgets-item-slider :shelf-id="shelf.id" :key="index + '.'" :items="shelf.entities" :continue-listening-shelf="shelf.id === 'continue-listening' || shelf.id === 'continue-reading'" :type="shelf.type" class="bookshelf-row pl-8e my-6e" @selectEntity="(payload) => selectEntity(payload, index)">
          <h2 class="font-semibold text-gray-100">{{ $strings[shelf.labelStringKey] }}</h2>
        </widgets-item-slider>
      </template>
    </div>
    <!-- Regular bookshelf view -->
    <div v-else class="w-full">
      <template v-for="(shelf, index) in supportedShelves">
        <app-book-shelf-row :key="index" :index="index" :shelf="shelf" :size-multiplier="sizeMultiplier" :book-cover-width="bookCoverWidth" :book-cover-aspect-ratio="coverAspectRatio" :continue-listening-shelf="shelf.id === 'continue-listening' || shelf.id === 'continue-reading'" @selectEntity="(payload) => selectEntity(payload, index)" />
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
      shelves: [],
      lastItemIndexSelected: -1,
      tempIsScanning: false
    }
  },
  computed: {
    supportedShelves() {
      return this.shelves.filter((shelf) => ['book', 'podcast', 'episode', 'series', 'authors', 'narrators'].includes(shelf.type))
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    currentLibraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    libraryName() {
      return this.$store.getters['libraries/getCurrentLibraryName']
    },
    isAlternativeBookshelfView() {
      return this.$store.getters['getHomeBookshelfView'] === this.$constants.BookshelfView.DETAIL
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
      return this.$store.getters['user/getSizeMultiplier']
    },
    selectedMediaItems() {
      return this.$store.state.globals.selectedMediaItems || []
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    isScanningLibrary() {
      return !!this.$store.getters['tasks/getRunningLibraryScanTask'](this.currentLibraryId)
    }
  },
  methods: {
    selectEntity({ entity, shiftKey }, shelfIndex) {
      const shelf = this.shelves[shelfIndex]
      const entityShelfIndex = shelf.entities.findIndex((ent) => ent.id === entity.id)
      const indexOf = shelf.shelfStartIndex + entityShelfIndex

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

        const flattenedEntitiesArray = []
        this.shelves.map((s) => flattenedEntitiesArray.push(...s.entities))

        let isSelecting = false
        // If any items in this range is not selected then select all otherwise unselect all
        for (let i = loopStart; i <= loopEnd; i++) {
          const thisEntity = flattenedEntitiesArray[i]
          if (thisEntity) {
            if (!this.selectedMediaItems.some((i) => i.id === thisEntity.id)) {
              isSelecting = true
              break
            }
          }
        }
        if (isSelecting) this.lastItemIndexSelected = indexOf

        for (let i = loopStart; i <= loopEnd; i++) {
          const thisEntity = flattenedEntitiesArray[i]
          if (thisEntity) {
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

      this.$nextTick(() => {
        this.$eventBus.$emit('item-selected', entity)
      })
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
      // Sets the limit for the number of items to be displayed based on the viewport width.
      const viewportWidth = window.innerWidth
      let limit
      if (viewportWidth >= 3240) {
        limit = 15
      } else if (viewportWidth >= 2880 && viewportWidth < 3240) {
        limit = 12
      }

      const limitQuery = limit ? `&limit=${limit}` : ''

      const categories = await this.$axios
        .$get(`/api/libraries/${this.currentLibraryId}/personalized?include=rssfeed,numEpisodesIncomplete,share${limitQuery}`)
        .then((data) => {
          return data
        })
        .catch((error) => {
          console.error('Failed to fetch categories', error)
          return []
        })

      let totalEntityCount = 0
      for (const shelf of categories) {
        shelf.shelfStartIndex = totalEntityCount
        totalEntityCount += shelf.entities.length
      }
      this.shelves = categories
    },
    async setShelvesFromSearch() {
      const shelves = []
      if (this.results.books?.length) {
        shelves.push({
          id: 'books',
          label: 'Books',
          labelStringKey: 'LabelBooks',
          type: 'book',
          entities: this.results.books.map((res) => res.libraryItem)
        })
      }

      if (this.results.podcasts?.length) {
        shelves.push({
          id: 'podcasts',
          label: 'Podcasts',
          labelStringKey: 'LabelPodcasts',
          type: 'podcast',
          entities: this.results.podcasts.map((res) => res.libraryItem)
        })
      }

      if (this.results.episodes?.length) {
        shelves.push({
          id: 'episodes',
          label: 'Episodes',
          labelStringKey: 'LabelEpisodes',
          type: 'episode',
          entities: this.results.episodes.map((res) => res.libraryItem)
        })
      }

      if (this.results.series?.length) {
        shelves.push({
          id: 'series',
          label: 'Series',
          labelStringKey: 'LabelSeries',
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
      if (this.results.tags?.length) {
        shelves.push({
          id: 'tags',
          label: 'Tags',
          labelStringKey: 'LabelTags',
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
      if (this.results.authors?.length) {
        shelves.push({
          id: 'authors',
          label: 'Authors',
          labelStringKey: 'LabelAuthors',
          type: 'authors',
          entities: this.results.authors.map((a) => {
            return {
              ...a,
              type: 'author'
            }
          })
        })
      }
      if (this.results.narrators?.length) {
        shelves.push({
          id: 'narrators',
          label: 'Narrators',
          labelStringKey: 'LabelNarrators',
          type: 'narrators',
          entities: this.results.narrators.map((n) => {
            return {
              ...n,
              type: 'narrator'
            }
          })
        })
      }
      this.shelves = shelves
    },
    scan() {
      this.tempIsScanning = true
      this.$store
        .dispatch('libraries/requestLibraryScan', { libraryId: this.$store.state.libraries.currentLibraryId })
        .catch((error) => {
          console.error('Failed to start scan', error)
          this.$toast.error(this.$strings.ToastLibraryScanFailedToStart)
        })
        .finally(() => {
          this.tempIsScanning = false
        })
    },
    userUpdated(user) {
      if (user.seriesHideFromContinueListening && user.seriesHideFromContinueListening.length) {
        this.removeAllSeriesFromContinueSeries(user.seriesHideFromContinueListening)
      }
      if (user.mediaProgress.length) {
        const mediaProgressToHide = user.mediaProgress.filter((mp) => mp.hideFromContinueListening)
        this.removeItemsFromContinueListeningReading(mediaProgressToHide, 'continue-listening')
        this.removeItemsFromContinueListeningReading(mediaProgressToHide, 'continue-reading')
      }
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

      // First items added to library
      const isThisLibrary = libraryItems.some((li) => li.libraryId === this.currentLibraryId)
      if (!this.shelves.length && !this.search && isThisLibrary) {
        this.fetchCategories()
        return
      }

      const recentlyAddedShelf = this.shelves.find((shelf) => shelf.id === 'recently-added')
      if (!recentlyAddedShelf) return

      // Add new library item to the recently added shelf
      for (const libraryItem of libraryItems) {
        if (libraryItem.libraryId === this.currentLibraryId && !recentlyAddedShelf.entities.some((ent) => ent.id === libraryItem.id)) {
          // Add to front of array
          recentlyAddedShelf.entities.unshift(libraryItem)
        }
      }
    },
    libraryItemsUpdated(items) {
      items.forEach((li) => {
        this.libraryItemUpdated(li)
      })
    },
    episodeAdded(episodeWithLibraryItem) {
      const isThisLibrary = episodeWithLibraryItem.libraryItem?.libraryId === this.currentLibraryId
      if (!this.search && isThisLibrary) {
        this.fetchCategories()
      }
    },
    removeAllSeriesFromContinueSeries(seriesIds) {
      this.shelves.forEach((shelf) => {
        if (shelf.type == 'book' && shelf.id == 'continue-series') {
          // Filter out series books from continue series shelf
          shelf.entities = shelf.entities.filter((ent) => {
            if (ent.media.metadata.series && seriesIds.includes(ent.media.metadata.series.id)) return false
            return true
          })
        }
      })
    },
    removeItemsFromContinueListeningReading(mediaProgressItems, categoryId) {
      const continueListeningShelf = this.shelves.find((s) => s.id === categoryId)
      if (continueListeningShelf) {
        if (continueListeningShelf.type === 'book') {
          continueListeningShelf.entities = continueListeningShelf.entities.filter((ent) => {
            if (mediaProgressItems.some((mp) => mp.libraryItemId === ent.id)) return false
            return true
          })
        } else if (continueListeningShelf.type === 'episode') {
          continueListeningShelf.entities = continueListeningShelf.entities.filter((ent) => {
            if (!ent.recentEpisode) return true // Should always have this here
            if (mediaProgressItems.some((mp) => mp.libraryItemId === ent.id && mp.episodeId === ent.recentEpisode.id)) return false
            return true
          })
        }
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
    shareOpen(mediaItemShare) {
      this.shelves.forEach((shelf) => {
        if (shelf.type == 'book') {
          shelf.entities = shelf.entities.map((ent) => {
            if (ent.media.id === mediaItemShare.mediaItemId) {
              return {
                ...ent,
                mediaItemShare
              }
            }
            return ent
          })
        }
      })
    },
    shareClosed(mediaItemShare) {
      this.shelves.forEach((shelf) => {
        if (shelf.type == 'book') {
          shelf.entities = shelf.entities.map((ent) => {
            if (ent.media.id === mediaItemShare.mediaItemId) {
              return {
                ...ent,
                mediaItemShare: null
              }
            }
            return ent
          })
        }
      })
    },
    initListeners() {
      if (this.$root.socket) {
        this.$root.socket.on('user_updated', this.userUpdated)
        this.$root.socket.on('author_updated', this.authorUpdated)
        this.$root.socket.on('author_removed', this.authorRemoved)
        this.$root.socket.on('item_updated', this.libraryItemUpdated)
        this.$root.socket.on('item_added', this.libraryItemAdded)
        this.$root.socket.on('item_removed', this.libraryItemRemoved)
        this.$root.socket.on('items_updated', this.libraryItemsUpdated)
        this.$root.socket.on('items_added', this.libraryItemsAdded)
        this.$root.socket.on('episode_added', this.episodeAdded)
        this.$root.socket.on('share_open', this.shareOpen)
        this.$root.socket.on('share_closed', this.shareClosed)
      } else {
        console.error('Error socket not initialized')
      }
    },
    removeListeners() {
      if (this.$root.socket) {
        this.$root.socket.off('user_updated', this.userUpdated)
        this.$root.socket.off('author_updated', this.authorUpdated)
        this.$root.socket.off('author_removed', this.authorRemoved)
        this.$root.socket.off('item_updated', this.libraryItemUpdated)
        this.$root.socket.off('item_added', this.libraryItemAdded)
        this.$root.socket.off('item_removed', this.libraryItemRemoved)
        this.$root.socket.off('items_updated', this.libraryItemsUpdated)
        this.$root.socket.off('items_added', this.libraryItemsAdded)
        this.$root.socket.off('episode_added', this.episodeAdded)
        this.$root.socket.off('share_open', this.shareOpen)
        this.$root.socket.off('share_closed', this.shareClosed)
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
