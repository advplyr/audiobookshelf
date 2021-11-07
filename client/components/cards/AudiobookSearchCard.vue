<template>
  <div class="flex h-full px-1 overflow-hidden">
    <covers-book-cover :audiobook="audiobook" :width="50" />
    <div class="flex-grow px-2 audiobookSearchCardContent">
      <p v-if="matchKey !== 'title'" class="truncate text-sm">{{ title }}</p>
      <p v-else class="truncate text-sm" v-html="matchHtml" />

      <p v-if="matchKey === 'subtitle'" class="truncate text-xs text-gray-300">{{ matchHtml }}</p>

      <p v-if="matchKey !== 'authorFL'" class="text-xs text-gray-200 truncate">by {{ authorFL }}</p>
      <p v-else class="truncate text-xs text-gray-200" v-html="matchHtml" />

      <div v-if="matchKey === 'series' || matchKey === 'tags'" class="m-0 p-0 truncate" v-html="matchHtml" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    audiobook: {
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
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    },
    title() {
      return this.book ? this.book.title : 'No Title'
    },
    subtitle() {
      return this.book ? this.book.subtitle : ''
    },
    authorFL() {
      return this.book ? this.book.authorFL : 'Unknown'
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
      if (this.matchKey === 'authorFL') return `by ${html}`
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