<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''"></div>
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
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    }
  },
  methods: {},
  mounted() {},
  beforeDestroy() {}
}
</script>
