<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="authors" is-home :authors="authors" />
    <div id="bookshelf" class="w-full h-full p-8e overflow-y-auto" :style="{ fontSize: sizeMultiplier + 'rem' }">
      <div v-if="authorLayoutType === 'cards'">
        <!-- Cover size widget -->
        <widgets-cover-size-widget class="fixed right-4 z-50" :style="{ bottom: streamLibraryItem ? '181px' : '16px' }" />
        <div class="flex flex-wrap justify-center">
          <template v-for="author in authorsSorted">
            <cards-author-card :key="author.id" :author="author" class="p-3e" @edit="editAuthor" />
          </template>
        </div>
      </div>

      <div v-if="authorLayoutType === 'table'">
        <table class="tracksTable max-w-2xl mx-auto">
          <tr>
            <th class="text-left">{{ $strings.LabelName }}</th>
            <th class="text-center w-24">{{ $strings.LabelBooks }}</th>
          </tr>
          <tr v-for="author in authorsSorted" :key="author.id">
            <td>
              <nuxt-link :to="`/author/${author.id}`">
                <p class="text-sm md:text-base text-gray-100">{{ author.name }}</p>
              </nuxt-link>
            </td>
            <td class="text-center w-24 h-12">
              <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=authors.${$encode(author.id)}`" class="hover:underline">{{ author.numBooks }}</nuxt-link>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, redirect, query, app }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    const library = libraryData.library
    if (library.mediaType === 'podcast') {
      return redirect(`/library/${libraryId}`)
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
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    selectedAuthor() {
      return this.$store.state.globals.selectedAuthor
    },
    authorSortBy() {
      return this.$store.getters['user/getUserSetting']('authorSortBy') || 'name'
    },
    authorLayoutType() {
      return this.$store.getters['user/getUserSetting']('authorPageLayout') || 'cards'
    },
    authorSortDesc() {
      return !!this.$store.getters['user/getUserSetting']('authorSortDesc')
    },
    authorsSorted() {
      const sortProp = this.authorSortBy
      const bDesc = this.authorSortDesc ? -1 : 1
      return this.authors.sort((a, b) => {
        if (typeof a[sortProp] === 'number' && typeof b[sortProp] === 'number') {
          return a[sortProp] > b[sortProp] ? bDesc : -bDesc
        }
        return a[sortProp]?.localeCompare(b[sortProp], undefined, { sensitivity: 'base' }) * bDesc
      })
    }
  },
  methods: {
    async init() {
      this.authors = await this.$axios
        .$get(`/api/libraries/${this.currentLibraryId}/authors`)
        .then((response) => response.authors)
        .catch((error) => {
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
    },
    editAuthor(author) {
      this.$store.commit('globals/showEditAuthorModal', author)
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
