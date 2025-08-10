<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar is-home />
    <app-book-shelf-categorized />
  </div>
</template>

<script>
import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

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
