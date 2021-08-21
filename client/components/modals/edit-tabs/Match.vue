<template>
  <div class="w-full h-full overflow-hidden">
    <form @submit.prevent="submitSearch">
      <div class="flex items-center justify-start -mx-1 h-20">
        <div class="w-72 px-1">
          <ui-text-input-with-label v-model="searchTitle" label="Search Title" placeholder="Search" :disabled="processing" />
        </div>
        <div class="w-72 px-1">
          <ui-text-input-with-label v-model="searchAuthor" label="Author" :disabled="processing" />
        </div>
        <ui-btn class="mt-5 ml-1" type="submit">Search</ui-btn>
        <div class="flex-grow" />
      </div>
    </form>
    <div v-show="processing" class="flex h-full items-center justify-center">
      <p>Loading...</p>
    </div>
    <div v-show="!processing && !searchResults.length" class="flex h-full items-center justify-center">
      <p>No Results</p>
    </div>
    <div v-show="!processing" class="w-full max-h-full overflow-y-auto overflow-x-hidden matchListWrapper">
      <template v-for="(res, index) in searchResults">
        <cards-book-match-card :key="index" :book="res" @select="selectMatch" />
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      searchTitle: null,
      searchAuthor: null,
      lastSearch: null,
      provider: 'best',
      searchResults: []
    }
  },
  watch: {
    audiobook: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    }
  },
  computed: {
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    }
  },
  methods: {
    getSearchQuery() {
      var searchQuery = `provider=${this.provider}&title=${this.searchTitle}`
      if (this.searchAuthor) searchQuery += `&author=${this.searchAuthor}`
      return searchQuery
    },
    submitSearch() {
      if (!this.searchTitle) {
        this.$toast.warning('Search title is required')
        return
      }
      this.runSearch()
    },
    async runSearch() {
      var searchQuery = this.getSearchQuery()
      if (this.lastSearch === searchQuery) return
      this.searchResults = []
      this.isProcessing = true
      this.lastSearch = searchQuery
      var results = await this.$axios.$get(`/api/find/search?${searchQuery}`).catch((error) => {
        console.error('Failed', error)
        return []
      })
      results = results.filter((res) => {
        return !!res.title
      })
      this.searchResults = results
      this.isProcessing = false
    },
    init() {
      if (!this.audiobook.book || !this.audiobook.book.title) {
        this.searchTitle = null
        return
      }
      this.searchTitle = this.audiobook.book.title
      this.searchAuthor = this.audiobook.book.author || ''
      this.runSearch()
    },
    async selectMatch(match) {
      this.isProcessing = true
      const updatePayload = {
        book: {}
      }
      if (match.cover) {
        updatePayload.book.cover = match.cover
      }
      if (match.title) {
        updatePayload.book.title = match.title
      }
      if (match.description) {
        updatePayload.book.description = match.description
      }
      var updatedAudiobook = await this.$axios.$patch(`/api/audiobook/${this.audiobook.id}`, updatePayload).catch((error) => {
        console.error('Failed to update', error)
        return false
      })
      this.isProcessing = false
      if (updatedAudiobook) {
        console.log('Update Successful', updatedAudiobook)
        this.$toast.success('Update Successful')
        this.$emit('close')
      }
    }
  }
}
</script>

<style>
.matchListWrapper {
  height: calc(100% - 80px);
}
</style>