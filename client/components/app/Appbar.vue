<template>
  <div class="w-full h-16 bg-primary relative">
    <div id="appbar" class="absolute top-0 bottom-0 left-0 w-full h-full px-6 py-1 z-40">
      <div class="flex h-full items-center">
        <img v-if="!showBack" src="/Logo48.png" class="w-12 h-12 mr-4" />
        <a v-if="showBack" @click="back" class="rounded-full h-12 w-12 flex items-center justify-center hover:bg-white hover:bg-opacity-10 mr-4 cursor-pointer">
          <span class="material-icons text-4xl text-white">arrow_back</span>
        </a>
        <h1 class="text-2xl font-book mr-6">AudioBookshelf</h1>
        <!-- <div class="-mb-2 mr-6"> -->
        <!-- <h1 class="text-base font-book leading-3 px-1">AudioBookshelf</h1> -->

        <!-- <div class="bg-black bg-opacity-20 rounded-sm py-1 px-2 flex items-center border border-bg mt-1.5 cursor-pointer" @click="clickLibrary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white text-opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>

            <p class="text-sm text-white text-opacity-70 leading-3 font-book pl-2">{{ libraryName }}</p>
          </div> -->
        <!-- </div> -->
        <div class="bg-black bg-opacity-20 rounded-md py-1.5 px-3 flex items-center text-white text-opacity-70 cursor-pointer hover:bg-opacity-10 hover:text-opacity-90" @click="clickLibrary">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>

          <p class="text-sm leading-3 font-sans pl-2">{{ libraryName }}</p>
        </div>

        <controls-global-search />
        <div class="flex-grow" />

        <span v-if="showExperimentalFeatures" class="material-icons text-4xl text-warning pr-4">logo_dev</span>

        <nuxt-link v-if="userCanUpload" to="/upload" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center">
          <span class="material-icons">upload</span>
        </nuxt-link>

        <nuxt-link v-if="isRootUser" to="/config" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center ml-4">
          <span class="material-icons">settings</span>
        </nuxt-link>

        <nuxt-link to="/account" class="relative w-32 bg-fg border border-gray-500 rounded shadow-sm ml-5 pl-3 pr-10 py-2 text-left focus:outline-none sm:text-sm cursor-pointer hover:bg-bg hover:bg-opacity-40" aria-haspopup="listbox" aria-expanded="true">
          <span class="flex items-center">
            <span class="block truncate">{{ username }}</span>
          </span>
          <span class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <span class="material-icons text-gray-100">person</span>
          </span>
        </nuxt-link>
      </div>

      <div v-show="numAudiobooksSelected" class="absolute top-0 left-0 w-full h-full px-4 bg-primary flex items-center">
        <h1 class="text-2xl px-4">{{ numAudiobooksSelected }} Selected</h1>
        <ui-btn v-show="!isHome" small class="text-sm mx-2" @click="toggleSelectAll"
          >{{ isAllSelected ? 'Select None' : 'Select All' }}<span class="pl-2">({{ audiobooksShowing.length }})</span></ui-btn
        >

        <div class="flex-grow" />

        <ui-tooltip :text="`Mark as ${selectedIsRead ? 'Not Read' : 'Read'}`" direction="bottom">
          <ui-read-icon-btn :disabled="processingBatch" :is-read="selectedIsRead" @click="toggleBatchRead" class="mx-1.5" />
        </ui-tooltip>
        <template v-if="userCanUpdate">
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
      processingBatchDelete: false
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
    isAllSelected() {
      return this.audiobooksShowing.length === this.selectedAudiobooks.length
    },
    userAudiobooks() {
      return this.$store.state.user.user.audiobooks || {}
    },
    audiobooksShowing() {
      // return this.$store.getters['audiobooks/getFiltered']()
      return this.$store.getters['audiobooks/getEntitiesShowing']()
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
    clickLibrary() {
      this.$store.commit('libraries/setShowModal', true)
    },
    async back() {
      var popped = await this.$store.dispatch('popRoute')
      var backTo = popped || '/'
      this.$router.push(backTo)
    },
    cancelSelectionMode() {
      if (this.processingBatchDelete) return
      this.$store.commit('setSelectedAudiobooks', [])
    },
    toggleSelectAll() {
      if (this.isAllSelected) {
        this.cancelSelectionMode()
      } else {
        var audiobookIds = this.audiobooksShowing.map((a) => a.id)
        this.$store.commit('setSelectedAudiobooks', audiobookIds)
      }
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
        .patch(`/api/user/audiobooks`, updateProgressPayloads)
        .then(() => {
          this.$toast.success('Batch update success!')
          this.$store.commit('setProcessingBatch', false)
          this.$store.commit('setSelectedAudiobooks', [])
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
          .$post(`/api/audiobooks/delete`, {
            audiobookIds: this.selectedAudiobooks
          })
          .then(() => {
            this.$toast.success('Batch delete success!')
            this.processingBatchDelete = false
            this.$store.commit('setProcessingBatch', false)
            this.$store.commit('setSelectedAudiobooks', [])
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
    }
  },
  mounted() {}
}
</script>

<style>
#appbar {
  box-shadow: 0px 5px 5px #11111155;
}
</style>