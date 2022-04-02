<template>
  <div class="w-full h-full overflow-hidden px-4 py-6 relative">
    <form @submit.prevent="submitSearch">
      <div class="flex items-center justify-start -mx-1 h-20">
        <div class="w-40 px-1">
          <ui-dropdown v-model="provider" :items="providers" label="Provider" small />
        </div>
        <div class="w-72 px-1">
          <ui-text-input-with-label v-model="searchTitle" :label="searchTitleLabel" placeholder="Search" />
        </div>
        <div v-show="provider != 'itunes'" class="w-72 px-1">
          <ui-text-input-with-label v-model="searchAuthor" label="Author" />
        </div>
        <ui-btn class="mt-5 ml-1" type="submit">Search</ui-btn>
      </div>
    </form>
    <div v-show="processing" class="flex h-full items-center justify-center">
      <p>Loading...</p>
    </div>
    <div v-show="!processing && !searchResults.length && hasSearched" class="flex h-full items-center justify-center">
      <p>No Results</p>
    </div>
    <div v-show="!processing" class="w-full max-h-full overflow-y-auto overflow-x-hidden matchListWrapper">
      <template v-for="(res, index) in searchResults">
        <cards-book-match-card :key="index" :book="res" :book-cover-aspect-ratio="bookCoverAspectRatio" @select="selectMatch" />
      </template>
    </div>
    <div v-if="selectedMatch" class="absolute top-0 left-0 w-full bg-bg h-full p-8 max-h-full overflow-y-auto overflow-x-hidden">
      <div class="flex mb-2">
        <div class="w-8 h-8 rounded-full hover:bg-white hover:bg-opacity-10 flex items-center justify-center cursor-pointer" @click="selectedMatch = null">
          <span class="material-icons text-3xl">arrow_back</span>
        </div>
        <p class="text-xl pl-3">Update Book Details</p>
      </div>
      <form @submit.prevent="submitMatchUpdate">
        <div v-if="selectedMatch.cover" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.cover" />
          <ui-text-input-with-label v-model="selectedMatch.cover" :disabled="!selectedMatchUsage.cover" label="Cover" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.title" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.title" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.title" :disabled="!selectedMatchUsage.title" label="Title" />
            <p v-if="mediaMetadata.title" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.title || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.subtitle" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.subtitle" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.subtitle" :disabled="!selectedMatchUsage.subtitle" label="Subtitle" />
            <p v-if="mediaMetadata.subtitle" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.subtitle || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.author" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.author" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.author" :disabled="!selectedMatchUsage.author" label="Author" />
            <p v-if="mediaMetadata.authorName" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.authorName || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.narrator" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.narrator" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.narrator" :disabled="!selectedMatchUsage.narrator" label="Narrator" />
            <p v-if="mediaMetadata.narratorName" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.narratorName || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.description" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.description" />
          <ui-textarea-with-label v-model="selectedMatch.description" :rows="3" :disabled="!selectedMatchUsage.description" label="Description" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.publisher" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.publisher" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.publisher" :disabled="!selectedMatchUsage.publisher" label="Publisher" />
            <p v-if="mediaMetadata.publisher" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.publisher || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.publishedYear" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.publishedYear" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.publishedYear" :disabled="!selectedMatchUsage.publishedYear" label="Published Year" />
            <p v-if="mediaMetadata.publishedYear" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.publishedYear || '' }}</p>
          </div>
        </div>

        <div v-if="selectedMatch.series" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.series" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.series" :disabled="!selectedMatchUsage.series" label="Series" />
            <p v-if="mediaMetadata.seriesName" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.seriesName || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.volumeNumber" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.volumeNumber" />
          <ui-text-input-with-label v-model="selectedMatch.volumeNumber" :disabled="!selectedMatchUsage.volumeNumber" label="Volume Number" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.isbn" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.isbn" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.isbn" :disabled="!selectedMatchUsage.isbn" label="ISBN" />
            <p v-if="mediaMetadata.isbn" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.isbn || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.asin" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.asin" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.asin" :disabled="!selectedMatchUsage.asin" label="ASIN" />
            <p v-if="mediaMetadata.asin" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.asin || '' }}</p>
          </div>
        </div>
        <div class="flex items-center justify-end py-2">
          <ui-btn color="success" type="submit">Update</ui-btn>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      libraryItemId: null,
      searchTitle: null,
      searchAuthor: null,
      lastSearch: null,
      provider: 'google',
      searchResults: [],
      hasSearched: false,
      selectedMatch: null,
      selectedMatchUsage: {
        title: true,
        subtitle: true,
        cover: true,
        author: true,
        narrator: true,
        description: true,
        publisher: true,
        publishedYear: true,
        series: true,
        volumeNumber: true,
        asin: true,
        isbn: true
      }
    }
  },
  watch: {
    libraryItem: {
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
    },
    bookCoverAspectRatio() {
      return this.$store.getters['getBookCoverAspectRatio']
    },
    providers() {
      return this.$store.state.scanners.providers
    },
    searchTitleLabel() {
      if (this.provider == 'audible') return 'Search Title or ASIN'
      else if (this.provider == 'itunes') return 'Search Term'
      return 'Search Title'
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    }
  },
  methods: {
    persistProvider() {
      try {
        localStorage.setItem('book-provider', this.provider)
      } catch (error) {
        console.error('PersistProvider', error)
      }
    },
    getSearchQuery() {
      var searchQuery = `provider=${this.provider}&fallbackTitleOnly=1&title=${this.searchTitle}`
      if (this.searchAuthor) searchQuery += `&author=${this.searchAuthor}`
      return searchQuery
    },
    submitSearch() {
      if (!this.searchTitle) {
        this.$toast.warning('Search title is required')
        return
      }
      this.persistProvider()
      this.runSearch()
    },
    async runSearch() {
      var searchQuery = this.getSearchQuery()
      if (this.lastSearch === searchQuery) return
      this.searchResults = []
      this.isProcessing = true
      this.lastSearch = searchQuery
      var results = await this.$axios.$get(`/api/search/books?${searchQuery}`).catch((error) => {
        console.error('Failed', error)
        return []
      })
      results = results.filter((res) => {
        return !!res.title
      })
      this.searchResults = results
      this.isProcessing = false
      this.hasSearched = true
    },
    init() {
      this.selectedMatch = null
      this.selectedMatchUsage = {
        title: true,
        subtitle: true,
        cover: true,
        author: true,
        narrator: true,
        description: true,
        publisher: true,
        publishedYear: true,
        series: true,
        volumeNumber: true,
        asin: true,
        isbn: true
      }

      if (this.libraryItem.id !== this.libraryItemId) {
        this.searchResults = []
        this.hasSearched = false
        this.libraryItemId = this.libraryItem.id
      }

      if (!this.libraryItem.media || !this.libraryItem.media.metadata.title) {
        this.searchTitle = null
        this.searchAuthor = null
        return
      }
      this.searchTitle = this.libraryItem.media.metadata.title
      this.searchAuthor = this.libraryItem.media.metadata.authorName || ''
      this.provider = localStorage.getItem('book-provider') || 'google'
    },
    selectMatch(match) {
      this.selectedMatch = match
    },
    buildMatchUpdatePayload() {
      var updatePayload = {}

      var volumeNumber = this.selectedMatchUsage.volumeNumber ? this.selectedMatch.volumeNumber || null : null
      for (const key in this.selectedMatchUsage) {
        if (this.selectedMatchUsage[key] && this.selectedMatch[key]) {
          if (key === 'series') {
            var seriesItem = {
              id: `new-${Math.floor(Math.random() * 10000)}`,
              name: this.selectedMatch[key],
              sequence: volumeNumber
            }
            updatePayload.series = [seriesItem]
          } else if (key === 'author') {
            var authorItem = {
              id: `new-${Math.floor(Math.random() * 10000)}`,
              name: this.selectedMatch[key]
            }
            updatePayload.authors = [authorItem]
          } else if (key === 'narrator') {
            updatePayload.narrators = [this.selectedMatch[key]]
          } else if (key !== 'volumeNumber') {
            updatePayload[key] = this.selectedMatch[key]
          }
        }
      }
      return updatePayload
    },
    async submitMatchUpdate() {
      var updatePayload = this.buildMatchUpdatePayload()
      if (!Object.keys(updatePayload).length) {
        return
      }
      this.isProcessing = true

      if (updatePayload.cover) {
        var coverPayload = {
          url: updatePayload.cover
        }
        var success = await this.$axios.$post(`/api/items/${this.libraryItemId}/cover`, coverPayload).catch((error) => {
          console.error('Failed to update', error)
          return false
        })
        if (success) {
          this.$toast.success('Item Cover Updated')
        } else {
          this.$toast.error('Item Cover Failed to Update')
        }
        console.log('Updated cover')
        delete updatePayload.cover
      }

      if (Object.keys(updatePayload).length) {
        var mediaUpdatePayload = {
          metadata: updatePayload
        }
        var updateResult = await this.$axios.$patch(`/api/items/${this.libraryItemId}/media`, mediaUpdatePayload).catch((error) => {
          console.error('Failed to update', error)
          return false
        })
        if (updateResult) {
          if (updateResult.updated) {
            this.$toast.success('Item details updated')
          } else {
            this.$toast.info('No detail updates were necessary')
          }
          this.selectedMatch = null
          this.$emit('selectTab', 'details')
        } else {
          this.$toast.error('Item Details Failed to Update')
        }
      } else {
        this.selectedMatch = null
      }
      this.isProcessing = false
    }
  }
}
</script>

<style>
.matchListWrapper {
  height: calc(100% - 80px);
}
</style>
