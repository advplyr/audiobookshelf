<template>
  <div id="match-wrapper" class="w-full h-full overflow-hidden px-2 md:px-4 py-4 md:py-6 relative">
    <form @submit.prevent="submitSearch">
      <div class="flex flex-wrap md:flex-nowrap items-center justify-start -mx-1">
        <div class="w-36 px-1">
          <ui-dropdown v-model="provider" :items="providers" label="Provider" small />
        </div>
        <div class="flex-grow md:w-72 px-1">
          <ui-text-input-with-label v-model="searchTitle" :label="searchTitleLabel" placeholder="Search" />
        </div>
        <div v-show="provider != 'itunes'" class="w-60 md:w-72 px-1">
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
    <div v-show="!processing" class="w-full max-h-full overflow-y-auto overflow-x-hidden matchListWrapper mt-4">
      <template v-for="(res, index) in searchResults">
        <cards-book-match-card :key="index" :book="res" :is-podcast="isPodcast" :book-cover-aspect-ratio="bookCoverAspectRatio" @select="selectMatch" />
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
            <widgets-series-input-widget v-model="selectedMatch.series" />
            <p v-if="mediaMetadata.seriesName" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.seriesName || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.volumeNumber" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.volumeNumber" />
          <ui-text-input-with-label v-model="selectedMatch.volumeNumber" :disabled="!selectedMatchUsage.volumeNumber" label="Volume Number" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.genres" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.genres" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.genres" :disabled="!selectedMatchUsage.genres" label="Genres" />
            <p v-if="mediaMetadata.genresList" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.genresList || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.tags" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.tags" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.tags" :disabled="!selectedMatchUsage.tags" label="Tags" />
            <p v-if="mediaMetadata.tagsList" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.tagsList || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.language" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.language" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.language" :disabled="!selectedMatchUsage.language" label="Language" />
            <p v-if="mediaMetadata.language" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.language || '' }}</p>
          </div>
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

        <div v-if="selectedMatch.itunesId" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.itunesId" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.itunesId" type="number" :disabled="!selectedMatchUsage.itunesId" label="iTunes ID" />
            <p v-if="mediaMetadata.itunesId" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.itunesId || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.feedUrl" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.feedUrl" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.feedUrl" :disabled="!selectedMatchUsage.feedUrl" label="RSS Feed URL" />
            <p v-if="mediaMetadata.feedUrl" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.feedUrl || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.itunesPageUrl" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.itunesPageUrl" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.itunesPageUrl" :disabled="!selectedMatchUsage.itunesPageUrl" label="iTunes Page URL" />
            <p v-if="mediaMetadata.itunesPageUrl" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.itunesPageUrl || '' }}</p>
          </div>
        </div>
        <div v-if="selectedMatch.releaseDate" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.releaseDate" />
          <div class="flex-grow ml-4">
            <ui-text-input-with-label v-model="selectedMatch.releaseDate" :disabled="!selectedMatchUsage.releaseDate" label="Release Date" />
            <p v-if="mediaMetadata.releaseDate" class="text-xs ml-1 text-white text-opacity-60">Currently: {{ mediaMetadata.releaseDate || '' }}</p>
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
        genres: true,
        tags: true,
        language: true,
        explicit: true,
        asin: true,
        isbn: true,
        // Podcast specific
        itunesPageUrl: true,
        itunesId: true,
        feedUrl: true,
        releaseDate: true
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
    seriesItems: {
      get() {
        return this.selectedMatch.series.map((se) => {
          return {
            id: `new-${Math.floor(Math.random() * 10000)}`,
            displayName: se.volumeNumber ? `${se.series} #${se.volumeNumber}` : se.series,
            name: se.series,
            sequence: se.volumeNumber || ''
          }
        })
      },
      set(val) {
        console.log('set series items', val)
        this.selectedMatch.series = val
      }
    },
    bookCoverAspectRatio() {
      return this.$store.getters['getBookCoverAspectRatio']
    },
    providers() {
      if (this.isPodcast) return this.$store.state.scanners.podcastProviders
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
    },
    mediaType() {
      return this.libraryItem ? this.libraryItem.mediaType : null
    },
    isPodcast() {
      return this.mediaType == 'podcast'
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
      if (this.isPodcast) return `term=${this.searchTitle}`
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
      var searchEntity = this.isPodcast ? 'podcast' : 'books'
      var results = await this.$axios.$get(`/api/search/${searchEntity}?${searchQuery}`, { timeout: 10000 }).catch((error) => {
        console.error('Failed', error)
        return []
      })
      // console.log('Got search results', results)
      results = (results || []).filter((res) => {
        return !!res.title
      })

      if (this.isPodcast) {
        // Map to match PodcastMetadata keys
        results = results.map((res) => {
          res.itunesPageUrl = res.pageUrl || null
          res.itunesId = res.id || null
          res.author = res.artistName || null
          return res
        })
      }

      this.searchResults = results || []
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
        genres: true,
        tags: true,
        language: true,
        explicit: true,
        asin: true,
        isbn: true,
        // Podcast specific
        itunesPageUrl: true,
        itunesId: true,
        feedUrl: true,
        releaseDate: true
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
      if (this.isPodcast) this.provider = 'itunes'
      else this.provider = localStorage.getItem('book-provider') || 'google'

      if (this.searchTitle) {
        this.submitSearch()
      }
    },
    selectMatch(match) {
      if (match) {
        if (match.series) {
          if (!match.series.length) {
            delete match.series
          } else {
            match.series = match.series.map((se) => {
              return {
                id: `new-${Math.floor(Math.random() * 10000)}`,
                displayName: se.volumeNumber ? `${se.series} #${se.volumeNumber}` : se.series,
                name: se.series,
                sequence: se.volumeNumber || ''
              }
            })
          }
        }
        if (match.genres && Array.isArray(match.genres)) {
          match.genres = match.genres.join(',')
        }
      }

      console.log('Select Match', match)
      this.selectedMatch = match
    },
    buildMatchUpdatePayload() {
      var updatePayload = {}
      updatePayload.metadata = {}

      var volumeNumber = this.selectedMatchUsage.volumeNumber ? this.selectedMatch.volumeNumber || null : null
      for (const key in this.selectedMatchUsage) {
        if (this.selectedMatchUsage[key] && this.selectedMatch[key]) {
          if (key === 'series') {
            var seriesPayload = []
            if (!Array.isArray(this.selectedMatch[key])) {
              seriesPayload.push({
                id: `new-${Math.floor(Math.random() * 10000)}`,
                name: this.selectedMatch[key],
                sequence: volumeNumber
              })
            } else {
              this.selectedMatch[key].forEach((seriesItem) =>
                seriesPayload.push({
                  id: seriesItem.id,
                  name: seriesItem.name,
                  sequence: seriesItem.sequence
                })
              )
            }

            updatePayload.metadata.series = seriesPayload
          } else if (key === 'author' && !this.isPodcast) {
            var authors = this.selectedMatch[key]
            if (!Array.isArray(authors)) {
              authors = authors.split(',').map((au) => au.trim())
            }
            var authorPayload = []
            authors.forEach((authorName) =>
              authorPayload.push({
                id: `new-${Math.floor(Math.random() * 10000)}`,
                name: authorName
              })
            )
            updatePayload.metadata.authors = authorPayload
          } else if (key === 'narrator') {
            updatePayload.metadata.narrators = this.selectedMatch[key].split(',').map((v) => v.trim())
          } else if (key === 'genres') {
            updatePayload.metadata.genres = this.selectedMatch[key].split(',').map((v) => v.trim())
          } else if (key === 'tags') {
            updatePayload.tags = this.selectedMatch[key].split(',').map((v) => v.trim())
          } else if (key === 'itunesId') {
            updatePayload.metadata.itunesId = Number(this.selectedMatch[key])
          } else {
            updatePayload.metadata[key] = this.selectedMatch[key]
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

      console.log('Match payload', updatePayload)
      this.isProcessing = true

      if (updatePayload.metadata.cover) {
        var coverPayload = {
          url: updatePayload.metadata.cover
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
        delete updatePayload.metadata.cover
      }

      if (Object.keys(updatePayload).length) {
        var mediaUpdatePayload = updatePayload
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
  height: calc(100% - 124px);
}
@media (min-width: 768px) {
  .matchListWrapper {
    height: calc(100% - 80px);
  }
}
</style>
