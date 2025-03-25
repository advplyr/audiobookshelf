<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="podcast-search" />

    <div id="bookshelf" class="w-full overflow-y-auto px-2 py-6 sm:px-4 md:p-12 relative">
      <div class="w-full max-w-5xl mx-auto py-4">
        <p class="text-xl mb-2 font-semibold px-4 md:px-0">{{ $strings.HeaderCurrentDownloads }}</p>
        <p v-if="!episodesDownloading.length" class="text-lg py-4">{{ $strings.MessageNoDownloadsInProgress }}</p>
        <template v-for="episode in episodesDownloading">
          <div :key="episode.id" class="flex py-5 relative">
            <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrcById'](episode.libraryItemId)" :width="96" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" class="hidden md:block" />
            <div class="grow pl-4 max-w-2xl">
              <!-- mobile -->
              <div class="flex md:hidden mb-2">
                <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrcById'](episode.libraryItemId)" :width="48" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" class="md:hidden" />
                <div class="grow px-2">
                  <div class="flex items-center">
                    <nuxt-link :to="`/item/${episode.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ episode.podcastTitle }}</nuxt-link>
                    <widgets-explicit-indicator v-if="episode.podcastExplicit" />
                  </div>
                  <p class="text-xs text-gray-300 mb-1">{{ $dateDistanceFromNow(episode.publishedAt) }}</p>
                </div>
              </div>
              <!-- desktop -->
              <div class="hidden md:block">
                <div class="flex items-center">
                  <nuxt-link :to="`/item/${episode.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ episode.podcastTitle }}</nuxt-link>
                  <widgets-explicit-indicator v-if="episode.podcastExplicit" />
                </div>
                <p class="text-xs text-gray-300 mb-1">{{ $dateDistanceFromNow(episode.publishedAt) }}</p>
              </div>

              <div class="flex items-center font-semibold text-gray-200">
                <div v-if="episode.season || episode.episode">#</div>
                <div v-if="episode.season">{{ episode.season }}x</div>
                <div v-if="episode.episode">{{ episode.episode }}</div>
              </div>

              <div class="flex items-center mb-2">
                <span class="font-semibold text-sm md:text-base">{{ episode.episodeDisplayTitle }}</span>
                <widgets-podcast-type-indicator :type="episode.episodeType" />
              </div>

              <p class="text-sm text-gray-200 mb-4">{{ episode.subtitle }}</p>
            </div>
          </div>
        </template>

        <tables-podcast-download-queue-table v-if="episodeDownloadsQueued.length" :queue="episodeDownloadsQueued"></tables-podcast-download-queue-table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, store }) {
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
      libraryId: params.library
    }
  },
  data() {
    return {
      episodesDownloading: [],
      episodeDownloadsQueued: [],
      processing: false
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    episodeDownloadQueued(episodeDownload) {
      if (episodeDownload.libraryId === this.libraryId) {
        this.episodeDownloadsQueued.push(episodeDownload)
      }
    },
    episodeDownloadStarted(episodeDownload) {
      if (episodeDownload.libraryId === this.libraryId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading.push(episodeDownload)
      }
    },
    episodeDownloadFinished(episodeDownload) {
      if (episodeDownload.libraryId === this.libraryId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading = this.episodesDownloading.filter((d) => d.id !== episodeDownload.id)
      }
    },
    async loadInitialDownloadQueue() {
      this.processing = true
      const queuePayload = await this.$axios.$get(`/api/libraries/${this.libraryId}/episode-downloads`).catch((error) => {
        console.error('Failed to get download queue', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return null
      })
      this.processing = false
      this.episodeDownloadsQueued = queuePayload?.queue || []

      if (queuePayload?.currentDownload) {
        this.episodesDownloading.push(queuePayload.currentDownload)
      }

      // Initialize listeners after load to prevent event race conditions
      this.initListeners()
    },
    initListeners() {
      this.$root.socket.on('episode_download_queued', this.episodeDownloadQueued)
      this.$root.socket.on('episode_download_started', this.episodeDownloadStarted)
      this.$root.socket.on('episode_download_finished', this.episodeDownloadFinished)
    }
  },
  mounted() {
    this.loadInitialDownloadQueue()
  },
  beforeDestroy() {
    this.$root.socket.off('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.off('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.off('episode_download_finished', this.episodeDownloadFinished)
  }
}
</script>
