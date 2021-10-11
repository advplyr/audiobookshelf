<template>
  <modals-modal v-model="show" :width="700" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div v-if="show" class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 200px; max-height: 80vh">
      <div v-if="!showAddLibrary" class="w-full h-full flex flex-col justify-center px-4">
        <div class="flex items-center mb-4">
          <p>{{ libraries.length }} Libraries</p>
          <!-- <div class="flex-grow" />
          <ui-btn @click="addLibraryClick">Add Library</ui-btn> -->
        </div>

        <template v-for="library in libraries">
          <modals-libraries-library-item :key="library.id" :library="library" :selected="currentLibraryId === library.id" :show-edit="false" @edit="editLibrary" @delete="deleteLibrary" @click="clickLibrary" />
        </template>
      </div>
      <modals-libraries-edit-library v-else :library="selectedLibrary" :show="showAddLibrary" :processing.sync="processing" @back="showAddLibrary = false" @close="showAddLibrary = false" />
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      selectedLibrary: null,
      processing: false,
      showAddLibrary: false
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.libraries.showModal
      },
      set(val) {
        this.$store.commit('libraries/setShowModal', val)
      }
    },
    title() {
      return 'Libraries'
    },
    currentLibrary() {
      return this.$store.getters['libraries/getCurrentLibrary']
    },
    currentLibraryId() {
      return this.currentLibrary ? this.currentLibrary.id : null
    },
    libraries() {
      return this.$store.state.libraries.libraries
    }
  },
  watch: {
    show(newVal) {
      if (newVal) this.showAddLibrary = false
    }
  },
  methods: {
    async clickLibrary(library) {
      await this.$store.dispatch('libraries/fetch', library.id)
      this.$router.push(`/library/${library.id}`)
      this.show = false
    },
    editLibrary(library) {
      this.selectedLibrary = library
      this.showAddLibrary = true
    },
    addLibraryClick() {
      this.selectedLibrary = null
      this.showAddLibrary = true
    },
    deleteLibrary(library) {
      if (confirm(`Are you sure you want to delete library "${library.name}"?\n(no files will be deleted but book data will be lost)`)) {
        console.log('Delete library', library)
        this.processing = true
        this.$axios
          .$delete(`/api/library/${library.id}`)
          .then(() => {
            console.log('Library delete success')
            this.$toast.success(`Library "${library.name}" deleted`)

            this.processing = false
          })
          .catch((error) => {
            console.error('Failed to delete library', error)
            var errMsg = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'
            this.$toast.error(errMsg)
            this.processing = false
          })
      }
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
