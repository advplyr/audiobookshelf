<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="podcast-search" />

    <div id="bookshelf" class="w-full overflow-y-auto px-2 py-6 sm:px-4 md:p-12 relative">
      <div class="w-full max-w-4xl mx-auto flex">
        <form @submit.prevent="submit" class="flex grow">
          <ui-text-input v-model="searchInput" type="search" :disabled="processing" :placeholder="$strings.MessagePodcastSearchField" class="grow mr-2 text-sm md:text-base" />
          <ui-btn type="submit" :disabled="processing" class="hidden md:block">{{ $strings.ButtonSubmit }}</ui-btn>
          <ui-btn type="submit" :disabled="processing" class="block md:hidden" small>{{ $strings.ButtonSubmit }}</ui-btn>
        </form>
        <ui-file-input ref="fileInput" :accept="'.opml, .txt'" class="ml-2" @change="opmlFileUpload">{{ $strings.ButtonUploadOPMLFile }}</ui-file-input>
      </div>
      <div class="w-full max-w-3xl mx-auto py-4">
        <p v-if="termSearched && !results.length && !processing" class="text-center text-xl">{{ $strings.MessageNoPodcastsFound }}</p>
        <template v-for="podcast in results">
          <div :key="podcast.id" class="flex p-1 hover:bg-primary/25 cursor-pointer" @click="selectPodcast(podcast)">
            <div class="w-20 min-w-20 h-20 md:w-24 md:min-w-24 md:h-24 bg-primary">
              <img v-if="podcast.cover" :src="podcast.cover" class="h-full w-full" />
            </div>
            <div class="grow pl-4 max-w-2xl">
              <div class="flex items-center">
                <a :href="podcast.pageUrl" class="text-base md:text-lg text-gray-200 hover:underline" target="_blank" @click.stop>{{ podcast.title }}</a>
                <widgets-explicit-indicator v-if="podcast.explicit" />
                <widgets-already-in-library-indicator v-if="podcast.alreadyInLibrary" />
              </div>
              <p class="text-sm md:text-base text-gray-300 whitespace-nowrap truncate">{{ $getString('LabelByAuthor', [podcast.artistName]) }}</p>
              <p class="text-xs text-gray-400 leading-5">{{ podcast.genres.join(', ') }}</p>
              <p class="text-xs text-gray-400 leading-5">{{ podcast.trackCount }} {{ $strings.HeaderEpisodes }}</p>
            </div>
          </div>
        </template>
      </div>

      <div v-show="processing" class="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/25 z-40">
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
    // Podcast search/add page is restricted to admins
    if (!store.getters['user/getIsAdminOrUp']) {
      return redirect(`/library/${params.library}`)
    }

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
      opmlFeeds: [],
      existentPodcasts: []
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    librarySettings() {
      return this.$store.getters['libraries/getCurrentLibrarySettings']
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

      if (this.$refs.fileInput) {
        this.$refs.fileInput.reset()
      }

      if (!txt || !txt.includes('<opml') || !txt.includes('<outline ')) {
        // Quick lazy check for valid OPML
        this.$toast.error(this.$strings.MessageTaskOpmlParseFastFail)
        this.processing = false
        return
      }

      this.$axios
        .$post(`/api/podcasts/opml/parse`, { opmlText: txt })
        .then((data) => {
          if (!data.feeds?.length) {
            this.$toast.error(this.$strings.MessageTaskOpmlParseNoneFound)
          } else {
            this.opmlFeeds = data.feeds || []
            this.showOPMLFeedsModal = true
          }
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error(this.$strings.MessageTaskOpmlParseFailed)
        })
        .finally(() => {
          this.processing = false
        })
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
        this.$toast.error(this.$strings.ToastPodcastGetFeedFailed)
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

      const searchParams = new URLSearchParams({
        term,
        country: this.librarySettings?.podcastSearchRegion || 'us'
      })
      let results = await this.$axios.$get(`/api/search/podcast?${searchParams.toString()}`).catch((error) => {
        console.error('Search request failed', error)
        return []
      })
      console.log('Got results', results)

      // Filter out podcasts without an RSS feed
      results = results.filter((r) => r.feedUrl)

      for (let result of results) {
        let podcast = this.existentPodcasts.find((p) => p.itunesId === result.id || p.title === result.title.toLowerCase())
        if (podcast) {
          result.alreadyInLibrary = true
          result.existentId = podcast.id
        }
      }
      this.results = results
      this.termSearched = term
      this.processing = false
    },
    async selectPodcast(podcast) {
      console.log('Selected podcast', podcast)
      if (podcast.existentId) {
        this.$router.push(`/item/${podcast.existentId}`)
        return
      }
      if (!podcast.feedUrl) {
        this.$toast.error(this.$strings.MessageNoPodcastFeed)
        return
      }
      this.processing = true
      const payload = await this.$axios.$post(`/api/podcasts/feed`, { rssFeed: podcast.feedUrl }).catch((error) => {
        console.error('Failed to get feed', error)
        this.$toast.error(this.$strings.ToastPodcastGetFeedFailed)
        return null
      })
      this.processing = false
      if (!payload) return

      this.selectedPodcastFeed = payload.podcast
      this.selectedPodcast = podcast
      this.showNewPodcastModal = true
      console.log('Got podcast feed', payload.podcast)
    },
    async fetchExistentPodcastsInYourLibrary() {
      this.processing = true

      const podcastsResponse = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/podcast-titles`).catch((error) => {
        console.error('Failed to fetch podcasts', error)
        return []
      })
      this.existentPodcasts = podcastsResponse.podcasts.map((p) => {
        return {
          title: p.title.toLowerCase(),
          itunesId: p.itunesId,
          id: p.libraryItemId
        }
      })
      this.processing = false
    }
  },
  mounted() {
    this.fetchExistentPodcastsInYourLibrary()
  }
}
</script>
