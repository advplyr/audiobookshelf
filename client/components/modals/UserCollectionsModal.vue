<template>
  <modals-modal v-model="show" name="collections" :processing="processing" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 class="text-2xl">Add to Collection</h1>
        </div>
        <div class="w-full overflow-y-auto overflow-x-hidden max-h-96">
          <transition-group name="list-complete" tag="div">
            <template v-for="collection in sortedCollections">
              <modals-collections-user-collection-item :key="collection.id" :collection="collection" class="list-complete-item" @add="addToCollection" @remove="removeFromCollection" />
            </template>
          </transition-group>
        </div>
        <div v-if="!collections.length" class="flex h-32 items-center justify-center">
          <p class="text-xl">No Collections</p>
        </div>
        <div class="w-full h-px bg-white bg-opacity-10" />
        <form @submit.prevent="submitCreateCollection">
          <div class="flex px-4 py-2 items-center text-center border-b border-white border-opacity-10 text-white text-opacity-80">
            <div class="flex-grow px-2">
              <ui-text-input v-model="newCollectionName" placeholder="New Collection" class="w-full" />
            </div>
            <ui-btn type="submit" color="success" :padding-x="4" class="h-10">Create</ui-btn>
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
        this.$store.commit('setSelectedAudiobook', null)
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
    selectedAudiobook() {
      return this.$store.state.selectedAudiobook
    },
    selectedAudiobookId() {
      return this.selectedAudiobook ? this.selectedAudiobook.id : null
    },
    collections() {
      return this.$store.state.user.collections || []
    },
    sortedCollections() {
      return this.collections
        .map((c) => {
          var includesBook = !!c.books.find((b) => b.id === this.selectedAudiobookId)
          return {
            isBookIncluded: includesBook,
            ...c
          }
        })
        .sort((a, b) => (a.isBookIncluded ? -1 : 1))
    }
  },
  methods: {
    loadCollections() {
      this.$store.dispatch('user/loadUserCollections')
    },
    removeFromCollection(collection) {
      if (!this.selectedAudiobookId) return

      this.processing = true

      this.$axios
        .$delete(`/api/collection/${collection.id}/book/${this.selectedAudiobookId}`)
        .then((updatedCollection) => {
          console.log(`Book removed from collection`, updatedCollection)
          this.$toast.success('Book removed from collection')
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed to remove book from collection', error)
          this.$toast.error('Failed to remove book from collection')
          this.processing = false
        })
    },
    addToCollection(collection) {
      if (!this.selectedAudiobookId) return

      this.processing = true

      this.$axios
        .$post(`/api/collection/${collection.id}/book`, { id: this.selectedAudiobookId })
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
    },
    submitCreateCollection() {
      if (!this.newCollectionName || !this.selectedAudiobook) {
        return
      }
      this.processing = true
      var newCollection = {
        books: [this.selectedAudiobook.id],
        libraryId: this.selectedAudiobook.libraryId,
        name: this.newCollectionName
      }
      this.$axios
        .$post('/api/collection', newCollection)
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
  /* display: block;
  margin-right: 10px; */
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