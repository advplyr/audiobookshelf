<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail class="hidden md:block" />
      <div class="flex-grow">
        <app-book-shelf-toolbar :page="id || ''" :search-results="searchResults" :search-query="searchQuery" :selected-series.sync="selectedSeries" :view-mode.sync="viewMode" />
        <app-book-shelf :page="id || ''" :search-results="searchResults" :search-query="searchQuery" :selected-series.sync="selectedSeries" :view-mode="viewMode" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, app, redirect }) {
    var libraryId = params.library
    var library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect('/oops?message=Library not found')
    }

    // Set filter by
    if (query.filter) {
      store.dispatch('user/updateUserSettings', { filterBy: query.filter })
    }

    // Search page
    var searchResults = {}
    var audiobookSearchResults = []
    var searchQuery = null
    if (params.id === 'search' && query.query) {
      searchQuery = query.query

      searchResults = await app.$axios.$get(`/api/library/${libraryId}/search?q=${searchQuery}`).catch((error) => {
        console.error('Search error', error)
        return {}
      })
      audiobookSearchResults = searchResults.audiobooks || []
      store.commit('audiobooks/setSearchResults', searchResults)
      if (audiobookSearchResults.length) audiobookSearchResults.forEach((ab) => store.commit('audiobooks/addUpdate', ab.audiobook))
    }

    // Series page
    var selectedSeries = query.series ? app.$decode(query.series) : null
    store.commit('audiobooks/setSelectedSeries', selectedSeries)

    var libraryPage = params.id || ''
    store.commit('audiobooks/setLibraryPage', libraryPage)

    return {
      id: libraryPage,
      libraryId,
      searchQuery,
      searchResults,
      selectedSeries
    }
  },
  data() {
    return {
      viewMode: 'grid'
    }
  },
  watch: {
    '$route.query'(newVal) {
      if (this.id === 'search' && this.$route.query.query) {
        if (this.$route.query.query !== this.searchQuery) {
          this.newQuery()
        }
      } else if (this.id === 'series') {
        if (this.selectedSeries && this.$route.query.series && this.$route.query.series !== this.$encode(this.selectedSeries)) {
          // Series changed
          this.selectedSeries = this.$decode(this.$route.query.series)
        } else if (!this.selectedSeries && this.$route.query.series) {
          // Series selected
          this.selectedSeries = this.$decode(this.$route.query.series)
        } else if (this.selectedSeries && !this.$route.query.series) {
          // Series unselected
          this.selectedSeries = null
        }
      }
    }
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    }
  },
  methods: {
    async newQuery() {
      var query = this.$route.query.query
      this.searchResults = await this.$axios.$get(`/api/library/${this.libraryId}/search?q=${query}`).catch((error) => {
        console.error('Search error', error)
        return {}
      })
      this.searchQuery = query
    }
  },
  mounted() {}
}
</script>