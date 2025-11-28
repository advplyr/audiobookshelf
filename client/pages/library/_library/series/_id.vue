<template>
  <div id="page-wrapper" class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar id="series-toolbar" :selected-series="series" />
    <div class="h-full overflow-y-auto pb-[100px]">
      <div class="max-w-6xl mx-auto">
        <div class="px-4e sm:px-8e">
          <div class="flex items-center my-8">
            <h1 class="text-2xl">{{ series.name }}</h1>

            <button class="w-8 h-8 rounded-full flex items-center justify-center mx-4 cursor-pointer text-gray-300 hover:text-warning transform hover:scale-125 duration-100" @click="showEditSeries">
              <span class="material-symbols text-base">edit</span>
            </button>
          </div>
          <div class="mb-6">
            <h2 class="font-semibold">
              {{ $strings.LabelDescription }}
            </h2>
            <div>{{ series.description }}</div>
          </div>
          <div class="mb-6">
            <h2 class="font-semibold">
              {{ authors.length > 1 ? $strings.LabelAuthors : $strings.LabelAuthor }}
            </h2>
            <div>{{ authors.join(', ') }}</div>
          </div>
          <div class="mb-6">
            <h2 class="font-semibold">{{ this.$strings.LabelTotalDuration }}</h2>
            <div>{{ totalDuration.hours }}<span>hrs</span> {{ totalDuration.minutes }}<span>min</span></div>
          </div>
        </div>

        <app-lazy-bookshelf page="series-books" :series-id="seriesId" />
      </div>
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

    const series = await app.$axios.$get(`/api/libraries/${library.id}/series/${params.id}?include=progress,rssfeed&expanded=1`).catch((error) => {
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
    },
    totalDuration() {
      const totalSeconds = this.series.books.reduce((acc, book) => acc + book.duration, 0)
      const hours = Math.floor(totalSeconds / 3600)
      const minuteRemainder = totalSeconds % 3600
      const minutes = Math.floor(minuteRemainder / 60)

      return { hours, minutes }
    },
    authors() {
      // Get nested array of authors
      const nestedAuthors = this.series.books.map((book) => book.authors.map((author) => author.name))
      // Flatten to one array
      const authors = nestedAuthors.flat(1)
      // Remove duplicates
      return [...new Set(authors)]
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
