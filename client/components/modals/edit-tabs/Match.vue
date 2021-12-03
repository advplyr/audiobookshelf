<template>
  <div class="w-full h-full overflow-hidden px-4 py-6 relative">
    <form @submit.prevent="submitSearch">
      <div class="flex items-center justify-start -mx-1 h-20">
        <div class="w-40 px-1">
          <ui-dropdown v-model="provider" :items="providers" label="Provider" small />
        </div>
        <div class="w-72 px-1">
          <ui-text-input-with-label v-model="searchTitle" label="Search Title" placeholder="Search" />
        </div>
        <div class="w-72 px-1">
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
          <ui-text-input-with-label v-model="selectedMatch.title" :disabled="!selectedMatchUsage.title" label="Title" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.subtitle" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.subtitle" />
          <ui-text-input-with-label v-model="selectedMatch.subtitle" :disabled="!selectedMatchUsage.subtitle" label="Subtitle" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.author" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.author" />
          <ui-text-input-with-label v-model="selectedMatch.author" :disabled="!selectedMatchUsage.author" label="Author" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.narrator" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.narrator" />
          <ui-text-input-with-label v-model="selectedMatch.narrator" :disabled="!selectedMatchUsage.narrator" label="Narrator" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.description" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.description" />
          <ui-textarea-with-label v-model="selectedMatch.description" :rows="3" :disabled="!selectedMatchUsage.description" label="Description" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.publisher" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.publisher" />
          <ui-text-input-with-label v-model="selectedMatch.publisher" :disabled="!selectedMatchUsage.publisher" label="Publisher" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.publishYear" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.publishYear" />
          <ui-text-input-with-label v-model="selectedMatch.publishYear" :disabled="!selectedMatchUsage.publishYear" label="Publish Year" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.isbn" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.isbn" />
          <ui-text-input-with-label v-model="selectedMatch.isbn" :disabled="!selectedMatchUsage.isbn" label="ISBN" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.series" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.series" />
          <ui-text-input-with-label v-model="selectedMatch.series" :disabled="!selectedMatchUsage.series" label="Series" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.volumeNumber" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.volumeNumber" />
          <ui-text-input-with-label v-model="selectedMatch.volumeNumber" :disabled="!selectedMatchUsage.volumeNumber" label="Volume Number" class="flex-grow ml-4" />
        </div>
        <!-- <div v-if="selectedMatch.asin" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.asin" />
          <ui-text-input-with-label v-model="selectedMatch.asin" :disabled="!selectedMatchUsage.asin" label="ASIN" class="flex-grow ml-4" />
        </div> -->
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
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      audiobookId: null,
      searchTitle: null,
      searchAuthor: null,
      lastSearch: null,
      providers: [
        {
          text: 'Google Books',
          value: 'google'
        },
        {
          text: 'Open Library',
          value: 'openlibrary'
        },
        {
          text: 'Audible',
          value: 'audible'
        }
      ],
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
        isbn: true,
        publisher: true,
        publishYear: true,
        series: true,
        volumeNumber: true
      }
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
    },
    bookCoverAspectRatio() {
      return this.$store.getters['getBookCoverAspectRatio']
    }
  },
  methods: {
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
        isbn: true,
        publisher: true,
        publishYear: true,
        series: true,
        volumeNumber: true
      }

      if (this.audiobook.id !== this.audiobookId) {
        this.searchResults = []
        this.hasSearched = false
        this.audiobookId = this.audiobook.id
      }

      if (!this.audiobook.book || !this.audiobook.book.title) {
        this.searchTitle = null
        this.searchAuthor = null
        return
      }
      this.searchTitle = this.audiobook.book.title
      this.searchAuthor = this.audiobook.book.authorFL || ''
    },
    selectMatch(match) {
      this.selectedMatch = match
    },
    buildMatchUpdatePayload() {
      var updatePayload = {}
      for (const key in this.selectedMatchUsage) {
        if (this.selectedMatchUsage[key] && this.selectedMatch[key]) {
          updatePayload[key] = this.selectedMatch[key]
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
        var success = await this.$axios.$post(`/api/books/${this.audiobook.id}/cover`, coverPayload).catch((error) => {
          console.error('Failed to update', error)
          return false
        })
        if (success) {
          this.$toast.success('Book Cover Updated')
        } else {
          this.$toast.error('Book Cover Failed to Update')
        }
        console.log('Updated cover')
        delete updatePayload.cover
      }

      if (Object.keys(updatePayload).length) {
        var bookUpdatePayload = {
          book: updatePayload
        }
        var success = await this.$axios.$patch(`/api/books/${this.audiobook.id}`, bookUpdatePayload).catch((error) => {
          console.error('Failed to update', error)
          return false
        })
        if (success) {
          this.$toast.success('Book Details Updated')
          this.selectedMatch = null
          this.$emit('selectTab', 'details')
        } else {
          this.$toast.error('Book Details Failed to Update')
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