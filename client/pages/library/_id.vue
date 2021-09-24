<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail />
      <div class="flex-grow">
        <app-book-shelf-toolbar :page="id || ''" :selected-series.sync="selectedSeries" />
        <app-book-shelf :page="id || ''" :selected-series.sync="selectedSeries" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  asyncData({ params, query, store, app }) {
    if (query.filter) {
      store.dispatch('user/updateUserSettings', { filterBy: query.filter })
    }
    return {
      id: params.id,
      selectedSeries: query.series ? app.$decode(query.series) : null
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