<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <app-book-shelf />
  </div>
</template>

<script>
export default {
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
