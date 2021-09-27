<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail />
      <div class="flex-grow">
        <app-book-shelf-toolbar :page="id || ''" :search-results="searchResults" :search-query="searchQuery" :selected-series.sync="selectedSeries" />
        <app-book-shelf :page="id || ''" :search-results="searchResults" :search-query="searchQuery" :selected-series.sync="selectedSeries" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, app }) {
    if (query.filter) {
      store.dispatch('user/updateUserSettings', { filterBy: query.filter })
    }
    var searchResults = []
    var searchQuery = null
    if (params.id === 'search' && query.query) {
      searchQuery = query.query
      searchResults = await app.$axios.$get(`/api/audiobooks?q=${query.query}`).catch((error) => {
        console.error('Search error', error)
        return []
      })
      store.commit('audiobooks/setSearchResults', searchResults)
    }
    var selectedSeries = query.series ? app.$decode(query.series) : null
    store.commit('audiobooks/setSelectedSeries', selectedSeries)
    var libraryPage = params.id || ''
    store.commit('audiobooks/setLibraryPage', libraryPage)

    return {
      id: libraryPage,
      searchQuery,
      searchResults,
      selectedSeries
    }
  },
  data() {
    return {}
  },
  watch: {
    '$route.query'(newVal) {
      if (this.id === 'search' && this.$route.query.query) {
        if (this.$route.query.query !== this.searchQuery) {
          this.newQuery()
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
      this.searchResults = await this.$axios.$get(`/api/audiobooks?q=${query}`).catch((error) => {
        console.error('Search error', error)
        return []
      })
      this.searchQuery = query
    }
  },
  mounted() {}
}
</script>