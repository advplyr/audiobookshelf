<template>
  <div class="page" :class="streamAudiobook ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail class="hidden md:block" />
      <div class="flex-grow">
        <app-book-shelf-toolbar is-home />
        <app-book-shelf-categorized v-if="hasResults" search :results="results" />
        <div v-else class="w-full py-16">
          <p class="text-xl text-center">No Search results for "{{ query }}"</p>
          <div class="flex justify-center">
            <ui-btn class="w-52 my-4" @click="back">Back</ui-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    var libraryId = params.library
    var query = query.q
    var results = await app.$axios.$get(`/api/libraries/${libraryId}/search?q=${query}`).catch((error) => {
      console.error('Failed to search library', error)
      return null
    })
    results = {
      audiobooks: results && results.audiobooks.length ? results.audiobooks : null,
      authors: results && results.authors.length ? results.authors : null,
      series: results && results.series.length ? results.series : null,
      tags: results && results.tags.length ? results.tags : null
    }
    console.log('SEARCH RESULTS', results)
    return {
      results,
      query
    }
  },
  data() {
    return {}
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    hasResults() {
      return Object.values(this.results).find((r) => !!r)
    }
  },
  methods: {
    async back() {
      var popped = await this.$store.dispatch('popRoute')
      if (popped) this.$store.commit('setIsRoutingBack', true)
      var backTo = popped || '/'
      this.$router.push(backTo)
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
