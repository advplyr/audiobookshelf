<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail class="hidden md:block" />
      <div class="flex-grow">
        <app-book-shelf-toolbar is-home />
        <app-book-shelf-categorized />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect }) {
    var libraryId = params.library
    var library = await store.dispatch('libraries/fetch', libraryId)
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
