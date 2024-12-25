<template>
  <div class="w-full h-20 md:h-10 relative">
    <div class="flex md:hidden h-10 items-center">
      <nuxt-link :to="`/library/${currentLibraryId}`" class="flex-grow h-full flex justify-center items-center" :class="isHomePage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p v-if="isHomePage || isPodcastLibrary" class="text-sm">{{ $strings.ButtonHome }}</p>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </nuxt-link>
      <nuxt-link :to="`/library/${currentLibraryId}/bookshelf`" class="flex-grow h-full flex justify-center items-center" :class="isLibraryPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p v-if="isLibraryPage || isPodcastLibrary" class="text-sm">{{ $strings.ButtonLibrary }}</p>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary" :to="`/library/${currentLibraryId}/podcast/latest`" class="flex-grow h-full flex justify-center items-center" :class="isPodcastLatestPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonLatest }}</p>
      </nuxt-link>
      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/series`" class="flex-grow h-full flex justify-center items-center" :class="isSeriesPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p v-if="isSeriesPage" class="text-sm">{{ $strings.ButtonSeries }}</p>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      </nuxt-link>
      <nuxt-link v-if="showPlaylists" :to="`/library/${currentLibraryId}/bookshelf/playlists`" class="flex-grow h-full flex justify-center items-center" :class="isPlaylistsPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p v-if="isPlaylistsPage || isPodcastLibrary" class="text-sm">{{ $strings.ButtonPlaylists }}</p>
        <span v-else class="material-symbols text-lg">&#xe03d;</span>
      </nuxt-link>
      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/collections`" class="flex-grow h-full flex justify-center items-center" :class="isCollectionsPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p v-if="isCollectionsPage" class="text-sm">{{ $strings.ButtonCollections }}</p>
        <span v-else class="material-symbols text-lg">&#xe431;</span>
      </nuxt-link>
      <nuxt-link v-if="isBookLibrary" :to="`/library/${currentLibraryId}/bookshelf/authors`" class="flex-grow h-full flex justify-center items-center" :class="isAuthorsPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p v-if="isAuthorsPage" class="text-sm">{{ $strings.ButtonAuthors }}</p>
        <svg v-else class="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z"
          />
        </svg>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/search`" class="flex-grow h-full flex justify-center items-center" :class="isPodcastSearchPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonAdd }}</p>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/download-queue`" class="flex-grow h-full flex justify-center items-center" :class="isPodcastDownloadQueuePage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonDownloadQueue }}</p>
      </nuxt-link>
    </div>
    <div id="toolbar" role="toolbar" aria-label="Library Toolbar" class="absolute top-10 md:top-0 left-0 w-full h-10 md:h-full z-40 flex items-center justify-end md:justify-start px-2 md:px-8">
      <!-- Series books page -->
      <template v-if="selectedSeries">
        <p class="pl-2 text-base md:text-lg">
          {{ seriesName }}
        </p>
        <div class="w-6 h-6 rounded-full bg-black bg-opacity-30 flex items-center justify-center ml-3">
          <span class="font-mono">{{ $formatNumber(numShowing) }}</span>
        </div>
        <div class="flex-grow" />

        <!-- RSS feed -->
        <ui-tooltip v-if="seriesRssFeed" :text="$strings.LabelOpenRSSFeed" direction="top">
          <ui-icon-btn icon="rss_feed" class="mx-0.5" :size="7" icon-font-size="1.2rem" bg-color="success" outlined @click="showOpenSeriesRSSFeed" />
        </ui-tooltip>

        <ui-context-menu-dropdown v-if="!isBatchSelecting && seriesContextMenuItems.length" :items="seriesContextMenuItems" class="mx-px" @action="seriesContextMenuAction" />
      </template>
      <!-- library & collections page -->
      <template v-else-if="page !== 'search' && page !== 'podcast-search' && page !== 'recent-episodes' && !isHome && !isAuthorsPage">
        <p class="hidden md:block">{{ $formatNumber(numShowing) }} {{ entityName }}</p>

        <div class="flex-grow hidden sm:inline-block" />

        <!-- library filter select -->
        <controls-library-filter-select v-if="isLibraryPage && !isBatchSelecting" v-model="settings.filterBy" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateFilter" />

        <!-- library sort select -->
        <controls-library-sort-select v-if="isLibraryPage && !isBatchSelecting" v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateOrder" />

        <!-- series filter select -->
        <controls-library-filter-select v-if="isSeriesPage && !isBatchSelecting" v-model="settings.seriesFilterBy" is-series class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateSeriesFilter" />

        <!-- series sort select -->
        <controls-sort-select v-if="isSeriesPage && !isBatchSelecting" v-model="settings.seriesSortBy" :descending.sync="settings.seriesSortDesc" :items="seriesSortItems" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateSeriesSort" />

        <!-- issues page remove all button -->
        <ui-btn v-if="isIssuesFilter && userCanDelete && !isBatchSelecting" :loading="processingIssues" color="error" small class="ml-4" @click="removeAllIssues">{{ $strings.ButtonRemoveAll }} {{ $formatNumber(numShowing) }} {{ entityName }}</ui-btn>

        <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="110" class="ml-2" @action="contextMenuAction" />
      </template>
      <!-- search page -->
      <template v-else-if="page === 'search'">
        <div class="flex-grow" />
        <p>{{ $strings.MessageSearchResultsFor }} "{{ searchQuery }}"</p>
        <div class="flex-grow" />
        <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="110" class="ml-2" @action="contextMenuAction" />
      </template>
      <!-- authors page -->
      <template v-else-if="isAuthorsPage">
        <p class="hidden md:block">{{ $formatNumber(numShowing) }} {{ entityName }}</p>

        <div class="flex-grow hidden sm:inline-block" />
        <ui-btn v-if="userCanUpdate && !isBatchSelecting" :loading="processingAuthors" color="primary" small @click="matchAllAuthors">{{ $strings.ButtonMatchAllAuthors }}</ui-btn>

        <!-- author sort select -->
        <controls-sort-select v-model="settings.authorSortBy" :descending.sync="settings.authorSortDesc" :items="authorSortItems" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateAuthorSort" />
      </template>
      <!-- home page -->
      <template v-else-if="isHome">
        <div class="flex-grow" />
        <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" :menu-width="110" class="ml-2" @action="contextMenuAction" />
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    page: String,
    isHome: Boolean,
    selectedSeries: {
      type: Object,
      default: () => null
    },
    searchQuery: String
  },
  data() {
    return {
      settings: {},
      hasInit: false,
      totalEntities: 0,
      processingSeries: false,
      processingIssues: false,
      processingAuthors: false
    }
  },
  computed: {
    seriesContextMenuItems() {
      if (!this.selectedSeries) return []

      const items = [
        {
          text: this.isSeriesFinished ? this.$strings.MessageMarkAsNotFinished : this.$strings.MessageMarkAsFinished,
          action: 'mark-series-finished'
        }
      ]

      if (this.userIsAdminOrUp || this.selectedSeries.rssFeed) {
        items.push({
          text: this.$strings.LabelOpenRSSFeed,
          action: 'open-rss-feed'
        })
      }

      if (this.isSeriesRemovedFromContinueListening) {
        items.push({
          text: this.$strings.LabelReAddSeriesToContinueListening,
          action: 're-add-to-continue-listening'
        })
      }

      this.addSubtitlesMenuItem(items)
      this.addCollapseSubSeriesMenuItem(items)

      return items
    },
    seriesSortItems() {
      return [
        {
          text: this.$strings.LabelName,
          value: 'name'
        },
        {
          text: this.$strings.LabelNumberOfBooks,
          value: 'numBooks'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelLastBookAdded,
          value: 'lastBookAdded'
        },
        {
          text: this.$strings.LabelLastBookUpdated,
          value: 'lastBookUpdated'
        },
        {
          text: this.$strings.LabelTotalDuration,
          value: 'totalDuration'
        },
        {
          text: this.$strings.LabelRandomly,
          value: 'random'
        }
      ]
    },
    authorSortItems() {
      return [
        {
          text: this.$strings.LabelAuthorFirstLast,
          value: 'name'
        },
        {
          text: this.$strings.LabelAuthorLastFirst,
          value: 'lastFirst'
        },
        {
          text: this.$strings.LabelNumberOfBooks,
          value: 'numBooks'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelUpdatedAt,
          value: 'updatedAt'
        }
      ]
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryProvider() {
      return this.$store.getters['libraries/getLibraryProvider'](this.currentLibraryId) || 'google'
    },
    currentLibraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    isBookLibrary() {
      return this.currentLibraryMediaType === 'book'
    },
    isPodcastLibrary() {
      return this.currentLibraryMediaType === 'podcast'
    },
    isLibraryPage() {
      return this.page === ''
    },
    isSeriesPage() {
      return this.page === 'series'
    },
    isCollectionsPage() {
      return this.page === 'collections'
    },
    isPlaylistsPage() {
      return this.page === 'playlists'
    },
    isHomePage() {
      return this.$route.name === 'library-library'
    },
    isPodcastSearchPage() {
      return this.$route.name === 'library-library-podcast-search'
    },
    isPodcastLatestPage() {
      return this.$route.name === 'library-library-podcast-latest'
    },
    isPodcastDownloadQueuePage() {
      return this.$route.name === 'library-library-podcast-download-queue'
    },
    isAuthorsPage() {
      return this.page === 'authors'
    },
    isAlbumsPage() {
      return this.page === 'albums'
    },
    numShowing() {
      return this.totalEntities
    },
    entityName() {
      if (this.isAlbumsPage) return 'Albums'

      if (this.isPodcastLibrary) return this.$strings.LabelPodcasts
      if (!this.page) return this.$strings.LabelBooks
      if (this.isSeriesPage) return this.$strings.LabelSeries
      if (this.isCollectionsPage) return this.$strings.LabelCollections
      if (this.isPlaylistsPage) return this.$strings.LabelPlaylists
      if (this.isAuthorsPage) return this.$strings.LabelAuthors
      return ''
    },
    seriesId() {
      return this.selectedSeries ? this.selectedSeries.id : null
    },
    seriesName() {
      return this.selectedSeries ? this.selectedSeries.name : null
    },
    seriesProgress() {
      return this.selectedSeries ? this.selectedSeries.progress : null
    },
    seriesRssFeed() {
      return this.selectedSeries ? this.selectedSeries.rssFeed : null
    },
    seriesLibraryItemIds() {
      if (!this.seriesProgress) return []
      return this.seriesProgress.libraryItemIds || []
    },
    isBatchSelecting() {
      return this.$store.getters['globals/getIsBatchSelectingMediaItems']
    },
    isSeriesFinished() {
      return this.seriesProgress && !!this.seriesProgress.isFinished
    },
    isSeriesRemovedFromContinueListening() {
      if (!this.seriesId) return false
      return this.$store.getters['user/getIsSeriesRemovedFromContinueListening'](this.seriesId)
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    isIssuesFilter() {
      return this.filterBy === 'issues' && this.$route.query.filter === 'issues'
    },
    contextMenuItems() {
      const items = []

      if (this.isPodcastLibrary && this.isLibraryPage && this.userCanDownload) {
        items.push({
          text: this.$strings.LabelExportOPML,
          action: 'export-opml'
        })
      }

      this.addSubtitlesMenuItem(items)
      this.addCollapseSeriesMenuItem(items)

      return items
    },
    showPlaylists() {
      return this.$store.state.libraries.numUserPlaylists > 0
    }
  },
  methods: {
    addSubtitlesMenuItem(items) {
      if (this.isBookLibrary && (!this.page || this.page === 'search')) {
        if (this.settings.showSubtitles) {
          items.push({
            text: this.$strings.LabelHideSubtitles,
            action: 'hide-subtitles'
          })
        } else {
          items.push({
            text: this.$strings.LabelShowSubtitles,
            action: 'show-subtitles'
          })
        }
      }
    },
    addCollapseSeriesMenuItem(items) {
      if (this.isLibraryPage && this.isBookLibrary && !this.isBatchSelecting) {
        if (this.settings.collapseSeries) {
          items.push({
            text: this.$strings.LabelExpandSeries,
            action: 'expand-series'
          })
        } else {
          items.push({
            text: this.$strings.LabelCollapseSeries,
            action: 'collapse-series'
          })
        }
      }
    },
    addCollapseSubSeriesMenuItem(items) {
      if (this.selectedSeries && this.isBookLibrary && !this.isBatchSelecting) {
        if (this.settings.collapseBookSeries) {
          items.push({
            text: this.$strings.LabelExpandSubSeries,
            action: 'expand-sub-series'
          })
        } else {
          items.push({
            text: this.$strings.LabelCollapseSubSeries,
            action: 'collapse-sub-series'
          })
        }
      }
    },
    handleSubtitlesAction(action) {
      if (action === 'show-subtitles') {
        this.settings.showSubtitles = true
        this.updateShowSubtitles()
        return true
      }
      if (action === 'hide-subtitles') {
        this.settings.showSubtitles = false
        this.updateShowSubtitles()
        return true
      }
      return false
    },
    handleCollapseSeriesAction(action) {
      if (action === 'collapse-series') {
        this.settings.collapseSeries = true
        this.updateCollapseSeries()
        return true
      }
      if (action === 'expand-series') {
        this.settings.collapseSeries = false
        this.updateCollapseSeries()
        return true
      }
      return false
    },
    handleCollapseSubSeriesAction(action) {
      if (action === 'collapse-sub-series') {
        this.settings.collapseBookSeries = true
        this.updateCollapseSubSeries()
        return true
      }
      if (action === 'expand-sub-series') {
        this.settings.collapseBookSeries = false
        this.updateCollapseSubSeries()
        return true
      }
      return false
    },
    contextMenuAction({ action }) {
      if (action === 'export-opml') {
        this.exportOPML()
        return
      } else if (this.handleSubtitlesAction(action)) {
        return
      } else if (this.handleCollapseSeriesAction(action)) {
        return
      }
    },
    exportOPML() {
      this.$downloadFile(`/api/libraries/${this.currentLibraryId}/opml?token=${this.$store.getters['user/getToken']}`, null, true)
    },
    seriesContextMenuAction({ action }) {
      if (action === 'open-rss-feed') {
        this.showOpenSeriesRSSFeed()
      } else if (action === 're-add-to-continue-listening') {
        if (this.processingSeries) {
          console.warn('Already processing series')
          return
        }
        this.reAddSeriesToContinueListening()
      } else if (action === 'mark-series-finished') {
        if (this.processingSeries) {
          console.warn('Already processing series')
          return
        }
        this.markSeriesFinished()
      } else if (this.handleSubtitlesAction(action)) {
        return
      } else if (this.handleCollapseSubSeriesAction(action)) {
        return
      }
    },
    showOpenSeriesRSSFeed() {
      this.$store.commit('globals/setRSSFeedOpenCloseModal', {
        id: this.selectedSeries.id,
        name: this.selectedSeries.name,
        type: 'series',
        feed: this.selectedSeries.rssFeed
      })
    },
    reAddSeriesToContinueListening() {
      this.processingSeries = true
      this.$axios
        .$get(`/api/me/series/${this.seriesId}/readd-to-continue-listening`)
        .then(() => {
          this.$toast.success(this.$strings.ToastItemUpdateSuccess)
        })
        .catch((error) => {
          console.error('Failed to re-add series to continue listening', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.processingSeries = false
        })
    },
    async fetchAllAuthors() {
      // fetch all authors from the server, in the order that they are currently displayed
      const response = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/authors?sort=${this.settings.authorSortBy}&desc=${this.settings.authorSortDesc}`)
      return response.authors
    },
    async matchAllAuthors() {
      this.processingAuthors = true

      try {
        const authors = await this.fetchAllAuthors()

        for (const author of authors) {
          const payload = {}
          if (author.asin) payload.asin = author.asin
          else payload.q = author.name

          payload.region = 'us'
          if (this.libraryProvider.startsWith('audible.')) {
            payload.region = this.libraryProvider.split('.').pop() || 'us'
          }

          this.$eventBus.$emit(`searching-author-${author.id}`, true)

          var response = await this.$axios.$post(`/api/authors/${author.id}/match`, payload).catch((error) => {
            console.error('Failed', error)
            return null
          })
          if (!response) {
            console.error(`Author ${author.name} not found`)
            this.$toast.error(this.$getString('ToastAuthorNotFound', [author.name]))
          } else if (response.updated) {
            if (response.author.imagePath) console.log(`Author ${response.author.name} was updated`)
            else console.log(`Author ${response.author.name} was updated (no image found)`)
          } else {
            console.log(`No updates were made for Author ${response.author.name}`)
          }

          this.$eventBus.$emit(`searching-author-${author.id}`, false)
        }
      } catch (error) {
        console.error('Failed to match all authors', error)
        this.$toast.error(this.$strings.ToastMatchAllAuthorsFailed)
      }
      this.processingAuthors = false
    },
    removeAllIssues() {
      if (confirm(`Are you sure you want to remove all library items with issues?\n\nNote: This will not delete any files`)) {
        this.processingIssues = true
        this.$axios
          .$delete(`/api/libraries/${this.currentLibraryId}/issues`)
          .then(() => {
            this.$toast.success(this.$strings.ToastRemoveItemsWithIssuesSuccess)
            this.$router.push(`/library/${this.currentLibraryId}/bookshelf`)
            this.$store.dispatch('libraries/fetch', this.currentLibraryId)
          })
          .catch((error) => {
            console.error('Failed to remove library items with issues', error)
            this.$toast.error(this.$strings.ToastRemoveItemsWithIssuesFailed)
          })
          .finally(() => {
            this.processingIssues = false
          })
      }
    },
    markSeriesFinished() {
      const newIsFinished = !this.isSeriesFinished

      const payload = {
        message: newIsFinished ? this.$strings.MessageConfirmMarkSeriesFinished : this.$strings.MessageConfirmMarkSeriesNotFinished,
        callback: (confirmed) => {
          if (confirmed) {
            this.processingSeries = true
            const updateProgressPayloads = this.seriesLibraryItemIds.map((lid) => {
              return {
                libraryItemId: lid,
                isFinished: newIsFinished
              }
            })
            console.log('Progress payloads', updateProgressPayloads)
            this.$axios
              .patch(`/api/me/progress/batch/update`, updateProgressPayloads)
              .then(() => {
                this.$toast.success(this.$strings.ToastSeriesUpdateSuccess)
                this.selectedSeries.progress.isFinished = newIsFinished
              })
              .catch((error) => {
                this.$toast.error(this.$strings.ToastSeriesUpdateFailed)
                console.error('Failed to batch update read/not read', error)
              })
              .finally(() => {
                this.processingSeries = false
              })
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    updateOrder() {
      this.saveSettings()
    },
    updateFilter() {
      this.saveSettings()
    },
    updateSeriesSort() {
      this.saveSettings()
    },
    updateSeriesFilter() {
      this.saveSettings()
    },
    updateCollapseSeries() {
      this.saveSettings()
    },
    updateCollapseSubSeries() {
      this.saveSettings()
    },
    updateShowSubtitles() {
      this.saveSettings()
    },
    updateAuthorSort() {
      this.saveSettings()
    },
    saveSettings() {
      this.$store.dispatch('user/updateUserSettings', this.settings)
    },
    init() {
      this.settings = { ...this.$store.state.user.settings }
    },
    settingsUpdated(settings) {
      for (const key in settings) {
        this.settings[key] = settings[key]
      }
    },
    setBookshelfTotalEntities(totalEntities) {
      this.totalEntities = totalEntities
    },
    rssFeedOpen(data) {
      if (data.entityId === this.seriesId) {
        console.log('RSS Feed Opened', data)
        this.selectedSeries.rssFeed = data
      }
    },
    rssFeedClosed(data) {
      if (data.entityId === this.seriesId) {
        console.log('RSS Feed Closed', data)
        this.selectedSeries.rssFeed = null
      }
    }
  },
  mounted() {
    this.init()
    this.$eventBus.$on('user-settings', this.settingsUpdated)
    this.$eventBus.$on('bookshelf-total-entities', this.setBookshelfTotalEntities)
    this.$root.socket.on('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.on('rss_feed_closed', this.rssFeedClosed)
  },
  beforeDestroy() {
    this.$eventBus.$off('user-settings', this.settingsUpdated)
    this.$eventBus.$off('bookshelf-total-entities', this.setBookshelfTotalEntities)
    this.$root.socket.off('rss_feed_open', this.rssFeedOpen)
    this.$root.socket.off('rss_feed_closed', this.rssFeedClosed)
  }
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 6px #111111aa;
}
</style>
