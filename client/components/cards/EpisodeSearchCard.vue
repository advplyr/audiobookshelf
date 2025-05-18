<template>
  <div class="flex items-center h-full px-1 overflow-hidden">
    <covers-book-cover :library-item="libraryItem" :width="coverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    <div class="grow px-2 episodeSearchCardContent">
      <p class="truncate text-sm">{{ episodeTitle }}</p>
      <p class="text-xs text-gray-200 truncate">{{ podcastTitle }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    },
    episode: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {}
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    coverWidth() {
      if (this.bookCoverAspectRatio === 1) return 50 * 1.2
      return 50
    },
    media() {
      return this.libraryItem?.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    episodeTitle() {
      return this.episode.title || 'No Title'
    },
    podcastTitle() {
      return this.mediaMetadata.title || 'No Title'
    }
  },
  methods: {},
  mounted() {}
}
</script>

<style>
.episodeSearchCardContent {
  width: calc(100% - 80px);
  height: 75px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
