<template>
  <div class="w-full h-20 md:h-10 relative">
    <div class="flex md:hidden h-10 items-center">
      <nuxt-link :to="`/library/${currentLibraryId}`" class="flex-grow h-full flex justify-center items-center" :class="homePage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">Home</p>
      </nuxt-link>
      <nuxt-link :to="`/library/${currentLibraryId}/bookshelf`" class="flex-grow h-full flex justify-center items-center" :class="showLibrary ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">Library</p>
      </nuxt-link>
      <nuxt-link v-if="!isPodcastLibrary" :to="`/library/${currentLibraryId}/bookshelf/series`" class="flex-grow h-full flex justify-center items-center" :class="paramId === 'series' ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">Series</p>
      </nuxt-link>
      <nuxt-link v-if="!isPodcastLibrary" :to="`/library/${currentLibraryId}/bookshelf/collections`" class="flex-grow h-full flex justify-center items-center" :class="paramId === 'collections' ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">Collections</p>
      </nuxt-link>
      <nuxt-link v-if="isPodcastLibrary && userIsAdminOrUp" :to="`/library/${currentLibraryId}/podcast/search`" class="flex-grow h-full flex justify-center items-center" :class="isPodcastSearchPage ? 'bg-primary bg-opacity-80' : 'bg-primary bg-opacity-40'">
        <p class="text-sm">Search</p>
      </nuxt-link>
    </div>
    <div id="toolbar" class="absolute top-10 md:top-0 left-0 w-full h-10 md:h-full z-30 flex items-center justify-end md:justify-start px-2 md:px-8">
      <template v-if="page !== 'search' && page !== 'podcast-search' && !isHome">
        <p v-if="!selectedSeries" class="font-book hidden md:block">{{ numShowing }} {{ entityName }}</p>
        <div v-else class="items-center hidden md:flex w-full">
          <div @click="seriesBackArrow" class="rounded-full h-9 w-9 flex items-center justify-center hover:bg-white hover:bg-opacity-10 cursor-pointer">
            <span class="material-icons text-2xl text-white">west</span>
          </div>
          <p class="pl-4 font-book text-lg">
            {{ seriesName }}
          </p>
          <div class="w-6 h-6 rounded-full bg-black bg-opacity-30 flex items-center justify-center ml-3">
            <span class="font-mono">{{ numShowing }}</span>
          </div>
          <div class="flex-grow" />
          <ui-btn color="primary" small :loading="processingSeries" class="flex items-center" @click="markSeriesFinished">
            <div class="h-5 w-5">
              <svg v-if="isSeriesFinished" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgb(63, 181, 68)">
                <path d="M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-9 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-7 19.6l-7-4.66V3h14v12.93l-7 4.67zm-2.01-7.42l-2.58-2.59L6 12l4 4 8-8-1.42-1.42z" />
              </svg>
            </div>
            <span class="pl-2"> Mark Series {{ isSeriesFinished ? 'Not Finished' : 'Finished' }}</span></ui-btn
          >
        </div>
        <div class="flex-grow hidden sm:inline-block" />

        <ui-checkbox v-show="showSortFilters && !isPodcast" v-model="settings.collapseSeries" label="Collapse Series" checkbox-bg="bg" check-color="white" small class="mr-2" @input="updateCollapseSeries" />
        <controls-filter-select v-show="showSortFilters" v-model="settings.filterBy" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateFilter" />
        <controls-order-select v-show="showSortFilters" v-model="settings.orderBy" :descending.sync="settings.orderDesc" class="w-36 sm:w-44 md:w-48 h-7.5 ml-1 sm:ml-4" @change="updateOrder" />
        <!-- <div v-show="showSortFilters" class="h-7 ml-4 flex border border-white border-opacity-25 rounded-md">
          <div class="h-full px-2 text-white flex items-center rounded-l-md hover:bg-primary hover:bg-opacity-75 cursor-pointer" :class="isGridMode ? 'bg-primary' : 'text-opacity-70'" @click="$emit('update:viewMode', 'grid')">
            <span class="material-icons" style="font-size: 1.4rem">view_module</span>
          </div>
          <div class="h-full px-2 text-white flex items-center rounded-r-md hover:bg-primary hover:bg-opacity-75 cursor-pointer" :class="!isGridMode ? 'bg-primary' : 'text-opacity-70'" @click="$emit('update:viewMode', 'list')">
            <span class="material-icons" style="font-size: 1.4rem">view_list</span>
          </div>
        </div> -->

        <ui-btn v-if="isIssuesFilter && userCanDelete" :loading="processingIssues" color="error" small class="ml-4" @click="removeAllIssues">Remove All {{ numShowing }} {{ entityName }}</ui-btn>
      </template>
      <template v-else-if="page === 'search'">
        <div @click="searchBackArrow" class="rounded-full h-10 w-10 flex items-center justify-center hover:bg-white hover:bg-opacity-10 cursor-pointer">
          <span class="material-icons text-3xl text-white">west</span>
        </div>
        <div class="flex-grow" />
        <p>Search results for "{{ searchQuery }}"</p>
        <div class="flex-grow" />
      </template>
      <template v-else-if="page === 'authors'">
        <div class="flex-grow" />
        <ui-btn v-if="userCanUpdate && authors && authors.length" :loading="processingAuthors" color="primary" small @click="matchAllAuthors">Match All Authors</ui-btn>
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
    viewMode: String,
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
      keywordFilter: null,
      keywordTimeout: null,
      processingSeries: false,
      processingIssues: false,
      processingAuthors: false
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
    isPodcast() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType'] == 'podcast'
    },
    isGridMode() {
      return this.viewMode === 'grid'
    },
    showSortFilters() {
      return this.page === ''
    },
    numShowing() {
      return this.totalEntities
    },
    entityName() {
      if (this.isPodcast) return 'Podcasts'
      if (!this.page) return 'Books'
      if (this.page === 'series') return 'Series'
      if (this.page === 'collections') return 'Collections'
      return ''
    },
    paramId() {
      return this.$route.params ? this.$route.params.id || '' : ''
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
    homePage() {
      return this.$route.name === 'library-library'
    },
    libraryBookshelfPage() {
      return this.$route.name === 'library-library-bookshelf-id'
    },
    showLibrary() {
      return this.libraryBookshelfPage && this.paramId === '' && !this.showingIssues
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
    isPodcastSearchPage() {
      return this.$route.name === 'library-library-podcast-search'
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
    searchBackArrow() {
      this.$router.replace(`/library/${this.currentLibraryId}/bookshelf`)
    },
    seriesBackArrow() {
      this.$router.replace(`/library/${this.currentLibraryId}/bookshelf/series`)
    },
    updateOrder() {
      this.saveSettings()
    },
    updateFilter() {
      this.saveSettings()
    },
    updateCollapseSeries() {
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
    keywordFilterInput() {
      clearTimeout(this.keywordTimeout)
      this.keywordTimeout = setTimeout(() => {
        this.keywordUpdated(this.keywordFilter)
      }, 1000)
    },
    keywordUpdated() {
      this.$eventBus.$emit('bookshelf-keyword-filter', this.keywordFilter)
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