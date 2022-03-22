<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail class="hidden md:block" />
      <div class="flex-grow">
        <app-book-shelf-toolbar page="podcast-search" />
        <div class="w-full h-full overflow-y-auto p-12 relative">
          <div class="w-full max-w-3xl mx-auto">
            <form @submit.prevent="submitSearch" class="flex">
              <ui-text-input v-model="searchTerm" :disabled="processing" placeholder="Search term" class="flex-grow mr-2" />
              <ui-btn type="submit" :disabled="processing">Search Podcasts</ui-btn>
            </form>
          </div>

          <div class="w-full max-w-3xl mx-auto py-4">
            <p v-if="termSearched && !results.length && !processing" class="text-center text-xl">No podcasts found</p>
            <template v-for="podcast in results">
              <div :key="podcast.id" class="flex p-1 hover:bg-primary hover:bg-opacity-25 cursor-pointer" @click="selectPodcast(podcast)">
                <div class="w-24 min-w-24 h-24 bg-primary">
                  <img v-if="podcast.cover" :src="podcast.cover" class="h-full w-full" />
                </div>
                <div class="flex-grow pl-4 max-w-2xl">
                  <a :href="podcast.pageUrl" class="text-lg text-gray-200 hover:underline" target="_blank" @click.stop>{{ podcast.title }}</a>
                  <p class="text-base text-gray-300 whitespace-nowrap truncate">by {{ podcast.artistName }}</p>
                  <p class="text-xs text-gray-400 leading-5">{{ podcast.genres.join(', ') }}</p>
                  <p class="text-xs text-gray-400 leading-5">{{ podcast.trackCount }} Episodes</p>
                </div>
              </div>
            </template>
          </div>

          <div v-show="processing" class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-25 z-40">
            <ui-loading-indicator />
          </div>
        </div>
      </div>
    </div>

    <modals-podcast-new-modal v-model="showNewPodcastModal" :podcast-data="selectedPodcast" :podcast-feed-data="selectedPodcastFeed" />
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, app, redirect }) {
    var libraryId = params.library
    var library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect('/oops?message=Library not found')
    }
    return {
      libraryId
    }
  },
  data() {
    return {
      searchTerm: '',
      results: [],
      termSearched: '',
      processing: false,

      showNewPodcastModal: false,
      selectedPodcast: null,
      selectedPodcastFeed: null
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    async submitSearch() {
      if (!this.searchTerm) return
      console.log('Searching', this.searchTerm)
      var term = this.searchTerm
      this.processing = true
      this.termSearched = ''
      var results = await this.$axios.$get(`/api/search/podcast?term=${encodeURIComponent(this.searchTerm)}`).catch((error) => {
        console.error('Search request failed', error)
        return []
      })
      console.log('Got results', results)
      this.results = results
      this.termSearched = term
      this.processing = false
    },
    async selectPodcast(podcast) {
      console.log('Selected podcast', podcast)
      if (!podcast.feedUrl) {
        this.$toast.error('Invalid podcast - no feed')
        return
      }
      this.processing = true
      var podcastfeed = await this.$axios.$post(`/api/podcasts/feed`, { rssFeed: podcast.feedUrl }).catch((error) => {
        console.error('Failed to get feed', error)
        this.$toast.error('Failed to get podcast feed')
        return null
      })
      this.processing = false
      if (!podcastfeed) return
      this.selectedPodcastFeed = podcastfeed
      this.selectedPodcast = podcast
      this.showNewPodcastModal = true
      console.log('Got podcast feed', podcastfeed)
    }
  },
  mounted() {}
}
</script>