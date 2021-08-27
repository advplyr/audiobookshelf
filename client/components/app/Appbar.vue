<template>
  <div class="w-full h-16 bg-primary relative">
    <div id="appbar" class="absolute top-0 bottom-0 left-0 w-full h-full px-6 py-1 z-30">
      <div class="flex h-full items-center">
        <img v-if="!showBack" src="/LogoTransparent.png" class="w-12 h-12 mr-4" />
        <a v-if="showBack" @click="back" class="rounded-full h-12 w-12 flex items-center justify-center hover:bg-white hover:bg-opacity-10 mr-4 cursor-pointer">
          <span class="material-icons text-4xl text-white">arrow_back</span>
        </a>
        <h1 class="text-2xl font-book">AudioBookshelf</h1>

        <controls-global-search />
        <div class="flex-grow" />

        <nuxt-link v-if="isRootUser" to="/config" class="outline-none hover:text-gray-200 cursor-pointer w-8 h-8 flex items-center justify-center">
          <span class="material-icons">settings</span>
        </nuxt-link>

        <ui-menu :label="username" :items="menuItems" @action="menuAction" class="ml-5" />
      </div>

      <div v-show="numAudiobooksSelected" class="absolute top-0 left-0 w-full h-full px-4 bg-primary flex items-center">
        <h1 class="text-2xl px-4">{{ numAudiobooksSelected }} Selected</h1>
        <ui-btn small class="text-sm mx-2" @click="toggleSelectAll">{{ isAllSelected ? 'Select None' : 'Select All' }}</ui-btn>

        <div class="flex-grow" />
        <ui-btn v-show="!processingBatchDelete" color="warning" small class="mx-2" @click="batchEditClick"><span class="material-icons text-gray-200 pt-1">edit</span></ui-btn>
        <ui-btn color="error" small class="mx-2" :loading="processingBatchDelete" @click="batchDeleteClick"><span class="material-icons text-gray-200 pt-1">delete</span></ui-btn>
        <span class="material-icons text-4xl px-4 hover:text-gray-100 cursor-pointer" :class="processingBatchDelete ? 'text-gray-400' : ''" @click="cancelSelectionMode">close</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      menuItems: [
        {
          value: 'account',
          text: 'Account',
          to: '/account'
        },
        {
          value: 'logout',
          text: 'Logout'
        }
      ],
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
    audiobooksShowing() {
      return this.$store.getters['audiobooks/getFiltered']()
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
    logout() {
      this.$axios.$post('/logout').catch((error) => {
        console.error(error)
      })
      if (localStorage.getItem('token')) {
        localStorage.removeItem('token')
      }
      this.$router.push('/login')
    },
    menuAction(action) {
      if (action === 'logout') {
        this.logout()
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
    batchDeleteClick() {
      if (confirm(`Are you sure you want to delete these ${this.numAudiobooksSelected} audiobook(s)?`)) {
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