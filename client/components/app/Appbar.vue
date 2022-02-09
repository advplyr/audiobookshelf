<template>
  <div class="w-full h-16 bg-primary relative">
    <div id="appbar" class="absolute top-0 bottom-0 left-0 w-full h-full px-2 md:px-6 py-1 z-50">
      <div class="flex h-full items-center">
        <img v-if="!showBack" src="/icon48.png" class="w-10 h-10 md:w-12 md:h-12 mr-4" />
        <a v-if="showBack" @click="back" class="rounded-full h-12 w-12 flex items-center justify-center hover:bg-white hover:bg-opacity-10 mr-4 cursor-pointer">
          <span class="material-icons text-4xl text-white">arrow_back</span>
        </a>
        <h1 class="text-2xl font-book mr-6 hidden lg:block">audiobookshelf</h1>

        <ui-libraries-dropdown />

        <controls-global-search class="hidden md:block" />
        <div class="flex-grow" />

        <span v-if="showExperimentalFeatures" class="material-icons text-4xl text-warning pr-0 sm:pr-2 md:pr-4">logo_dev</span>

        <nuxt-link to="/config/stats" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center mx-1">
          <span class="material-icons">equalizer</span>
        </nuxt-link>

        <nuxt-link v-if="userCanUpload" to="/upload" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center mx-1">
          <span class="material-icons">upload</span>
        </nuxt-link>

        <nuxt-link v-if="isRootUser" to="/config" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center mx-1">
          <span class="material-icons">settings</span>
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

      <div v-show="numAudiobooksSelected" class="absolute top-0 left-0 w-full h-full px-4 bg-primary flex items-center">
        <h1 class="text-2xl px-4">{{ numAudiobooksSelected }} Selected</h1>
        <!-- <ui-btn v-show="!isHome" small class="text-sm mx-2" @click="toggleSelectAll"
          >{{ isAllSelected ? 'Select None' : 'Select All' }}<span class="pl-2">({{ entitiesLoaded }})</span></ui-btn
        > -->

        <div class="flex-grow" />
        <ui-tooltip :text="`Mark as ${selectedIsRead ? 'Not Read' : 'Read'}`" direction="bottom">
          <ui-read-icon-btn :disabled="processingBatch" :is-read="selectedIsRead" @click="toggleBatchRead" class="mx-1.5" />
        </ui-tooltip>
        <ui-tooltip v-if="userCanUpdate" text="Add to Collection" direction="bottom">
          <ui-icon-btn :disabled="processingBatch" icon="collections_bookmark" @click="batchAddToCollectionClick" class="mx-1.5" />
        </ui-tooltip>
        <template v-if="userCanUpdate && numAudiobooksSelected < 50">
          <ui-icon-btn v-show="!processingBatchDelete" icon="edit" bg-color="warning" class="mx-1.5" @click="batchEditClick" />
        </template>
        <ui-icon-btn v-show="userCanDelete" :disabled="processingBatchDelete" icon="delete" bg-color="error" class="mx-1.5" @click="batchDeleteClick" />
        <span class="material-icons text-4xl px-4 hover:text-gray-100 cursor-pointer" :class="processingBatchDelete ? 'text-gray-400' : ''" @click="cancelSelectionMode">close</span>
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
    isHome() {
      return this.$route.name === 'library-library'
    },
    showBack() {
      return this.$route.name !== 'library-library-bookshelf-id' && !this.isHome
    },
    user() {
      return this.$store.state.user.user
    },
    isRootUser() {
      return this.$store.getters['user/getIsRoot']
    },
    username() {
      return this.user ? this.user.username : 'err'
    },
    numAudiobooksSelected() {
      return this.selectedAudiobooks.length
    },
    selectedAudiobooks() {
      return this.$store.state.selectedAudiobooks
    },
    userAudiobooks() {
      return this.$store.state.user.user.audiobooks || {}
    },
    selectedSeries() {
      return this.$store.state.audiobooks.selectedSeries
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
    selectedIsRead() {
      // Find an audiobook that is not read, if none then all audiobooks read
      return !this.selectedAudiobooks.find((ab) => {
        var userAb = this.userAudiobooks[ab]
        return !userAb || !userAb.isRead
      })
    },
    processingBatch() {
      return this.$store.state.processingBatch
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    }
  },
  methods: {
    toggleBookshelfTexture() {
      this.$store.dispatch('setBookshelfTexture', 'wood2.png')
    },
    async back() {
      var popped = await this.$store.dispatch('popRoute')
      if (popped) this.$store.commit('setIsRoutingBack', true)
      var backTo = popped || '/'
      this.$router.push(backTo)
    },
    cancelSelectionMode() {
      if (this.processingBatchDelete) return
      this.$store.commit('setSelectedAudiobooks', [])
      this.$eventBus.$emit('bookshelf-clear-selection')
      this.isAllSelected = false
    },
    toggleBatchRead() {
      this.$store.commit('setProcessingBatch', true)
      var newIsRead = !this.selectedIsRead
      var updateProgressPayloads = this.selectedAudiobooks.map((ab) => {
        return {
          audiobookId: ab,
          isRead: newIsRead
        }
      })
      this.$axios
        .patch(`/api/me/audiobook/batch/update`, updateProgressPayloads)
        .then(() => {
          this.$toast.success('Batch update success!')
          this.$store.commit('setProcessingBatch', false)
          this.$store.commit('setSelectedAudiobooks', [])
          this.$eventBus.$emit('bookshelf-clear-selection')
        })
        .catch((error) => {
          this.$toast.error('Batch update failed')
          console.error('Failed to batch update read/not read', error)
          this.$store.commit('setProcessingBatch', false)
        })
    },
    batchDeleteClick() {
      var audiobookText = this.numAudiobooksSelected > 1 ? `these ${this.numAudiobooksSelected} audiobooks` : 'this audiobook'
      var confirmMsg = `Are you sure you want to remove ${audiobookText}?\n\n*Does not delete your files, only removes the audiobooks from AudioBookshelf`
      if (confirm(confirmMsg)) {
        this.processingBatchDelete = true
        this.$store.commit('setProcessingBatch', true)
        this.$axios
          .$post(`/api/books/batch/delete`, {
            audiobookIds: this.selectedAudiobooks
          })
          .then(() => {
            this.$toast.success('Batch delete success!')
            this.processingBatchDelete = false
            this.$store.commit('setProcessingBatch', false)
            this.$store.commit('setSelectedAudiobooks', [])
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