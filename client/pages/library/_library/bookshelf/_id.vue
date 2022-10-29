<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar :page="id || ''" />
    <app-lazy-bookshelf :page="id || ''" />
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, app, redirect }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    // Set series sort by
    if (params.id === 'series') {
      console.log('Series page', query)
      if (query.sort) {
        store.commit('libraries/setSeriesSortBy', query.sort)
        store.commit('libraries/setSeriesSortDesc', !!query.desc)
      }
      if (query.filter) {
        console.log('has filter', query.filter)
        store.commit('libraries/setSeriesFilterBy', query.filter)
      }
    } else if (query.filter) {
      store.dispatch('user/updateUserSettings', { filterBy: query.filter })
    }

    // Redirect podcast libraries
    const library = libraryData.library
    if (library.mediaType === 'podcast' && (params.id === 'collections' || params.id === 'series')) {
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
