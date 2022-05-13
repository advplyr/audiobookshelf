<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar is-home page="search" :search-query="query" />
    <app-book-shelf-categorized v-if="hasResults" ref="bookshelf" search :results="results" />
    <div v-else class="w-full py-16">
      <p class="text-xl text-center">No Search results for "{{ query }}"</p>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    var libraryId = params.library
    var library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect('/oops?message=Library not found')
    }
    var query = query.q
    var results = await app.$axios.$get(`/api/libraries/${libraryId}/search?q=${query}`).catch((error) => {
      console.error('Failed to search library', error)
      return null
    })
    results = {
      podcasts: results && results.podcast ? results.podcast : null,
      books: results && results.book ? results.book : null,
      authors: results && results.authors.length ? results.authors : null,
      series: results && results.series.length ? results.series : null,
      tags: results && results.tags.length ? results.tags : null
    }
    return {
      libraryId,
      results,
      query
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
      var results = await this.$axios.$get(`/api/libraries/${this.libraryId}/search?q=${this.query}`).catch((error) => {
        console.error('Failed to search library', error)
        return null
      })
      this.results = {
        podcasts: results && results.podcast ? results.podcast : null,
        books: results && results.book ? results.book : null,
        authors: results && results.authors.length ? results.authors : null,
        series: results && results.series.length ? results.series : null,
        tags: results && results.tags.length ? results.tags : null
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
