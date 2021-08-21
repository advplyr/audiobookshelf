<template>
  <div class="w-full h-full">
    <div class="flex">
      <cards-book-cover :audiobook="audiobook" />
      <div class="flex-grow pl-6 pr-2">
        <form @submit.prevent="submitForm">
          <div class="flex items-center">
            <ui-text-input-with-label v-model="imageUrl" label="Cover Image URL" />
            <ui-btn color="success" type="submit" :padding-x="4" class="mt-5 ml-3 w-24">Update</ui-btn>
          </div>
        </form>

        <form @submit.prevent="submitSearchForm">
          <div class="flex items-center justify-start -mx-1 py-2 mt-2">
            <div class="flex-grow px-1">
              <ui-text-input-with-label v-model="searchTitle" label="Search Title" placeholder="Search" :disabled="processing" />
            </div>
            <div class="flex-grow px-1">
              <ui-text-input-with-label v-model="searchAuthor" label="Author" :disabled="processing" />
            </div>
            <div class="w-24 px-1">
              <ui-btn type="submit" class="mt-5 w-full" :padding-x="0">Search</ui-btn>
            </div>
          </div>
        </form>
        <div v-if="hasSearched" class="flex items-center flex-wrap justify-center max-h-72 overflow-y-scroll mt-2 max-w-full">
          <p v-if="!coversFound.length">No Covers Found</p>
          <template v-for="cover in coversFound">
            <div :key="cover" class="m-0.5 border-2 border-transparent hover:border-yellow-300 cursor-pointer" :class="cover === imageUrl ? 'border-yellow-300' : ''" @click="setCover(cover)">
              <img :src="cover" class="h-24 object-cover" style="width: 60px" />
            </div>
          </template>
        </div>
      </div>
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
      imageUrl: null,
      coversFound: [],
      hasSearched: false
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
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    }
  },
  methods: {
    init() {
      if (this.coversFound.length && (this.searchTitle !== this.book.title || this.searchAuthor !== this.book.author)) {
        this.coversFound = []
        this.hasSearched = false
      }
      this.imageUrl = this.book.cover || ''
      this.searchTitle = this.book.title || ''
      this.searchAuthor = this.book.author || ''
    },
    submitForm() {
      this.updateCover(this.imageUrl)
    },
    async updateCover(cover) {
      this.isProcessing = true
      const updatePayload = {
        book: {
          cover: cover
        }
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
    },
    getSearchQuery() {
      var searchQuery = `provider=best&title=${this.searchTitle}`
      if (this.searchAuthor) searchQuery += `&author=${this.searchAuthor}`
      return searchQuery
    },
    async submitSearchForm() {
      this.isProcessing = true
      var searchQuery = this.getSearchQuery()
      var results = await this.$axios.$get(`/api/find/covers?${searchQuery}`).catch((error) => {
        console.error('Failed', error)
        return []
      })
      this.coversFound = results
      this.isProcessing = false
      this.hasSearched = true
    },
    setCover(cover) {
      this.updateCover(cover)
    }
  }
}
</script>