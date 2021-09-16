<template>
  <div class="w-full h-16 bg-primary relative">
    <div id="appbar" class="absolute top-0 bottom-0 left-0 w-full h-full px-6 py-1 z-30">
      <div class="flex h-full items-center">
        <img v-if="!showBack" src="/Logo48.png" class="w-12 h-12 mr-4" />
        <a v-if="showBack" @click="back" class="rounded-full h-12 w-12 flex items-center justify-center hover:bg-white hover:bg-opacity-10 mr-4 cursor-pointer">
          <span class="material-icons text-4xl text-white">arrow_back</span>
        </a>
        <h1 class="text-2xl font-book mr-6">AudioBookshelf</h1>

        <controls-global-search />
        <div class="flex-grow" />

        <!-- <a v-if="isUpdateAvailable" :href="githubTagUrl" target="_blank" class="flex items-center rounded-full bg-warning p-2 text-sm">
          <span class="material-icons">notification_important</span>
          <span class="pl-2">Update is available! Check release notes for v{{ latestVersion }}</span>
        </a> -->

        <nuxt-link v-if="isRootUser" to="/upload" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center mr-4">
          <span class="material-icons">upload</span>
        </nuxt-link>

        <nuxt-link v-if="isRootUser" to="/config" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center">
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
        <ui-btn small class="text-sm mx-2" @click="toggleSelectAll">{{ isAllSelected ? 'Select None' : 'Select All' }}</ui-btn>

        <div class="flex-grow" />
        <ui-tooltip v-if="userCanUpdate" :text="`Mark as ${selectedIsRead ? 'Not Read' : 'Read'}`" direction="bottom">
          <ui-read-icon-btn :is-read="selectedIsRead" @click="toggleBatchRead" class="mx-1.5" />
        </ui-tooltip>
        <template v-if="userCanUpdate">
          <ui-icon-btn v-show="!processingBatchDelete" icon="edit" bg-color="warning" class="mx-1.5" @click="batchEditClick" />
          <!-- <ui-btn v-show="!processingBatchDelete" color="warning" small class="mx-2 w-10 h-10" :padding-y="0" :padding-x="0" @click="batchEditClick"><span class="material-icons text-gray-200 text-base">edit</span></ui-btn> -->
        </template>
        <ui-icon-btn v-show="userCanDelete" :disabled="processingBatchDelete" icon="delete" bg-color="error" class="mx-1.5" @click="batchDeleteClick" />
        <!-- <ui-btn v-if="userCanDelete" color="error" small class="mx-2" :loading="processingBatchDelete" @click="batchDeleteClick"><span class="material-icons text-gray-200 pt-1">delete</span></ui-btn> -->
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
    showBack() {
      return this.$route.name !== 'index'
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
      return this.$store.getters['audiobooks/getFiltered']()
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    selectedIsRead() {
      // Find an audiobook that is not read, if none then all audiobooks read
      return !this.selectedAudiobooks.find((ab) => {
        var userAb = this.userAudiobooks[ab]
        return !userAb || !userAb.isRead
      })
    }
  },
  methods: {
    back() {
      if (this.$route.name === 'audiobook-id-edit') {
        this.$router.push(`/audiobook/${this.$route.params.id}`)
      } else {
        this.$router.push('/')
      }
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