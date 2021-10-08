<template>
  <div class="w-64 ml-8 relative">
    <form @submit.prevent="submitSearch">
      <ui-text-input ref="input" v-model="search" placeholder="Search.." @input="inputUpdate" @focus="focussed" @blur="blurred" class="w-full h-8 text-sm" />
    </form>
    <div class="absolute top-0 right-0 bottom-0 h-full flex items-center px-2 text-gray-400 cursor-pointer" @click="clickClear">
      <span v-if="!search" class="material-icons" style="font-size: 1.2rem">search</span>
      <span v-else class="material-icons" style="font-size: 1.2rem">close</span>
    </div>
    <div v-show="showMenu && (lastSearch || isTyping)" class="absolute z-40 -mt-px w-full bg-bg border border-black-200 shadow-lg max-h-80 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
      <ul class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
        <li v-if="isTyping" class="py-2 px-2">
          <p>Typing...</p>
        </li>
        <li v-else-if="isFetching" class="py-2 px-2">
          <p>Fetching...</p>
        </li>
        <li v-else-if="!items.length" class="py-2 px-2">
          <p>No Results</p>
        </li>
        <template v-else>
          <template v-for="item in items">
            <li :key="item.id" class="text-gray-50 select-none relative cursor-pointer hover:bg-black-400 py-1" role="option" @click="clickedOption(item)">
              <template v-if="item.type === 'audiobook'">
                <cards-audiobook-search-card :audiobook="item.data" />
              </template>
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
      items: [],
      searchTimeout: null,
      lastSearch: null
    }
  },
  computed: {
    audiobooks() {
      return this.$store.state.audiobooks.audiobooks
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    submitSearch() {
      if (!this.search) return
      this.$router.push(`/library/${this.currentLibraryId}/bookshelf/search?query=${this.search}`)

      this.search = null
      this.items = []
      this.showMenu = false
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
      var results = await this.$axios.$get(`/api/audiobooks?q=${value}`).catch((error) => {
        console.error('Search error', error)
        return []
      })
      this.isFetching = false
      if (!this.showMenu) {
        return
      }

      this.items = results.map((res) => {
        return {
          id: res.id,
          data: res,
          type: 'audiobook'
        }
      })
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
        this.isTyping = false
        this.runSearch(val)
      }, 1000)
    },
    clickedOption(option) {
      if (option.type === 'audiobook') {
        this.$router.push(`/audiobook/${option.data.id}`)
      }
    },
    clickClear() {
      if (this.search) {
        this.search = null
        this.items = []
        this.showMenu = false
      }
    }
  },
  mounted() {}
}
</script>