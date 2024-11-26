<template>
  <modals-modal v-model="show" name="podcast-episode-view-modal" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.LabelEpisode }}</p>
      </div>
    </template>
    <div ref="wrapper" class="p-4 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-y-auto" style="max-height: 80vh">
      <div class="flex mb-4">
        <div class="w-12 h-12">
          <covers-book-cover :library-item="libraryItem" :width="48" :book-cover-aspect-ratio="bookCoverAspectRatio" />
        </div>
        <div class="flex-grow px-2">
          <p class="text-base mb-1">{{ podcastTitle }}</p>
          <p class="text-xs text-gray-300">{{ podcastAuthor }}</p>
        </div>
      </div>
      <p dir="auto" class="text-lg font-semibold mb-6">{{ title }}</p>
      <div v-if="description" dir="auto" class="default-style" v-html="description" />
      <p v-else class="mb-2">{{ $strings.MessageNoDescription }}</p>

      <div class="w-full h-px bg-white/5 my-4" />

      <div class="flex items-center">
        <div class="flex-grow">
          <p class="font-semibold text-xs mb-1">{{ $strings.LabelFilename }}</p>
          <p class="mb-2 text-xs">
            {{ audioFileFilename }}
          </p>
        </div>
        <div class="flex-grow">
          <p class="font-semibold text-xs mb-1">{{ $strings.LabelSize }}</p>
          <p class="mb-2 text-xs">
            {{ audioFileSize }}
          </p>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showViewPodcastEpisodeModal
      },
      set(val) {
        this.$store.commit('globals/setShowViewPodcastEpisodeModal', val)
      }
    },
    libraryItem() {
      return this.$store.state.selectedLibraryItem
    },
    episode() {
      return this.$store.state.globals.selectedEpisode || {}
    },
    episodeId() {
      return this.episode.id
    },
    title() {
      return this.episode.title || 'No Episode Title'
    },
    description() {
      return this.episode.description || ''
    },
    media() {
      return this.libraryItem?.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    podcastTitle() {
      return this.mediaMetadata.title
    },
    podcastAuthor() {
      return this.mediaMetadata.author
    },
    audioFileFilename() {
      return this.episode.audioFile?.metadata?.filename || ''
    },
    audioFileSize() {
      const size = this.episode.audioFile?.metadata?.size || 0

      return this.$bytesPretty(size)
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    }
  },
  methods: {},
  mounted() {}
}
</script>
