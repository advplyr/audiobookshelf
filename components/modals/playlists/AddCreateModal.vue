<template>
  <modals-modal v-model="show" name="playlists" :processing="processing" :width="500" :height="'unset'">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>

    <div ref="container" class="w-full rounded-lg bg-primary box-shadow-md overflow-y-auto overflow-x-hidden" style="max-height: 80vh">
      <div v-if="show" class="w-full h-full">
        <div class="py-4 px-4">
          <h1 v-if="!isBatch" class="text-2xl">{{ $strings.LabelAddToPlaylist }}</h1>
          <h1 v-else class="text-2xl">{{ $getString('LabelAddToPlaylistBatch', [selectedPlaylistItems.length]) }}</h1>
        </div>
        <div class="w-full overflow-y-auto overflow-x-hidden max-h-96">
          <transition-group name="list-complete" tag="div">
            <template v-for="playlist in sortedPlaylists">
              <modals-playlists-user-playlist-item :key="playlist.id" :playlist="playlist" class="list-complete-item" @add="addToPlaylist" @remove="removeFromPlaylist" @close="show = false" />
            </template>
          </transition-group>
        </div>
        <div v-if="!playlists.length" class="flex h-32 items-center justify-center">
          <p class="text-xl">{{ $strings.MessageNoUserPlaylists }}</p>
        </div>
        <div class="w-full h-px bg-white bg-opacity-10" />
        <form @submit.prevent="submitCreatePlaylist">
          <div class="flex px-4 py-2 items-center text-center border-b border-white border-opacity-10 text-white text-opacity-80">
            <div class="flex-grow px-2">
              <ui-text-input v-model="newPlaylistName" :placeholder="$strings.PlaceholderNewPlaylist" class="w-full" />
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
      newPlaylistName: '',
      processing: false
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.loadPlaylists()
        this.newPlaylistName = ''
      } else {
        this.$store.commit('globals/setSelectedPlaylistItems', null)
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showPlaylistsModal
      },
      set(val) {
        this.$store.commit('globals/setShowPlaylistsModal', val)
      }
    },
    title() {
      if (!this.selectedPlaylistItems.length) return ''
      if (this.isBatch) {
        return this.$getString('MessageItemsSelected', [this.selectedPlaylistItems.length])
      }
      const selectedPlaylistItem = this.selectedPlaylistItems[0]
      if (selectedPlaylistItem.episode) {
        return selectedPlaylistItem.episode.title
      }
      return selectedPlaylistItem.libraryItem.media.metadata.title || ''
    },
    playlists() {
      return this.$store.state.libraries.userPlaylists || []
    },
    sortedPlaylists() {
      return this.playlists
        .map((playlist) => {
          const includesItem = !this.selectedPlaylistItems.some((item) => !this.checkIsItemInPlaylist(playlist, item))

          return {
            isItemIncluded: includesItem,
            ...playlist
          }
        })
        .sort((a, b) => (a.isItemIncluded ? -1 : 1))
    },
    isBatch() {
      return this.selectedPlaylistItems.length > 1
    },
    selectedPlaylistItems() {
      return this.$store.state.globals.selectedPlaylistItems || []
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    checkIsItemInPlaylist(playlist, item) {
      if (item.episode) {
        return playlist.items.some((i) => i.libraryItemId === item.libraryItem.id && i.episodeId === item.episode.id)
      }
      return playlist.items.some((i) => i.libraryItemId === item.libraryItem.id)
    },
    loadPlaylists() {
      this.processing = true
      this.$axios
        .$get(`/api/libraries/${this.currentLibraryId}/playlists`)
        .then((data) => {
          this.$store.commit('libraries/setUserPlaylists', data.results || [])
        })
        .catch((error) => {
          console.error('Failed to get playlists', error)
          this.$toast.error(this.$strings.ToastFailedToLoadData)
        })
        .finally(() => {
          this.processing = false
        })
    },
    removeFromPlaylist(playlist) {
      if (!this.selectedPlaylistItems.length) return
      this.processing = true

      const itemObjects = this.selectedPlaylistItems.map((pi) => ({ libraryItemId: pi.libraryItem.id, episodeId: pi.episode ? pi.episode.id : null }))
      this.$axios
        .$post(`/api/playlists/${playlist.id}/batch/remove`, { items: itemObjects })
        .then((updatedPlaylist) => {
          console.log(`Items removed from playlist`, updatedPlaylist)
          this.$toast.success(this.$strings.ToastPlaylistUpdateSuccess)
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed to remove items from playlist', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
          this.processing = false
        })
    },
    addToPlaylist(playlist) {
      if (!this.selectedPlaylistItems.length) return
      this.processing = true

      const itemObjects = this.selectedPlaylistItems.map((pi) => ({ libraryItemId: pi.libraryItem.id, episodeId: pi.episode ? pi.episode.id : null }))
      this.$axios
        .$post(`/api/playlists/${playlist.id}/batch/add`, { items: itemObjects })
        .then((updatedPlaylist) => {
          console.log(`Items added to playlist`, updatedPlaylist)
          this.$toast.success(this.$strings.ToastPlaylistUpdateSuccess)
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed to add items to playlist', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
          this.processing = false
        })
    },
    submitCreatePlaylist() {
      if (!this.newPlaylistName || !this.selectedPlaylistItems.length) {
        return
      }
      this.processing = true

      const itemObjects = this.selectedPlaylistItems.map((pi) => ({ libraryItemId: pi.libraryItem.id, episodeId: pi.episode ? pi.episode.id : null }))
      const newPlaylist = {
        items: itemObjects,
        libraryId: this.currentLibraryId,
        name: this.newPlaylistName
      }

      this.$axios
        .$post('/api/playlists', newPlaylist)
        .then((data) => {
          console.log('New playlist created', data)
          this.$toast.success(this.$strings.ToastPlaylistCreateSuccess + ': ' + data.name)
          this.processing = false
          this.newPlaylistName = ''
        })
        .catch((error) => {
          console.error('Failed to create playlist', error)
          var errMsg = error.response ? error.response.data || '' : ''
          this.$toast.error(this.$strings.ToastPlaylistCreateFailed + ': ' + errMsg)
          this.processing = false
        })
    }
  },
  mounted() {}
}
</script>
