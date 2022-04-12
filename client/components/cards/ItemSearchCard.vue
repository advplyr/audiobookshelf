<template>
  <div class="flex items-center h-full px-1 overflow-hidden">
    <covers-book-cover :library-item="libraryItem" :width="coverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
    <div class="flex-grow px-2 audiobookSearchCardContent">
      <p v-if="matchKey !== 'title'" class="truncate text-sm">{{ title }}</p>
      <p v-else class="truncate text-sm" v-html="matchHtml" />

      <p v-if="matchKey === 'subtitle'" class="truncate text-xs text-gray-300">{{ matchHtml }}</p>

      <p v-if="matchKey !== 'authors'" class="text-xs text-gray-200 truncate">by {{ authorName }}</p>
      <p v-else class="truncate text-xs text-gray-200" v-html="matchHtml" />

      <div v-if="matchKey === 'series' || matchKey === 'tags' || matchKey === 'isbn' || matchKey === 'asin'" class="m-0 p-0 truncate text-xs" v-html="matchHtml" />
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
      return this.$store.getters['getBookCoverAspectRatio']
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
      if (this.matchKey === 'subtitle') return ''
      var matchSplit = this.matchText.toLowerCase().split(this.search.toLowerCase().trim())
      if (matchSplit.length < 2) return ''

      var html = ''
      var totalLenSoFar = 0
      for (let i = 0; i < matchSplit.length - 1; i++) {
        var indexOf = matchSplit[i].length
        var firstPart = this.matchText.substr(totalLenSoFar, indexOf)
        var actualWasThere = this.matchText.substr(totalLenSoFar + indexOf, this.search.length)
        totalLenSoFar += indexOf + this.search.length

        html += `${firstPart}<strong class="text-warning">${actualWasThere}</strong>`
      }
      var lastPart = this.matchText.substr(totalLenSoFar)
      html += lastPart

      if (this.matchKey === 'tags') return `<p class="truncate">Tags: ${html}</p>`
      if (this.matchKey === 'authors') return `by ${html}`
      if (this.matchKey === 'isbn') return `<p class="truncate">ISBN: ${html}</p>`
      if (this.matchKey === 'asin') return `<p class="truncate">ASIN: ${html}</p>`
      if (this.matchKey === 'series') return `<p class="truncate">Series: ${html}</p>`
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