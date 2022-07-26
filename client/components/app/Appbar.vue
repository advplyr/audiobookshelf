<template>
  <div class="w-full h-16 bg-primary relative">
    <div id="appbar" class="absolute top-0 bottom-0 left-0 w-full h-full px-2 md:px-6 py-1 z-50">
      <div class="flex h-full items-center">
        <nuxt-link to="/">
          <img src="/icon48.png" class="w-10 min-w-10 h-10 mr-2 sm:w-12 sm:min-w-12 sm:h-12 sm:mr-4" />
        </nuxt-link>

        <nuxt-link to="/">
          <h1 class="text-2xl font-book mr-6 hidden lg:block hover:underline">audiobookshelf</h1>
        </nuxt-link>

        <ui-libraries-dropdown class="mr-2" />

        <controls-global-search v-if="currentLibrary" class="" />
        <div class="flex-grow" />

        <span v-if="showExperimentalFeatures" class="material-icons text-4xl text-warning pr-0 sm:pr-2 md:pr-4">logo_dev</span>

        <ui-tooltip v-if="isChromecastInitialized && !isHttps" direction="bottom" text="Casting requires a secure connection" class="flex items-center">
          <span class="material-icons-outlined text-warning text-opacity-50"> cast </span>
        </ui-tooltip>
        <div v-if="isChromecastInitialized" class="w-6 min-w-6 h-6 ml-2 mr-1 sm:mx-2 cursor-pointer">
          <google-cast-launcher></google-cast-launcher>
        </div>

        <nuxt-link v-if="currentLibrary" to="/config/stats" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 hidden sm:flex items-center justify-center mx-1">
          <span class="material-icons" aria-label="User Stats" role="button">equalizer</span>
        </nuxt-link>

        <nuxt-link v-if="userCanUpload && currentLibrary" to="/upload" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center mx-1">
          <span class="material-icons" aria-label="Upload Media" role="button">upload</span>
        </nuxt-link>

        <nuxt-link v-if="userIsAdminOrUp" to="/config" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center mx-1">
          <span class="material-icons" aria-label="System Settings" role="button">settings</span>
        </nuxt-link>

        <nuxt-link to="/account" class="relative w-9 h-9 md:w-32 bg-fg border border-gray-500 rounded shadow-sm ml-1.5 sm:ml-3 md:ml-5 md:pl-3 md:pr-10 py-2 text-left focus:outline-none sm:text-sm cursor-pointer hover:bg-bg hover:bg-opacity-40" aria-haspopup="listbox" aria-expanded="true">
          <span class="items-center hidden md:flex">
            <span class="block truncate">{{ username }}</span>
          </span>
          <span class="h-full md:ml-3 md:absolute inset-y-0 md:right-0 flex items-center justify-center md:pr-2 pointer-events-none">
            <span class="material-icons text-gray-100">person</span>
          </span>
        </nuxt-link>
      </div>

      <div v-show="numLibraryItemsSelected" class="absolute top-0 left-0 w-full h-full px-4 bg-primary flex items-center">
        <h1 class="text-2xl px-4">{{ numLibraryItemsSelected }} Selected</h1>
        <div class="flex-grow" />
        <ui-tooltip v-if="!isPodcastLibrary" :text="`Mark as ${selectedIsFinished ? 'Not Finished' : 'Finished'}`" direction="bottom">
          <ui-read-icon-btn :disabled="processingBatch" :is-read="selectedIsFinished" @click="toggleBatchRead" class="mx-1.5" />
        </ui-tooltip>
        <ui-tooltip v-if="userCanUpdate && !isPodcastLibrary" text="Add to Collection" direction="bottom">
          <ui-icon-btn :disabled="processingBatch" icon="collections_bookmark" @click="batchAddToCollectionClick" class="mx-1.5" />
        </ui-tooltip>
        <template v-if="userCanUpdate && numLibraryItemsSelected < 50">
          <ui-tooltip text="Edit" direction="bottom">
            <ui-icon-btn v-show="!processingBatchDelete" icon="edit" bg-color="warning" class="mx-1.5" @click="batchEditClick" />
          </ui-tooltip>
        </template>
        <ui-tooltip v-if="userCanDelete" text="Delete" direction="bottom">
          <ui-icon-btn :disabled="processingBatchDelete" icon="delete" bg-color="error" class="mx-1.5" @click="batchDeleteClick" />
        </ui-tooltip>
        <ui-tooltip text="Deselect All" direction="bottom">
          <span class="material-icons text-4xl px-4 hover:text-gray-100 cursor-pointer" :class="processingBatchDelete ? 'text-gray-400' : ''" @click="cancelSelectionMode">close</span>
        </ui-tooltip>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      processingBatchDelete: false,
      totalEntities: 0,
      isAllSelected: false
    }
  },
  computed: {
    currentLibrary() {
      return this.$store.getters['libraries/getCurrentLibrary']
    },
    libraryName() {
      return this.currentLibrary ? this.currentLibrary.name : 'unknown'
    },
    libraryMediaType() {
      return this.currentLibrary ? this.currentLibrary.mediaType : null
    },
    isPodcastLibrary() {
      return this.libraryMediaType === 'podcast'
    },
    isHome() {
      return this.$route.name === 'library-library'
    },
    user() {
      return this.$store.state.user.user
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    username() {
      return this.user ? this.user.username : 'err'
    },
    numLibraryItemsSelected() {
      return this.selectedLibraryItems.length
    },
    selectedLibraryItems() {
      return this.$store.state.selectedLibraryItems
    },
    userMediaProgress() {
      return this.$store.state.user.user.mediaProgress || []
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userCanUpload() {
      return this.$store.getters['user/getUserCanUpload']
    },
    selectedIsFinished() {
      // Find an item that is not finished, if none then all items finished
      return !this.selectedLibraryItems.find((libraryItemId) => {
        var itemProgress = this.userMediaProgress.find((lip) => lip.libraryItemId === libraryItemId)
        return !itemProgress || !itemProgress.isFinished
      })
    },
    processingBatch() {
      return this.$store.state.processingBatch
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    isChromecastEnabled() {
      return this.$store.getters['getServerSetting']('chromecastEnabled')
    },
    isChromecastInitialized() {
      return this.$store.state.globals.isChromecastInitialized
    },
    isHttps() {
      return location.protocol === 'https:' || process.env.NODE_ENV === 'development'
    }
  },
  methods: {
    cancelSelectionMode() {
      if (this.processingBatchDelete) return
      this.$store.commit('setSelectedLibraryItems', [])
      this.$eventBus.$emit('bookshelf-clear-selection')
      this.isAllSelected = false
    },
    toggleBatchRead() {
      this.$store.commit('setProcessingBatch', true)
      var newIsFinished = !this.selectedIsFinished
      var updateProgressPayloads = this.selectedLibraryItems.map((lid) => {
        return {
          id: lid,
          isFinished: newIsFinished
        }
      })
      console.log('Progress payloads', updateProgressPayloads)
      this.$axios
        .patch(`/api/me/progress/batch/update`, updateProgressPayloads)
        .then(() => {
          this.$toast.success('Batch update success!')
          this.$store.commit('setProcessingBatch', false)
          this.$store.commit('setSelectedLibraryItems', [])
          this.$eventBus.$emit('bookshelf-clear-selection')
        })
        .catch((error) => {
          this.$toast.error('Batch update failed')
          console.error('Failed to batch update read/not read', error)
          this.$store.commit('setProcessingBatch', false)
        })
    },
    batchDeleteClick() {
      var audiobookText = this.numLibraryItemsSelected > 1 ? `these ${this.numLibraryItemsSelected} items` : 'this item'
      var confirmMsg = `Are you sure you want to remove ${audiobookText}?\n\n*Does not delete your files, only removes the items from Audiobookshelf`
      if (confirm(confirmMsg)) {
        this.processingBatchDelete = true
        this.$store.commit('setProcessingBatch', true)
        this.$axios
          .$post(`/api/items/batch/delete`, {
            libraryItemIds: this.selectedLibraryItems
          })
          .then(() => {
            this.$toast.success('Batch delete success!')
            this.processingBatchDelete = false
            this.$store.commit('setProcessingBatch', false)
            this.$store.commit('setSelectedLibraryItems', [])
            this.$eventBus.$emit('bookshelf-clear-selection')
          })
          .catch((error) => {
            this.$toast.error('Batch delete failed')
            console.error('Failed to batch delete', error)
            this.processingBatchDelete = false
            this.$store.commit('setProcessingBatch', false)
          })
      }
    },
    batchEditClick() {
      this.$router.push('/batch')
    },
    batchAddToCollectionClick() {
      this.$store.commit('globals/setShowBatchUserCollectionsModal', true)
    },
    setBookshelfTotalEntities(totalEntities) {
      this.totalEntities = totalEntities
    }
  },
  mounted() {
    this.$eventBus.$on('bookshelf-total-entities', this.setBookshelfTotalEntities)
  },
  beforeDestroy() {
    this.$eventBus.$off('bookshelf-total-entities', this.setBookshelfTotalEntities)
  }
}
</script>

<style>
#appbar {
  box-shadow: 0px 5px 5px #11111155;
}
</style>
