<template>
  <div class="w-full h-20 md:h-10 relative">
    <div class="flex md:hidden h-10 items-center">
      <nuxt-link :to="`/library/${currentLibraryId}`" class="flex-grow h-full flex justify-center items-center" :class="isHomePage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonHome }}</p>
      </nuxt-link>
      <nuxt-link :to="`/library/${currentLibraryId}/bookshelf`" class="flex-grow h-full flex justify-center items-center" :class="isLibraryPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonLibrary }}</p>
      </nuxt-link>
      <nuxt-link v-if="!isPodcastLibrary" :to="`/library/${currentLibraryId}/bookshelf/series`" class="flex-grow h-full flex justify-center items-center" :class="isSeriesPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonSeries }}</p>
      </nuxt-link>
      <nuxt-link v-if="!isPodcastLibrary" :to="`/library/${currentLibraryId}/bookshelf/collections`" class="flex-grow h-full flex justify-center items-center" :class="isCollectionsPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonCollections }}</p>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/search`" class="flex-grow h-full flex justify-center items-center" :class="isPodcastSearchPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">{{ $strings.ButtonSearch }}</p>
      </nuxt-link>
    </div>
    <div id="toolbar" class="absolute top-10 md:top-0 left-0 w-full h-10 md:h-full z-30 flex items-center justify-end md:justify-start px-2 md:px-8">
      <template v-if="page !== 'search' && page !== 'podcast-search' && page !== 'recent-episodes' && !isHome">
        <p v-if="!selectedSeries" class="font-book hidden md:block">{{ numShowing }} {{ entityName }}</p>
        <div v-else class="items-center hidden md:flex w-full">
          <p class="pl-2 font-book text-lg">
            {{ seriesName }}
          </p>
          <div class="w-6 h-6 rounded-full bg-black bg-opacity-30 flex items-center justify-center ml-3">
            <span class="font-mono">{{ numShowing }}</span>
          </div>
          <div class="flex-grow" />
          <ui-checkbox v-model="settings.collapseBookSeries" :label="$strings.LabelCollapseSeries" checkbox-bg="bg" check-color="white" small class="mr-2" @input="updateCollapseBookSeries" />
          <ui-btn color="primary" small :loading="processingSeries" class="flex items-center ml-1 sm:ml-4" @click="markSeriesFinished">
            <div class="h-5 w-5">
              <svg v-if="isSeriesFinished" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(63, 181, 68)">
                <path d="M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-9 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-7 19.6l-7-4.66V3h14v12.93l-7 4.67zm-2.01-7.42l-2.58-2.59L6 12l4 4 8-8-1.42-1.42z" />
              </svg>
            </div>
            <span class="pl-2"> {{ $strings.LabelMarkSeries }} {{ isSeriesFinished ? $strings.LabelNotFinished : $strings.LabelFinished }}</span>
          </ui-btn>
        </div>
        <div class="flex-grow hidden sm:inline-block" />

        <ui-checkbox v-if="isLibraryPage && !isPodcastLibrary" v-model="settings.collapseSeries" :label="$strings.LabelCollapseSeries" checkbox-bg="bg" check-color="white" small class="mr-2" @input="updateCollapseSeries" />
        <controls-library-filter-select v-if="isLibraryPage" v-model="settings.filterBy" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateFilter" />
        <controls-library-sort-select v-if="isLibraryPage" v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateOrder" />
        <controls-library-filter-select v-if="isSeriesPage" v-model="seriesFilterBy" is-series class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateSeriesFilter" />
        <controls-sort-select v-if="isSeriesPage" v-model="seriesSortBy" :descending.sync="seriesSortDesc" :items="seriesSortItems" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateSeriesSort" />

        <ui-btn v-if="isIssuesFilter && userCanDelete" :loading="processingIssues" color="error" small class="ml-4" @click="removeAllIssues">{{ $strings.ButtonRemoveAll }} {{ numShowing }} {{ entityName }}</ui-btn>
      </template>
      <template v-else-if="page === 'search'">
        <div class="flex-grow" />
        <p>{{ $strings.MessageSearchResultsFor }} "{{ searchQuery }}"</p>
        <div class="flex-grow" />
      </template>
      <template v-else-if="page === 'authors'">
        <div class="flex-grow" />
        <ui-btn v-if="userCanUpdate && authors && authors.length" :loading="processingAuthors" color="primary" small @click="matchAllAuthors">{{ $strings.ButtonMatchAllAuthors }}</ui-btn>
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
    searchQuery: String,
    authors: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      settings: {},
      hasInit: false,
      totalEntities: 0,
      processingSeries: false,
      processingIssues: false,
      processingAuthors: false,
      seriesSortItems: [
        {
          text: 'Name',
          value: 'name'
        },
        {
          text: 'Number of Books',
          value: 'numBooks'
        },
        {
          text: 'Date Added',
          value: 'addedAt'
        },
        {
          text: 'Total Duration',
          value: 'totalDuration'
        }
      ]
    }
  },
  computed: {
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    currentLibraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
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
    isHomePage() {
      return this.$route.name === 'library-library'
    },
    isPodcastSearchPage() {
      return this.$route.name === 'library-library-podcast-search'
    },
    numShowing() {
      return this.totalEntities
    },
    entityName() {
      if (this.isPodcastLibrary) return this.$strings.LabelPodcasts
      if (!this.page) return this.$strings.LabelBooks
      if (this.isSeriesPage) return this.$strings.LabelSeries
      if (this.isCollectionsPage) return this.$strings.LabelCollections
      return ''
    },
    seriesName() {
      return this.selectedSeries ? this.selectedSeries.name : null
    },
    seriesProgress() {
      return this.selectedSeries ? this.selectedSeries.progress : null
    },
    seriesLibraryItemIds() {
      if (!this.seriesProgress) return []
      return this.seriesProgress.libraryItemIds || []
    },
    isSeriesFinished() {
      return this.seriesProgress && !!this.seriesProgress.isFinished
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    isIssuesFilter() {
      return this.filterBy === 'issues' && this.$route.query.filter === 'issues'
    },
    seriesSortBy: {
      get() {
        return this.$store.state.libraries.seriesSortBy
      },
      set(val) {
        this.$store.commit('libraries/setSeriesSortBy', val)
      }
    },
    seriesSortDesc: {
      get() {
        return this.$store.state.libraries.seriesSortDesc
      },
      set(val) {
        this.$store.commit('libraries/setSeriesSortDesc', val)
      }
    },
    seriesFilterBy: {
      get() {
        return this.$store.state.libraries.seriesFilterBy
      },
      set(val) {
        this.$store.commit('libraries/setSeriesFilterBy', val)
      }
    }
  },
  methods: {
    async matchAllAuthors() {
      this.processingAuthors = true

      for (const author of this.authors) {
        const payload = {}
        if (author.asin) payload.asin = author.asin
        else payload.q = author.name
        console.log('Payload', payload, 'author', author)

        this.$eventBus.$emit(`searching-author-${author.id}`, true)

        var response = await this.$axios.$post(`/api/authors/${author.id}/match`, payload).catch((error) => {
          console.error('Failed', error)
          return null
        })
        if (!response) {
          console.error(`Author ${author.name} not found`)
          this.$toast.error(`Author ${author.name} not found`)
        } else if (response.updated) {
          if (response.author.imagePath) console.log(`Author ${response.author.name} was updated`)
          else console.log(`Author ${response.author.name} was updated (no image found)`)
        } else {
          console.log(`No updates were made for Author ${response.author.name}`)
        }

        this.$eventBus.$emit(`searching-author-${author.id}`, false)
      }
      this.processingAuthors = false
    },
    removeAllIssues() {
      if (confirm(`Are you sure you want to remove all library items with issues?\n\nNote: This will not delete any files`)) {
        this.processingIssues = true
        this.$axios
          .$delete(`/api/libraries/${this.currentLibraryId}/issues`)
          .then(() => {
            this.$toast.success('Removed library items with issues')
            this.$router.push(`/library/${this.currentLibraryId}/bookshelf`)
            this.processingIssues = false
            this.$store.dispatch('libraries/fetch', this.currentLibraryId)
          })
          .catch((error) => {
            console.error('Failed to remove library items with issues', error)
            this.$toast.error('Failed to remove library items with issues')
            this.processingIssues = false
          })
      }
    },
    markSeriesFinished() {
      var newIsFinished = !this.isSeriesFinished
      this.processingSeries = true
      var updateProgressPayloads = this.seriesLibraryItemIds.map((lid) => {
        return {
          libraryItemId: lid,
          isFinished: newIsFinished
        }
      })
      console.log('Progress payloads', updateProgressPayloads)
      this.$axios
        .patch(`/api/me/progress/batch/update`, updateProgressPayloads)
        .then(() => {
          this.$toast.success('Series update success')
          this.selectedSeries.progress.isFinished = newIsFinished
          this.processingSeries = false
        })
        .catch((error) => {
          this.$toast.error('Series update failed')
          console.error('Failed to batch update read/not read', error)
          this.processingSeries = false
        })
    },
    updateOrder() {
      this.saveSettings()
    },
    updateFilter() {
      this.saveSettings()
    },
    updateSeriesSort() {
      this.$eventBus.$emit('series-sort-updated')
    },
    updateSeriesFilter() {
      this.$eventBus.$emit('series-sort-updated')
    },
    updateCollapseSeries() {
      this.saveSettings()
    },
    updateCollapseBookSeries() {
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
    }
  },
  mounted() {
    this.init()
    this.$store.commit('user/addSettingsListener', { id: 'bookshelftoolbar', meth: this.settingsUpdated })
    this.$eventBus.$on('bookshelf-total-entities', this.setBookshelfTotalEntities)
  },
  beforeDestroy() {
    this.$store.commit('user/removeSettingsListener', 'bookshelftoolbar')
    this.$eventBus.$off('bookshelf-total-entities', this.setBookshelfTotalEntities)
  }
}
</script>


<style>
#toolbar {
  box-shadow: 0px 8px 6px #111111aa;
}
</style>
