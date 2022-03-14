<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''"></div>
</template>

<script>
export default {
  asyncData({ redirect, store }) {
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
