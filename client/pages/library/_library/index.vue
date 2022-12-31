<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar is-home />
    <app-book-shelf-categorized />
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect }) {
    const libraryId = params.library
    const library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect(`/oops?message=Library "${libraryId}" not found`)
    }
    return {
      library
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
  methods: {},
  mounted() {},
  beforeDestroy() {}
}
</script>
