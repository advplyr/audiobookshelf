<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail />
      <div class="flex-grow">
        <app-book-shelf-toolbar />
        <app-book-shelf :page="id || ''" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ params }) {
    return {
      id: params.id
    }
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
  mounted() {}
}
</script>