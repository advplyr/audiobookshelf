<template>
  <div class="w-80 ml-6 relative">
    <form @submit.prevent="submitSearch">
      <ui-text-input ref="input" v-model="search" placeholder="Search.." @input="inputUpdate" @focus="focussed" @blur="blurred" class="w-full h-8 text-sm" />
    </form>
    <div class="absolute top-0 right-0 bottom-0 h-full flex items-center px-2 text-gray-400 cursor-pointer" @click="clickClear">
      <span v-if="!search" class="material-icons" style="font-size: 1.2rem">search</span>
      <span v-else class="material-icons" style="font-size: 1.2rem">close</span>
    </div>
    <div v-show="showMenu && (lastSearch || isTyping)" class="absolute z-40 -mt-px w-full bg-bg border border-black-200 shadow-lg rounded-md py-1 px-2 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm globalSearchMenu">
      <ul class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
        <li v-if="isTyping" class="py-2 px-2">
          <p>Thinking...</p>
        </li>
        <li v-else-if="isFetching" class="py-2 px-2">
          <p>Fetching...</p>
        </li>
        <li v-else-if="!totalResults" class="py-2 px-2">
          <p>No Results</p>
        </li>
        <template v-else>
          <p v-if="bookResults.length" class="uppercase text-xs text-gray-400 my-1 px-1 font-semibold">Books</p>
          <template v-for="item in bookResults">
            <li :key="item.libraryItem.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option">
              <nuxt-link :to="`/item/${item.libraryItem.id}`">
                <cards-item-search-card :library-item="item.libraryItem" :match-key="item.matchKey" :match-text="item.matchText" :search="lastSearch" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="podcastResults.length" class="uppercase text-xs text-gray-400 my-1 px-1 font-semibold">Podcasts</p>
          <template v-for="item in podcastResults">
            <li :key="item.libraryItem.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option">
              <nuxt-link :to="`/item/${item.libraryItem.id}`">
                <cards-item-search-card :library-item="item.libraryItem" :match-key="item.matchKey" :match-text="item.matchText" :search="lastSearch" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="authorResults.length" class="uppercase text-xs text-gray-400 mb-1 mt-3 px-1 font-semibold">Authors</p>
          <template v-for="item in authorResults">
            <li :key="item.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option">
              <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=authors.${$encode(item.id)}`">
                <cards-author-search-card :author="item" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="seriesResults.length" class="uppercase text-xs text-gray-400 mb-1 mt-3 px-1 font-semibold">Series</p>
          <template v-for="item in seriesResults">
            <li :key="item.series.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option">
              <nuxt-link :to="`/library/${currentLibraryId}/series/${item.series.id}`">
                <cards-series-search-card :series="item.series" :book-items="item.books" />
              </nuxt-link>
            </li>
          </template>

          <p v-if="tagResults.length" class="uppercase text-xs text-gray-400 mb-1 mt-3 px-1 font-semibold">Tags</p>
          <template v-for="item in tagResults">
            <li :key="item.name" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option">
              <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=tags.${$encode(item.name)}`">
                <cards-tag-search-card :tag="item.name" />
              </nuxt-link>
            </li>
          </template>
        </template>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      showMenu: false,
      isFocused: false,
      focusTimeout: null,
      isTyping: false,
      isFetching: false,
      search: null,
      podcastResults: [],
      bookResults: [],
      authorResults: [],
      seriesResults: [],
      tagResults: [],
      searchTimeout: null,
      lastSearch: null
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    totalResults() {
      return this.bookResults.length + this.seriesResults.length + this.authorResults.length + this.tagResults.length + this.podcastResults.length
    }
  },
  methods: {
    submitSearch() {
      if (!this.search) return
      var search = this.search
      this.clearResults()
      this.$router.push(`/library/${this.currentLibraryId}/search?q=${search}`)
    },
    clearResults() {
      this.search = null
      this.lastSearch = null
      this.podcastResults = []
      this.bookResults = []
      this.authorResults = []
      this.seriesResults = []
      this.tagResults = []
      this.showMenu = false
      this.isFetching = false
      this.isTyping = false
      clearTimeout(this.searchTimeout)
      this.$nextTick(() => {
        if (this.$refs.input) {
          this.$refs.input.blur()
        }
      })
    },
    focussed() {
      this.isFocused = true
      this.showMenu = true
    },
    blurred() {
      this.isFocused = false
      clearTimeout(this.focusTimeout)
      this.focusTimeout = setTimeout(() => {
        this.showMenu = false
      }, 200)
    },
    async runSearch(value) {
      this.lastSearch = value
      if (!this.lastSearch) {
        return
      }
      this.isFetching = true

      var searchResults = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/search?q=${value}&limit=3`).catch((error) => {
        console.error('Search error', error)
        return []
      })

      // Search was canceled
      if (!this.isFetching) return

      this.podcastResults = searchResults.podcast || []
      this.bookResults = searchResults.book || []
      this.authorResults = searchResults.authors || []
      this.seriesResults = searchResults.series || []
      this.tagResults = searchResults.tags || []

      this.isFetching = false
      if (!this.showMenu) {
        return
      }
    },
    inputUpdate(val) {
      clearTimeout(this.searchTimeout)
      if (!val) {
        this.lastSearch = ''
        this.isTyping = false
        return
      }
      this.isTyping = true
      this.searchTimeout = setTimeout(() => {
        // Canceled search
        if (!this.isTyping) return

        this.isTyping = false
        this.runSearch(val)
      }, 750)
    },
    clickClear() {
      this.clearResults()
    }
  },
  mounted() {}
}
</script>

<style>
.globalSearchMenu {
  max-height: 80vh;
}
</style>