<template>
  <div class="w-full h-full overflow-hidden">
    <div class="flex items-center mb-4">
      <div class="w-72">
        <form @submit.prevent="submitSearch">
          <ui-text-input-with-label v-model="search" label="Search Title" placeholder="Search" :disabled="processing" />
        </form>
      </div>
      <div class="flex-grow" />
    </div>
    <div v-show="processing" class="flex h-full items-center justify-center">
      <p>Loading...</p>
    </div>
    <div v-show="!processing && !searchResults.length" class="flex h-full items-center justify-center">
      <p>No Results</p>
    </div>
    <div v-show="!processing" class="w-full max-h-full overflow-y-auto overflow-x-hidden">
      <template v-for="(res, index) in searchResults">
        <div :key="index" class="w-full border-b border-gray-700 pb-2 hover:bg-gray-300 hover:bg-opacity-10 cursor-pointer" @click="selectMatch(res)">
          <div class="flex py-1">
            <img :src="res.cover || '/book_placeholder.jpg'" class="h-24 object-cover" style="width: 60px" />
            <div class="px-4 flex-grow">
              <div class="flex items-center">
                <h1>{{ res.title }}</h1>
                <div class="flex-grow" />
                <p>{{ res.first_publish_year || res.first_publish_date }}</p>
              </div>
              <p class="text-gray-400">{{ res.author }}</p>
              <div class="w-full max-h-12 overflow-hidden">
                <p class="text-gray-500 text-xs" v-html="res.description"></p>
              </div>
            </div>
          </div>
          <div v-if="res.covers && res.covers.length > 1" class="flex">
            <template v-for="cover in res.covers.slice(1)">
              <img :key="cover" :src="cover" class="h-20 w-12 object-cover mr-1" />
            </template>
          </div>
        </div>
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
      search: null,
      lastSearch: null,
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
    submitSearch() {
      this.runSearch()
    },
    async runSearch() {
      if (this.lastSearch === this.search) return
      console.log('Search', this.lastSearch, this.search)

      this.searchResults = []
      this.isProcessing = true
      this.lastSearch = this.search
      var results = await this.$axios.$get(`/api/find/search?title=${this.search}`).catch((error) => {
        console.error('Failed', error)
        return []
      })
      results = results.filter((res) => {
        return !!res.title
      })
      console.log('Got results', results)
      this.searchResults = results
      this.isProcessing = false
    },
    init() {
      if (!this.audiobook.book || !this.audiobook.book.title) {
        this.search = null
        return
      }
      if (this.searchResults.length) {
        console.log('Already hav ereuslts', this.searchResults, this.lastSearch)
      }
      this.search = this.audiobook.book.title
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