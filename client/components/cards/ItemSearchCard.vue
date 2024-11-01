<template>
  <div class="flex items-center h-full px-1 overflow-hidden">
    <covers-book-cover :library-item="libraryItem" :width="coverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    <div class="flex-grow px-2 audiobookSearchCardContent">
      <p class="truncate text-sm">{{ title }}</p>
      <p v-if="subtitle" class="truncate text-xs text-gray-300">{{ subtitle }}</p>
      <p class="text-xs text-gray-200 truncate">{{ $getString('LabelByAuthor', [authorName]) }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
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
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaType() {
      return this.libraryItem ? this.libraryItem.mediaType : null
    },
    isPodcast() {
      return this.mediaType == 'podcast'
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    title() {
      return this.mediaMetadata.title || 'No Title'
    },
    subtitle() {
      return this.mediaMetadata.subtitle || ''
    },
    authorName() {
      if (this.isPodcast) return this.mediaMetadata.author || 'Unknown'
      return this.mediaMetadata.authorName || 'Unknown'
    }
  },
  methods: {},
  mounted() {}
}
</script>

<style>
.audiobookSearchCardContent {
  width: calc(100% - 80px);
  height: 75px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
