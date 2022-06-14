<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar :page="id || ''" :view-mode.sync="viewMode" />
    <app-lazy-bookshelf :page="id || ''" :view-mode="viewMode" />
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

    // Set filter by
    if (query.filter) {
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
    return {
      viewMode: 'grid'
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {}
}
</script>