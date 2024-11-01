<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar is-home page="search" :search-query="query" />
    <app-book-shelf-categorized v-if="hasResults" ref="bookshelf" search :results="results" />
    <div v-else class="w-full py-16">
      <p class="text-xl text-center">{{ $getString('MessageNoSearchResultsFor', [query]) }}</p>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    const libraryId = params.library
    const library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect('/oops?message=Library not found')
    }
    let results = await app.$axios.$get(`/api/libraries/${libraryId}/search?q=${encodeURIComponent(query.q)}`).catch((error) => {
      console.error('Failed to search library', error)
      return null
    })
    results = {
      podcasts: results?.podcast || [],
      books: results?.book || [],
      authors: results?.authors || [],
      series: results?.series || [],
      tags: results?.tags || [],
      narrators: results?.narrators || []
    }
    return {
      libraryId,
      results,
      query: query.q
    }
  },
  data() {
    return {}
  },
  watch: {
    '$route.query'(newVal, oldVal) {
      if (newVal && newVal.q && newVal.q !== this.query) {
        this.query = newVal.q
        this.search()
      }
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    hasResults() {
      return Object.values(this.results).find((r) => !!r && r.length)
    }
  },
  methods: {
    async search() {
      const results = await this.$axios.$get(`/api/libraries/${this.libraryId}/search?q=${encodeURIComponent(this.query)}`).catch((error) => {
        console.error('Failed to search library', error)
        return null
      })
      this.results = {
        podcasts: results?.podcast || [],
        books: results?.book || [],
        authors: results?.authors || [],
        series: results?.series || [],
        tags: results?.tags || [],
        narrators: results?.narrators || []
      }
      this.$nextTick(() => {
        if (this.$refs.bookshelf) {
          this.$refs.bookshelf.setShelvesFromSearch()
        }
      })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
