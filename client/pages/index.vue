<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <!-- <app-book-shelf-toolbar /> -->
    <!-- <div class="flex h-full">
      <app-side-rail />
      <div class="flex-grow"> -->
    <!-- <app-book-shelf /> -->
    <!-- </div> -->
    <!-- </div> -->
  </div>
</template>

<script>
export default {
  asyncData({ redirect }) {
    redirect('/library')
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
