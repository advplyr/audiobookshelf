<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar :selected-series="series" />
    <app-lazy-bookshelf page="series-books" :series-id="seriesId" />
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    const library = libraryData.library
    if (library.mediaType === 'podcast') {
      return redirect(`/library/${libraryId}`)
    }

    var series = await app.$axios.$get(`/api/series/${params.id}?include=progress`).catch((error) => {
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
  mounted() {},
  beforeDestroy() {}
}
</script>
