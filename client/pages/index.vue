<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''"></div>
</template>

<script>
export default {
  asyncData({ redirect, store }) {
    if (!store.state.libraries.currentLibraryId) {
      return redirect('/oops?message=No libraries')
    }
    redirect(`/library/${store.state.libraries.currentLibraryId}`)
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
