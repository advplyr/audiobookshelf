<template>
  <div class="bg-bg rounded-md shadow-lg border border-white border-opacity-5 p-4 mb-8">
    <div class="flex items-center mb-2">
      <h1 class="text-xl">Libraries</h1>
      <div class="mx-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer hover:bg-white hover:bg-opacity-10 text-center" @click="clickAddLibrary">
        <span class="material-icons" style="font-size: 1.4rem">add</span>
      </div>
    </div>

    <template v-for="library in libraries">
      <modals-libraries-library-item :key="library.id" :library="library" :selected="currentLibraryId === library.id" :show-edit="true" @edit="editLibrary" @delete="deleteLibrary" @click="clickLibrary" />
    </template>
    <modals-edit-library-modal v-model="showLibraryModal" :library="selectedLibrary" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      showLibraryModal: false,
      selectedLibrary: null
    }
  },
  computed: {
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
  methods: {
    async clickLibrary(library) {
      await this.$store.dispatch('libraries/fetch', library.id)
      this.$router.push(`/library/${library.id}`)
    },
    deleteLibrary(library) {
      if (library.id === 'main') return
      // if (confirm(`Are you sure you want to permanently delete user "${user.username}"?`)) {
      //   this.isDeletingUser = true
      //   this.$axios
      //     .$delete(`/api/user/${user.id}`)
      //     .then((data) => {
      //       this.isDeletingUser = false
      //       if (data.error) {
      //         this.$toast.error(data.error)
      //       } else {
      //         this.$toast.success('User deleted')
      //       }
      //     })
      //     .catch((error) => {
      //       console.error('Failed to delete user', error)
      //       this.$toast.error('Failed to delete user')
      //       this.isDeletingUser = false
      //     })
      // }
    },
    clickAddLibrary() {
      this.selectedLibrary = null
      this.showLibraryModal = true
    },
    editLibrary(library) {
      this.selectedLibrary = library
      this.showLibraryModal = true
    },
    init() {}
  },
  mounted() {
    this.init()
  },
  beforeDestroy() {}
}
</script>