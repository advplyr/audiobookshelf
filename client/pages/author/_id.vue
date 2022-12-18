<template>
  <div id="page-wrapper" class="bg-bg page overflow-y-auto p-4 md:p-8" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-wrap sm:flex-nowrap justify-center mb-6">
        <div class="w-48 min-w-48">
          <div class="w-full h-52">
            <covers-author-image :author="author" rounded="0" />
          </div>
        </div>
        <div class="flex-grow py-4 sm:py-0 px-4 md:px-8">
          <div class="flex items-center mb-8">
            <h1 class="text-2xl">{{ author.name }}</h1>

            <button v-if="userCanUpdate" class="w-8 h-8 rounded-full flex items-center justify-center mx-4 cursor-pointer text-gray-300 hover:text-warning transform hover:scale-125 duration-100" @click="editAuthor">
              <span class="material-icons text-base">edit</span>
            </button>
          </div>

          <p v-if="author.description" class="text-white text-opacity-60 uppercase text-xs mb-2">{{ $strings.LabelDescription }}</p>
          <p class="text-white max-w-3xl text-sm leading-5">{{ author.description }}</p>
        </div>
      </div>

      <div class="py-4">
        <widgets-item-slider :items="libraryItems" shelf-id="author-books" :bookshelf-view="$constants.BookshelfView.AUTHOR">
          <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=authors.${$encode(author.id)}`" class="hover:underline">
            <h2 class="text-lg">{{ libraryItems.length }} {{ $strings.LabelBooks }}</h2>
          </nuxt-link>
        </widgets-item-slider>
      </div>

      <div v-for="series in authorSeries" :key="series.id" class="py-4">
        <widgets-item-slider :items="series.items" :shelf-id="series.id" :bookshelf-view="$constants.BookshelfView.AUTHOR">
          <nuxt-link :to="`/library/${currentLibraryId}/series/${series.id}`" class="hover:underline">
            <h2 class="text-lg">{{ series.name }}</h2>
          </nuxt-link>
          <p class="text-white text-opacity-40 text-base px-2">{{ $strings.LabelSeries }}</p>
        </widgets-item-slider>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, app, params, redirect }) {
    const author = await app.$axios.$get(`/api/authors/${params.id}?library=${store.state.libraries.currentLibraryId}&include=items,series`).catch((error) => {
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
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
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