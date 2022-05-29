<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="podcast-search" />

    <div class="w-full h-full overflow-y-auto p-12 relative">
      <div class="w-full max-w-4xl mx-auto flex">
        <form @submit.prevent="submit" class="flex flex-grow">
          <ui-text-input v-model="searchInput" :disabled="processing" placeholder="Enter search term or RSS feed URL" class="flex-grow mr-2" />
          <ui-btn type="submit" :disabled="processing">Submit</ui-btn>
        </form>
        <ui-file-input :accept="'.opml, .txt'" class="mx-2" @change="opmlFileUpload"> Upload OPML File </ui-file-input>
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

    <modals-podcast-new-modal v-model="showNewPodcastModal" :podcast-data="selectedPodcast" :podcast-feed-data="selectedPodcastFeed" />
    <modals-podcast-opml-feeds-modal v-model="showOPMLFeedsModal" :feeds="opmlFeeds" />
  </div>
</template>

<script>
export default {
  async asyncData({ params, query, store, app, redirect }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    // Redirect book libraries
    const library = libraryData.library
    if (library.mediaType === 'book') {
      return redirect(`/library/${libraryId}`)
    }

    return {
      libraryId
    }
  },
  data() {
    return {
      searchInput: '',
      results: [],
      termSearched: '',
      processing: false,
      showNewPodcastModal: false,
      selectedPodcast: null,
      selectedPodcastFeed: null,
      showOPMLFeedsModal: false,
      opmlFeeds: []
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    async opmlFileUpload(file) {
      this.processing = true
      var txt = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve(reader.result)
        }
        reader.readAsText(file)
      })

      if (!txt || !txt.includes('<opml') || !txt.includes('<outline ')) {
        // Quick lazy check for valid OPML
        this.$toast.error('Invalid OPML file <opml> tag not found OR an <outline> tag was not found')
        this.processing = false
        return
      }

      await this.$axios
        .$post(`/api/podcasts/opml`, { opmlText: txt })
        .then((data) => {
          console.log(data)
          this.opmlFeeds = data.feeds || []
          this.showOPMLFeedsModal = true
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Failed to parse OPML file')
        })
      this.processing = false
    },
    submit() {
      if (!this.searchInput) return

      if (this.searchInput.startsWith('http:') || this.searchInput.startsWith('https:')) {
        this.termSearched = ''
        this.results = []
        this.checkRSSFeed(this.searchInput)
      } else {
        this.submitSearch(this.searchInput)
      }
    },
    async checkRSSFeed(rssFeed) {
      this.processing = true
      var payload = await this.$axios.$post(`/api/podcasts/feed`, { rssFeed }).catch((error) => {
        console.error('Failed to get feed', error)
        this.$toast.error('Failed to get podcast feed')
        return null
      })
      this.processing = false
      if (!payload) return

      this.selectedPodcastFeed = payload.podcast
      this.selectedPodcast = null
      this.showNewPodcastModal = true
    },
    async submitSearch(term) {
      this.processing = true
      this.termSearched = ''
      var results = await this.$axios.$get(`/api/search/podcast?term=${encodeURIComponent(term)}`).catch((error) => {
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
      var payload = await this.$axios.$post(`/api/podcasts/feed`, { rssFeed: podcast.feedUrl }).catch((error) => {
        console.error('Failed to get feed', error)
        this.$toast.error('Failed to get podcast feed')
        return null
      })
      this.processing = false
      if (!payload) return

      this.selectedPodcastFeed = payload.podcast
      this.selectedPodcast = podcast
      this.showNewPodcastModal = true
      console.log('Got podcast feed', payload.podcast)
    }
  },
  mounted() {}
}
</script>