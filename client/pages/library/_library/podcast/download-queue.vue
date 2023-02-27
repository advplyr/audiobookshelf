<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="podcast-search" />

    <div id="bookshelf" class="w-full overflow-y-auto px-2 py-6 sm:px-4 md:p-12 relative">

      <div class="w-full max-w-3xl mx-auto py-4">
        <p class="text-xl mb-2 font-semibold px-4 md:px-0">{{ $strings.HeaderCurrentDownloads }}</p>
        <p v-if="!episodesDownloading.length" class="text-center text-xl">{{ $strings.MessageNoDownloadsInProgress }}</p>
        <template v-for="episode in episodesDownloading">
          <div :key="episode.id" class="flex py-5 relative">
            <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrcById'](episode.libraryItemId)" :width="96" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" class="hidden md:block" />
            <div class="flex-grow pl-4 max-w-2xl">
              <!-- mobile -->
              <div class="flex md:hidden mb-2">
                <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrcById'](episode.libraryItemId)" :width="48" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" class="md:hidden" />
                <div class="flex-grow px-2">
                  <div class="flex items-center">
                    <nuxt-link :to="`/item/${episode.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ episode.podcastTitle }}</nuxt-link>
                    <widgets-explicit-indicator :explicit="episode.podcastExplicit" />
                  </div>
                  <p class="text-xs text-gray-300 mb-1">{{ $dateDistanceFromNow(episode.publishedAt) }}</p>
                </div>
              </div>
              <!-- desktop -->
              <div class="hidden md:block">
                <div class="flex items-center">
                  <nuxt-link :to="`/item/${episode.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ episode.podcastTitle }}</nuxt-link>
                  <widgets-explicit-indicator :explicit="episode.podcastExplicit" />
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
      </div>

      <tables-podcast-download-queue-table :queue="episodeDownloadsQueued"></tables-podcast-download-queue-table>
    </div>
  </div>
</template>
<script>
import DownloadQueueTable from "~/components/tables/podcast/DownloadQueueTable.vue";

export default {
  components: {DownloadQueueTable},
  data() {
    return {
      episodesDownloading: [],
      episodeDownloadsQueued: [],
      processing: false,
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    episodeDownloadQueued(episodeDownload) {
      if (episodeDownload.libraryId === this.currentLibraryId) {
        this.episodeDownloadsQueued.push(episodeDownload)
      }
    },
    episodeDownloadStarted(episodeDownload) {
      if (episodeDownload.libraryId === this.currentLibraryId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading.push(episodeDownload)
      }
    },
    episodeDownloadFinished(episodeDownload) {
      if (episodeDownload.libraryId === this.currentLibraryId) {
        this.episodeDownloadsQueued = this.episodeDownloadsQueued.filter((d) => d.id !== episodeDownload.id)
        this.episodesDownloading = this.episodesDownloading.filter((d) => d.id !== episodeDownload.id)
      }
    },
    downloadQueueUpdated(downloadQueue) {
      this.episodeDownloadsQueued = downloadQueue.filter((q) => q.libraryId == this.currentLibraryId)
    },
    async loadInitialDownloadQueue() {
      this.processing = true
      const queuePayload = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/downloads`).catch((error) => {
        console.error('Failed to get download queue', error)
        this.$toast.error('Failed to get download queue')
        return null
      })
      this.processing = false
      console.log('Episodes', queuePayload)
      this.episodeDownloadsQueued = queuePayload || []
    }
  },
  mounted() {
    this.loadInitialDownloadQueue()
    this.$root.socket.on('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.on('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.on('episode_download_finished', this.episodeDownloadFinished)
    this.$root.socket.on('download_queue_updated', this.downloadQueueUpdated)
  },
  beforeDestroy() {
    this.$root.socket.off('episode_download_queued', this.episodeDownloadQueued)
    this.$root.socket.off('episode_download_started', this.episodeDownloadStarted)
    this.$root.socket.off('episode_download_finished', this.episodeDownloadFinished)
    this.$root.socket.off('download_queue_updated', this.downloadQueueUpdated)
  }
}
</script>
