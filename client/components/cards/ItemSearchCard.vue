<template>
  <div class="flex items-center h-full px-1 overflow-hidden">
    <covers-book-cover :library-item="libraryItem" :width="coverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    <div class="flex-grow px-2 audiobookSearchCardContent">
      <p v-if="matchKey !== 'title'" class="truncate text-sm">{{ title }}</p>
      <p v-else class="truncate text-sm" v-html="matchHtml" />

      <p v-if="matchKey === 'subtitle'" class="truncate text-xs text-gray-300" v-html="matchHtml" />

      <p v-if="matchKey !== 'authors'" class="text-xs text-gray-200 truncate">{{ $getString('LabelByAuthor', [authorName]) }}</p>
      <p v-else class="truncate text-xs text-gray-200" v-html="matchHtml" />

      <div v-if="matchKey === 'series' || matchKey === 'tags' || matchKey === 'isbn' || matchKey === 'asin' || matchKey === 'episode' || matchKey === 'narrators'" class="m-0 p-0 truncate text-xs" v-html="matchHtml" />
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
    search: String,
    matchKey: String,
    matchText: String
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
    },
    matchHtml() {
      if (!this.matchText || !this.search) return ''

      // This used to highlight the part of the search found
      //        but with removing commas periods etc this is no longer plausible
      const html = this.matchText

      if (this.matchKey === 'episode') return `<p class="truncate">${this.$strings.LabelEpisode}: ${html}</p>`
      if (this.matchKey === 'tags') return `<p class="truncate">${this.$strings.LabelTags}: ${html}</p>`
      if (this.matchKey === 'subtitle') return `<p class="truncate">${html}</p>`
      if (this.matchKey === 'authors') this.$getString('LabelByAuthor', [html])
      if (this.matchKey === 'isbn') return `<p class="truncate">ISBN: ${html}</p>`
      if (this.matchKey === 'asin') return `<p class="truncate">ASIN: ${html}</p>`
      if (this.matchKey === 'series') return `<p class="truncate">${this.$strings.LabelSeries}: ${html}</p>`
      if (this.matchKey === 'narrators') return `<p class="truncate">${this.$strings.LabelNarrator}: ${html}</p>`
      return `${html}`
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
