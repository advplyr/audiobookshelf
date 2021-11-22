<template>
  <modals-modal v-model="show" name="edit-collection" :width="700" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">Collection</p>
      </div>
    </template>
    <div class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <template v-if="!showImageUploader">
        <form @submit.prevent="submitForm">
          <div class="flex">
            <div>
              <covers-collection-cover :book-items="books" :width="200" :height="100 * 1.6" />
              <!-- <ui-btn type="button" @click="showImageUploader = true">Upload</ui-btn> -->
            </div>
            <div class="flex-grow px-4">
              <ui-text-input-with-label v-model="newCollectionName" label="Name" class="mb-2" />

              <ui-textarea-with-label v-model="newCollectionDescription" label="Description" />
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 w-full py-2 px-4 flex">
            <ui-btn small color="error" type="button" @click.stop="removeClick">Remove</ui-btn>
            <div class="flex-grow" />
            <ui-btn color="success" type="submit">Save</ui-btn>
          </div>
        </form>
      </template>
      <template v-else>
        <div class="flex items-center mb-3">
          <div class="hover:bg-white hover:bg-opacity-10 cursor-pointer h-11 w-11 flex items-center justify-center rounded-full" @click="showImageUploader = false">
            <span class="material-icons text-4xl">arrow_back</span>
          </div>
          <p class="ml-2 text-xl mb-1">Collection Cover Image</p>
        </div>
        <div class="flex mb-4">
          <ui-btn small class="mr-2">Upload</ui-btn>
          <ui-text-input v-model="newCoverImage" class="flex-grow" placeholder="Collection Cover Image" />
        </div>
        <div class="flex justify-end">
          <ui-btn color="success">Upload</ui-btn>
        </div>
      </template>
      <!-- <modals-upload-image-modal v-model="showUploadImageModal" entity="collection" :entity-id="collection.id" /> -->
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      newCollectionName: null,
      newCollectionDescription: null,
      showImageUploader: false
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showEditCollectionModal
      },
      set(val) {
        this.$store.commit('globals/setShowEditCollectionModal', val)
      }
    },
    collection() {
      return this.$store.state.globals.selectedCollection || {}
    },
    collectionName() {
      return this.collection.name
    },
    books() {
      return this.collection.books || []
    }
  },
  methods: {
    init() {
      this.newCollectionName = this.collectionName
      this.newCollectionDescription = this.collection.description || ''
    },
    removeClick() {
      if (confirm(`Are you sure you want to remove collection "${this.collectionName}"?`)) {
        this.processing = true
        var collectionName = this.collectionName
        this.$axios
          .$delete(`/api/collections/${this.collection.id}`)
          .then(() => {
            this.processing = false
            this.show = false
            this.$toast.success(`Collection "${collectionName}" Removed`)
          })
          .catch((error) => {
            console.error('Failed to remove collection', error)
            this.processing = false
            this.$toast.error(`Failed to remove collection`)
          })
      }
    },
    submitForm() {
      if (this.newCollectionName === this.collectionName && this.newCollectionDescription === this.collection.description) {
        return
      }
      if (!this.newCollectionName) {
        return this.$toast.error('Collection must have a name')
      }

      this.processing = true

      var collectionUpdate = {
        name: this.newCollectionName,
        description: this.newCollectionDescription || null
      }
      this.$axios
        .$patch(`/api/collections/${this.collection.id}`, collectionUpdate)
        .then((collection) => {
          console.log('Collection Updated', collection)
          this.processing = false
          this.show = false
          this.$toast.success(`Collection "${collection.name}" Updated`)
        })
        .catch((error) => {
          console.error('Failed to update collection', error)
          this.processing = false
          this.$toast.error(`Failed to update collection`)
        })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
