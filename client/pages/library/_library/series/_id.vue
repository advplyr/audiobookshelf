<template>
  <div id="page-wrapper" class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar id="series-toolbar" :selected-series="series" />
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center my-8">
        <h1 class="text-2xl">{{ series.name }}</h1>

        <button class="w-8 h-8 rounded-full flex items-center justify-center mx-4 cursor-pointer text-gray-300 hover:text-warning transform hover:scale-125 duration-100" @click="showEditSeries">
          <span class="material-symbols text-base">edit</span>
        </button>
      </div>
      <app-lazy-bookshelf page="series-books" :series-id="seriesId" />
    </div>

    <modals-edit-series-modal v-model="showEditSeriesModal" :series="series" />
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
    return {
      showEditSeriesModal: false
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    seriesUpdated(series) {
      this.series = series
    },
    showEditSeries() {
      this.showEditSeriesModal = !this.showEditSeriesModal
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

<style scoped>
#bookshelf {
  background-image: none;
}
#series-toolbar {
  background-color: rgba(55, 56, 56, 1);
}
</style>
