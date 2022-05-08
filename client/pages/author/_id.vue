<template>
  <div id="page-wrapper" class="bg-bg page overflow-y-auto p-8" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="max-w-6xl mx-auto">
      <div class="flex mb-6">
        <div class="w-48 min-w-48">
          <div class="w-full h-52">
            <covers-author-image :author="author" rounded="0" />
          </div>
        </div>
        <div class="flex-grow px-8">
          <div class="flex items-center mb-8">
            <h1 class="text-2xl">{{ author.name }}</h1>

            <button class="w-8 h-8 rounded-full flex items-center justify-center mx-4 cursor-pointer text-gray-300 hover:text-warning transform hover:scale-125 duration-100" @click="editAuthor">
              <span class="material-icons text-base">edit</span>
            </button>
          </div>

          <p v-if="author.description" class="text-white text-opacity-60 uppercase text-xs mb-2">Description</p>
          <p class="text-white max-w-3xl text-sm leading-5">{{ author.description }}</p>
        </div>
      </div>

      <div class="py-4">
        <widgets-item-slider :items="libraryItems">
          <h2 class="text-lg">{{ libraryItems.length }} Books</h2>
        </widgets-item-slider>
      </div>

      <div v-for="series in authorSeries" :key="series.id" class="py-4">
        <widgets-item-slider :items="series.items">
          <h2 class="text-lg">{{ series.name }}</h2>
          <p class="text-white text-opacity-40 text-base px-2">Series</p>
        </widgets-item-slider>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, app, params, redirect }) {
    const author = await app.$axios.$get(`/api/authors/${params.id}?include=items,series`).catch((error) => {
      console.error('Failed to get author', error)
      return null
    })

    if (!author) {
      return redirect(`/library/${store.state.libraries.currentLibraryId}/authors`)
    }

    return {
      author
    }
  },
  data() {
    return {}
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    libraryItems() {
      return this.author.libraryItems || []
    },
    authorSeries() {
      return this.author.series || []
    }
  },
  methods: {
    editAuthor() {
      this.$store.commit('globals/showEditAuthorModal', this.author)
    },
    authorUpdated(author) {
      if (author.id === this.author.id) {
        console.log('Author was updated', author)
        this.author = {
          ...author,
          series: this.authorSeries,
          libraryItems: this.libraryItems
        }
      }
    },
    authorRemoved(author) {
      if (author.id === this.author.id) {
        console.warn('Author was removed')
        this.$router.replace(`/library/${this.currentLibraryId}/authors`)
      }
    }
  },
  mounted() {
    if (!this.author) this.$router.replace('/')

    this.$root.socket.on('author_updated', this.authorUpdated)
    this.$root.socket.on('author_removed', this.authorRemoved)
  },
  beforeDestroy() {
    this.$root.socket.off('author_updated', this.authorUpdated)
    this.$root.socket.off('author_removed', this.authorRemoved)
  }
}
</script>