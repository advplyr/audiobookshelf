<template>
  <modals-modal v-model="show" name="collections" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 v-if="!showBatchUserCollectionModal" class="text-2xl">{{ $strings.LabelAddToCollection }}</h1>
          <h1 v-else class="text-2xl">{{ $getString('LabelAddToCollectionBatch', [selectedBookIds.length]) }}</h1>
        </div>
        <div class="w-full overflow-y-auto overflow-x-hidden max-h-96">
          <transition-group name="list-complete" tag="div">
            <template v-for="collection in sortedCollections">
              <modals-collections-user-collection-item :key="collection.id" :collection="collection" :book-cover-aspect-ratio="bookCoverAspectRatio" class="list-complete-item" @add="addToCollection" @remove="removeFromCollection" @close="show = false" />
            </template>
          </transition-group>
        </div>
        <div v-if="!collections.length" class="flex h-32 items-center justify-center">
          <p class="text-xl">{{ $strings.MessageNoCollections }}</p>
        </div>
        <div class="w-full h-px bg-white bg-opacity-10" />
        <form @submit.prevent="submitCreateCollection">
          <div class="flex px-4 py-2 items-center text-center border-b border-white border-opacity-10 text-white text-opacity-80">
            <div class="flex-grow px-2">
              <ui-text-input v-model="newCollectionName" :placeholder="$strings.PlaceholderNewCollection" class="w-full" />
            </div>
            <ui-btn type="submit" color="success" :padding-x="4" class="h-10">{{ $strings.ButtonCreate }}</ui-btn>
          </div>
        </form>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      newCollectionName: '',
      processing: false
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.loadCollections()
        this.newCollectionName = ''
      } else {
        this.$store.commit('setSelectedLibraryItem', null)
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showUserCollectionsModal
      },
      set(val) {
        this.$store.commit('globals/setShowUserCollectionsModal', val)
      }
    },
    title() {
      if (this.showBatchUserCollectionModal) {
        return this.$getString('MessageItemsSelected', [this.selectedBookIds.length])
      }
      return this.selectedLibraryItem ? this.selectedLibraryItem.media.metadata.title : ''
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    selectedLibraryItem() {
      return this.$store.state.selectedLibraryItem
    },
    selectedLibraryItemId() {
      return this.selectedLibraryItem ? this.selectedLibraryItem.id : null
    },
    collections() {
      return this.$store.state.user.collections || []
    },
    sortedCollections() {
      return this.collections
        .map((c) => {
          var includesBook = false
          if (this.showBatchUserCollectionModal) {
            // Only show collection added if all books are in the collection
            var collectionBookIds = c.books.map((b) => b.id)
            includesBook = !this.selectedBookIds.find((id) => !collectionBookIds.includes(id))
          } else {
            includesBook = !!c.books.find((b) => b.id === this.selectedLibraryItemId)
          }

          return {
            isBookIncluded: includesBook,
            ...c
          }
        })
        .sort((a, b) => (a.isBookIncluded ? -1 : 1))
    },
    showBatchUserCollectionModal() {
      return this.$store.state.globals.showBatchUserCollectionModal
    },
    selectedBookIds() {
      return this.$store.state.selectedLibraryItems || []
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    loadCollections() {
      this.$store.dispatch('user/loadUserCollections')
    },
    removeFromCollection(collection) {
      if (!this.selectedLibraryItemId && !this.selectedBookIds.length) return
      this.processing = true

      if (this.showBatchUserCollectionModal) {
        // BATCH Remove books
        this.$axios
          .$post(`/api/collections/${collection.id}/batch/remove`, { books: this.selectedBookIds })
          .then((updatedCollection) => {
            console.log(`Books removed from collection`, updatedCollection)
            this.$toast.success(this.$strings.ToastCollectionItemsRemoveSuccess)
            this.processing = false
          })
          .catch((error) => {
            console.error('Failed to remove books from collection', error)
            this.$toast.error(this.$strings.ToastCollectionItemsRemoveFailed)
            this.processing = false
          })
      } else {
        // Remove single book
        this.$axios
          .$delete(`/api/collections/${collection.id}/book/${this.selectedLibraryItemId}`)
          .then((updatedCollection) => {
            console.log(`Book removed from collection`, updatedCollection)
            this.$toast.success(this.$strings.ToastCollectionItemsRemoveSuccess)
            this.processing = false
          })
          .catch((error) => {
            console.error('Failed to remove book from collection', error)
            this.$toast.error(this.$strings.ToastCollectionItemsRemoveFailed)
            this.processing = false
          })
      }
    },
    addToCollection(collection) {
      if (!this.selectedLibraryItemId && !this.selectedBookIds.length) return
      this.processing = true

      if (this.showBatchUserCollectionModal) {
        // BATCH Remove books
        this.$axios
          .$post(`/api/collections/${collection.id}/batch/add`, { books: this.selectedBookIds })
          .then((updatedCollection) => {
            console.log(`Books added to collection`, updatedCollection)
            this.$toast.success('Books added to collection')
            this.processing = false
          })
          .catch((error) => {
            console.error('Failed to add books to collection', error)
            this.$toast.error('Failed to add books to collection')
            this.processing = false
          })
      } else {
        if (!this.selectedLibraryItemId) return

        this.$axios
          .$post(`/api/collections/${collection.id}/book`, { id: this.selectedLibraryItemId })
          .then((updatedCollection) => {
            console.log(`Book added to collection`, updatedCollection)
            this.$toast.success('Book added to collection')
            this.processing = false
          })
          .catch((error) => {
            console.error('Failed to add book to collection', error)
            this.$toast.error('Failed to add book to collection')
            this.processing = false
          })
      }
    },
    submitCreateCollection() {
      if (!this.newCollectionName || (!this.selectedLibraryItemId && !this.selectedBookIds.length)) {
        return
      }
      this.processing = true

      var books = this.showBatchUserCollectionModal ? this.selectedBookIds : [this.selectedLibraryItemId]
      var newCollection = {
        books: books,
        libraryId: this.currentLibraryId,
        name: this.newCollectionName
      }

      this.$axios
        .$post('/api/collections', newCollection)
        .then((data) => {
          console.log('New Collection Created', data)
          this.$toast.success(`Collection "${data.name}" created`)
          this.processing = false
          this.newCollectionName = ''
        })
        .catch((error) => {
          console.error('Failed to create collection', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(`Failed to create collection: ${errMsg}`)
          this.processing = false
        })
    }
  },
  mounted() {}
}
</script>

<style>
.list-complete-item {
  transition: all 0.8s ease;
}

.list-complete-enter-from,
.list-complete-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.list-complete-leave-active {
  position: absolute;
}
</style>