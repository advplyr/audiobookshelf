<template>
  <div>
    <form @submit.prevent="submitSearch">
      <div class="flex items-center justify-start -mx-1 h-20">
        <!-- <div class="w-40 px-1">
          <ui-dropdown v-model="provider" :items="providers" label="Provider" small />
        </div> -->
        <div class="flex-grow px-1">
          <ui-text-input-with-label v-model="searchAuthor" label="Author" />
        </div>
        <ui-btn class="mt-5 ml-1" type="submit">Search</ui-btn>
      </div>
    </form>
  </div>
</template>

<script>
export default {
  props: {
    authorName: String
  },
  data() {
    return {
      searchAuthor: null,
      lastSearch: null,
      isProcessing: false,
      provider: 'audnexus',
      providers: [
        {
          text: 'Audnexus',
          value: 'audnexus'
        }
      ]
    }
  },
  watch: {
    authorName: {
      immediate: true,
      handler(newVal) {
        this.searchAuthor = newVal
      }
    }
  },
  computed: {},
  methods: {
    getSearchQuery() {
      return `q=${this.searchAuthor}`
    },
    submitSearch() {
      if (!this.searchAuthor) {
        this.$toast.warning('Author name is required')
        return
      }
      this.runSearch()
    },
    async runSearch() {
      var searchQuery = this.getSearchQuery()
      if (this.lastSearch === searchQuery) return
      this.isProcessing = true
      this.lastSearch = searchQuery
      var result = await this.$axios.$get(`/api/authors/search?${searchQuery}`).catch((error) => {
        console.error('Failed', error)
        return []
      })
      this.isProcessing = false
      if (result) {
        this.$emit('match', result)
      }
    }
  },
  mounted() {}
}
</script>