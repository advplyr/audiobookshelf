<template>
  <div class="w-full h-full overflow-hidden px-4 py-6 relative">
    <template v-for="(authorName, index) in searchAuthors">
      <cards-search-author-card :key="index" :author-name="authorName" @match="setSelectedMatch" />
    </template>

    <div v-show="processing" class="flex h-full items-center justify-center">
      <p>Loading...</p>
    </div>
    <div v-if="selectedMatch" class="absolute top-0 left-0 w-full bg-bg h-full p-8 max-h-full overflow-y-auto overflow-x-hidden">
      <div class="flex mb-2">
        <div class="w-8 h-8 rounded-full hover:bg-white hover:bg-opacity-10 flex items-center justify-center cursor-pointer" @click="selectedMatch = null">
          <span class="material-icons text-3xl">arrow_back</span>
        </div>
        <p class="text-xl pl-3">Update Author Details</p>
      </div>
      <form @submit.prevent="submitMatchUpdate">
        <div v-if="selectedMatch.image" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.image" />
          <img :src="selectedMatch.image" class="w-24 object-contain ml-4" />
          <ui-text-input-with-label v-model="selectedMatch.image" :disabled="!selectedMatchUsage.image" label="Image" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.name" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.name" />
          <ui-text-input-with-label v-model="selectedMatch.name" :disabled="!selectedMatchUsage.name" label="Name" class="flex-grow ml-4" />
        </div>
        <div v-if="selectedMatch.description" class="flex items-center py-2">
          <ui-checkbox v-model="selectedMatchUsage.description" />
          <ui-textarea-with-label v-model="selectedMatch.description" :rows="3" :disabled="!selectedMatchUsage.description" label="Description" class="flex-grow ml-4" />
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
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      searchAuthors: [],
      audiobookId: null,
      searchAuthor: null,
      lastSearch: null,
      hasSearched: false,
      selectedMatch: null,

      selectedMatchUsage: {
        image: true,
        name: true,
        description: true
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
    }
  },
  methods: {
    // getSearchQuery() {
    //   return `q=${this.searchAuthor}`
    // },
    // submitSearch() {
    //   if (!this.searchTitle) {
    //     this.$toast.warning('Search title is required')
    //     return
    //   }
    //   this.runSearch()
    // },
    // async runSearch() {
    //   var searchQuery = this.getSearchQuery()
    //   if (this.lastSearch === searchQuery) return
    //   this.selectedMatch = null
    //   this.isProcessing = true
    //   this.lastSearch = searchQuery
    //   var result = await this.$axios.$get(`/api/authors/search?${searchQuery}`).catch((error) => {
    //     console.error('Failed', error)
    //     return []
    //   })
    //   if (result) {
    //     this.selectedMatch = result
    //   }
    //   this.isProcessing = false
    //   this.hasSearched = true
    // },
    init() {
      this.selectedMatch = null
      // this.selectedMatchUsage = {
      //   title: true,
      //   subtitle: true,
      //   cover: true,
      //   author: true,
      //   description: true,
      //   isbn: true,
      //   publisher: true,
      //   publishYear: true
      // }

      if (this.audiobook.id !== this.audiobookId) {
        this.selectedMatch = null
        this.hasSearched = false
        this.audiobookId = this.audiobook.id
      }

      if (!this.audiobook.book || !this.audiobook.book.authorFL) {
        this.searchAuthors = []
        return
      }
      this.searchAuthors = (this.audiobook.book.authorFL || '').split(', ')
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
        var success = await this.$axios.$post(`/api/items/${this.audiobook.id}/cover`, coverPayload).catch((error) => {
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
        var success = await this.$axios.$patch(`/api/items/${this.audiobook.id}`, bookUpdatePayload).catch((error) => {
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
    },
    setSelectedMatch(authorMatchObj) {
      this.selectedMatch = authorMatchObj
    }
  }
}
</script>

<style>
.matchListWrapper {
  height: calc(100% - 80px);
}
</style>