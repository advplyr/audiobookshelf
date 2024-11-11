<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar :page="id || ''" />
    <app-lazy-bookshelf :page="id || ''" />
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, redirect }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    // Set series sort by
    if (query.filter || query.sort || query.desc) {
      const isSeries = params.id === 'series'
      const settingsUpdate = {
        [isSeries ? 'seriesFilterBy' : 'filterBy']: query.filter || undefined,
        [isSeries ? 'seriesSortBy' : 'orderBy']: query.sort || undefined,
        [isSeries ? 'seriesSortDesc' : 'orderDesc']: query.desc == '0' ? false : query.desc == '1' ? true : undefined
      }
      store.dispatch('user/updateUserSettings', settingsUpdate)
    }

    // Redirect podcast libraries
    const library = libraryData.library
    if (library.mediaType === 'podcast' && (params.id === 'collections' || params.id === 'series' || params.id === 'authors')) {
      return redirect(`/library/${libraryId}`)
    }

    return {
      id: params.id || '',
      libraryId
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
  methods: {}
}
</script>
