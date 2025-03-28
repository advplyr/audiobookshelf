<template>
  <modals-modal v-model="show" name="edit-playlist" :width="700" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.HeaderPlaylist }}</p>
      </div>
    </template>
    <div class="p-4 w-full text-sm py-6 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden" style="min-height: 400px; max-height: 80vh">
      <form @submit.prevent="submitForm">
        <div class="flex">
          <div>
            <covers-playlist-cover :items="items" :width="200" :height="200" />
          </div>
          <div class="grow px-4">
            <ui-text-input-with-label v-model="newPlaylistName" :label="$strings.LabelName" class="mb-2" />

            <ui-textarea-with-label v-model="newPlaylistDescription" :label="$strings.LabelDescription" />
          </div>
        </div>
        <div class="absolute bottom-0 left-0 right-0 w-full py-2 px-4 flex">
          <ui-btn v-if="userCanDelete" small color="bg-error" type="button" @click.stop="removeClick">{{ $strings.ButtonRemove }}</ui-btn>
          <div class="grow" />
          <ui-btn color="bg-success" type="submit">{{ $strings.ButtonSave }}</ui-btn>
        </div>
      </form>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      newPlaylistName: null,
      newPlaylistDescription: null,
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
        return this.$store.state.globals.showEditPlaylistModal
      },
      set(val) {
        this.$store.commit('globals/setShowEditPlaylistModal', val)
      }
    },
    playlist() {
      return this.$store.state.globals.selectedPlaylist || {}
    },
    playlistName() {
      return this.playlist.name
    },
    items() {
      return this.playlist.items || []
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    }
  },
  methods: {
    init() {
      this.newPlaylistName = this.playlistName
      this.newPlaylistDescription = this.playlist.description || ''
    },
    removeClick() {
      const payload = {
        message: this.$getString('MessageConfirmRemovePlaylist', [this.playlistName]),
        callback: (confirmed) => {
          if (confirmed) {
            this.removePlaylist()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    removePlaylist() {
      this.processing = true
      this.$axios
        .$delete(`/api/playlists/${this.playlist.id}`)
        .then(() => {
          this.show = false
          this.$toast.success(this.$strings.ToastPlaylistRemoveSuccess)
        })
        .catch((error) => {
          console.error('Failed to remove playlist', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.processing = false
        })
    },
    submitForm() {
      if (this.newPlaylistName === this.playlistName && this.newPlaylistDescription === this.playlist.description) {
        return
      }
      if (!this.newPlaylistName) {
        return this.$toast.error(this.$strings.ToastNameRequired)
      }

      this.processing = true

      var playlistUpdate = {
        name: this.newPlaylistName,
        description: this.newPlaylistDescription || null
      }
      this.$axios
        .$patch(`/api/playlists/${this.playlist.id}`, playlistUpdate)
        .then((playlist) => {
          console.log('Playlist Updated', playlist)
          this.processing = false
          this.show = false
          this.$toast.success(this.$strings.ToastPlaylistUpdateSuccess)
        })
        .catch((error) => {
          console.error('Failed to update playlist', error)
          this.processing = false
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
