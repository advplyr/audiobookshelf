<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar :selected-series="series" />
    <app-lazy-bookshelf page="series-books" :series-id="seriesId" />
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    const libraryId = params.library
    const libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    const library = libraryData.library
    if (library.mediaType === 'podcast') {
      return redirect(`/library/${libraryId}`)
    }

    const series = await app.$axios.$get(`/api/libraries/${library.id}/series/${params.id}?include=progress,rssfeed`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!series) {
      return redirect('/oops?message=Series not found')
    }

    return {
      series,
      seriesId: params.id
    }
  },
  data() {
    return {}
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    seriesUpdated(series) {
      this.series = series
    }
  },
  mounted() {
    if (this.$root.socket) {
      this.$root.socket.on('series_updated', this.seriesUpdated)
    }
  },
  beforeDestroy() {
    if (this.$root.socket) {
      this.$root.socket.off('series_updated', this.seriesUpdated)
    }
  }
}
</script>
