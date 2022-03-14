<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex h-full">
      <app-side-rail class="hidden md:block" />
      <div class="flex-grow">
        <app-book-shelf-toolbar is-home />
        <div id="bookshelf" class="w-full h-full p-8 overflow-y-auto">
          <div class="flex flex-wrap justify-center">
            <template v-for="author in authors">
              <nuxt-link :key="author.id" :to="`/library/${currentLibraryId}/bookshelf?filter=authors.${$encode(author.id)}`">
                <cards-author-card :author="author" :width="160" :height="200" class="p-3" />
              </nuxt-link>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    var libraryId = params.library
    var library = await store.dispatch('libraries/fetch', libraryId)
    if (!library) {
      return redirect('/oops?message=Library not found')
    }

    return {
      libraryId
    }
  },
  data() {
    return {
      loading: true,
      authors: []
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    async init() {
      this.authors = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/authors`).catch((error) => {
        console.error('Failed to load authors', error)
        return []
      })
      this.loading = false
    },
    authorAdded(author) {
      if (!this.authors.some((au) => au.id === author.id)) {
        this.authors.push(author)
      }
    },
    authorUpdated(author) {
      this.authors = this.authors.map((au) => {
        if (au.id === author.id) {
          return author
        }
        return au
      })
    },
    authorRemoved(author) {
      this.authors = this.authors.filter((au) => au.id !== author.id)
    }
  },
  mounted() {
    this.init()
    this.$root.socket.on('author_added', this.authorAdded)
    this.$root.socket.on('author_updated', this.authorUpdated)
    this.$root.socket.on('author_removed', this.authorRemoved)
  },
  beforeDestroy() {
    this.$root.socket.off('author_added', this.authorAdded)
    this.$root.socket.off('author_updated', this.authorUpdated)
    this.$root.socket.off('author_removed', this.authorRemoved)
  }
}
</script>