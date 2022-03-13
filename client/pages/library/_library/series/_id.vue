<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail class="hidden md:block" />
      <div class="flex-grow">
        <app-book-shelf-toolbar :selected-series="series" />
        <app-lazy-bookshelf page="series-books" :series-id="seriesId" />
      </div>
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
    var series = await app.$axios.$get(`/api/series/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!series) {
      return redirect('/oops?message=Series not found')
    }

    return {
      series: series.name,
      seriesId: params.id
    }
  },
  data() {
    return {}
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
