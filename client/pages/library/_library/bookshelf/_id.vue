<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail class="hidden md:block" />
      <div class="flex-grow">
        <app-book-shelf-toolbar :page="id || ''" :view-mode.sync="viewMode" />
        <app-lazy-bookshelf :page="id || ''" :view-mode="viewMode" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, app, redirect }) {
    var libraryId = params.library
    var library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect('/oops?message=Library not found')
    }

    // Set filter by
    if (query.filter) {
      store.dispatch('user/updateUserSettings', { filterBy: query.filter })
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