<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full h-full overflow-y-auto px-2 py-6 md:p-8">
      <div class="flex flex-col sm:flex-row max-w-6xl mx-auto">
        <div class="w-full flex justify-center md:block sm:w-32 md:w-52" style="min-width: 240px">
          <div class="relative" style="height: fit-content">
            <covers-collection-cover :book-items="bookItems" :width="240" :height="120 * bookCoverAspectRatio" :book-cover-aspect-ratio="bookCoverAspectRatio" />
          </div>
        </div>
        <div class="flex-grow px-2 py-6 md:py-0 md:px-10">
          <div class="flex sm:items-end flex-col sm:flex-row">
            <h1 class="text-2xl md:text-3xl font-sans">
              {{ collectionName }}
            </h1>
            <div class="flex-grow" />

            <ui-btn v-if="showPlayButton" :disabled="streaming" color="success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="clickPlay">
              <span v-show="!streaming" class="material-icons -ml-2 pr-1 text-white">play_arrow</span>
              {{ streaming ? 'Streaming' : 'Play' }}
            </ui-btn>

            <ui-icon-btn icon="edit" class="mx-0.5" @click="editClick" />

            <ui-icon-btn icon="delete" class="mx-0.5" @click="removeClick" />
          </div>

          <div class="my-8 max-w-2xl">
            <p class="text-base text-gray-100">{{ description }}</p>
          </div>

          <tables-collection-books-table :books="bookItems" :collection-id="collection.id" />
        </div>
      </div>
    </div>
    <div v-show="processingRemove" class="absolute top-0 left-0 w-full h-full z-10 bg-black bg-opacity-40 flex items-center justify-center">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
    var collection = await app.$axios.$get(`/api/collections/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!collection) {
      return redirect('/')
    }
    store.commit('user/addUpdateCollection', collection)
    return {
      collectionId: collection.id
    }
  },
  data() {
    return {
      processingRemove: false,
      collectionCopy: {}
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['getBookCoverAspectRatio']
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    bookItems() {
      return this.collection.books || []
    },
    collectionName() {
      return this.collection.name || ''
    },
    description() {
      return this.collection.description || ''
    },
    collection() {
      return this.$store.getters['user/getCollection'](this.collectionId)
    },
    playableBooks() {
      return this.bookItems.filter((book) => {
        return !book.isMissing && !book.isInvalid && book.numTracks
      })
    },
    streaming() {
      return !!this.playableBooks.find((b) => b.id === this.$store.getters['getLibraryItemIdStreaming'])
    },
    showPlayButton() {
      return this.playableBooks.length
    },
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    }
  },
  methods: {
    editClick() {
      this.$store.commit('globals/setEditCollection', this.collection)
    },
    removeClick() {
      if (confirm(`Are you sure you want to remove collection "${this.collectionName}"?`)) {
        this.processingRemove = true
        var collectionName = this.collectionName
        this.$axios
          .$delete(`/api/collections/${this.collection.id}`)
          .then(() => {
            this.processingRemove = false
            this.$toast.success(`Collection "${collectionName}" Removed`)
          })
          .catch((error) => {
            console.error('Failed to remove collection', error)
            this.processingRemove = false
            this.$toast.error(`Failed to remove collection`)
          })
      }
    },
    clickPlay() {
      var nextBookNotRead = this.playableBooks.find((pb) => !this.userAudiobooks[pb.id] || !this.userAudiobooks[pb.id].isRead)
      if (nextBookNotRead) {
        this.$eventBus.$emit('play-item', nextBookNotRead.id)
      }
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>