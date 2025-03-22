<template>
  <div id="page-wrapper" class="bg-bg page overflow-hidden" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full h-full overflow-y-auto px-2 py-6 md:p-8">
      <div class="flex flex-col sm:flex-row max-w-6xl mx-auto">
        <div class="w-full flex justify-center md:block sm:w-32 md:w-52" style="min-width: 200px">
          <div class="relative" style="height: fit-content">
            <covers-playlist-cover :items="playlistItems" :width="200" :height="200" />
          </div>
        </div>
        <div class="grow px-2 py-6 md:py-0 md:px-10">
          <div class="flex items-end flex-row flex-wrap md:flex-nowrap">
            <h1 class="text-2xl md:text-3xl font-sans w-full md:w-fit mb-4 md:mb-0">
              {{ playlistName }}
            </h1>
            <div class="grow" />

            <ui-btn v-if="showPlayButton" :disabled="streaming" color="bg-success" :padding-x="4" small class="flex items-center h-9 mr-2" @click="clickPlay">
              <span v-show="!streaming" class="material-symbols fill text-2xl -ml-2 pr-1 text-white">play_arrow</span>
              {{ streaming ? $strings.ButtonPlaying : $strings.ButtonPlayAll }}
            </ui-btn>

            <ui-icon-btn icon="edit" class="mx-0.5" @click="editClick" />

            <ui-icon-btn icon="delete" class="mx-0.5" @click="removeClick" />
          </div>

          <div class="my-8 max-w-2xl">
            <p class="text-base text-gray-100">{{ description }}</p>
          </div>

          <tables-playlist-items-table :items="playlistItems" :playlist-id="playlistId" />
        </div>
      </div>
    </div>
    <div v-show="processingRemove" class="absolute top-0 left-0 w-full h-full z-10 bg-black/40 flex items-center justify-center">
      <ui-loading-indicator />
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
    var playlist = await app.$axios.$get(`/api/playlists/${params.id}`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!playlist) {
      return redirect('/')
    }

    // If playlist is a different library then set library as current
    if (playlist.libraryId !== store.state.libraries.currentLibraryId) {
      await store.dispatch('libraries/fetch', playlist.libraryId)
    }

    store.commit('libraries/addUpdateUserPlaylist', playlist)
    return {
      playlistId: playlist.id
    }
  },
  data() {
    return {
      processingRemove: false
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    playlistItems() {
      return this.playlist.items || []
    },
    playlistName() {
      return this.playlist.name || ''
    },
    description() {
      return this.playlist.description || ''
    },
    playlist() {
      return this.$store.getters['libraries/getPlaylist'](this.playlistId) || {}
    },
    playableItems() {
      return this.playlistItems.filter((item) => {
        const libraryItem = item.libraryItem
        if (libraryItem.isMissing || libraryItem.isInvalid) return false
        if (item.episode) return item.episode.audioFile
        return libraryItem.media.tracks.length
      })
    },
    streaming() {
      return !!this.playableItems.find((i) => this.$store.getters['getIsMediaStreaming'](i.libraryItemId, i.episodeId))
    },
    showPlayButton() {
      return this.playableItems.length
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    }
  },
  methods: {
    editClick() {
      this.$store.commit('globals/setEditPlaylist', this.playlist)
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
      this.processingRemove = true
      this.$axios
        .$delete(`/api/playlists/${this.playlist.id}`)
        .then(() => {
          this.$toast.success(this.$strings.ToastPlaylistRemoveSuccess)
        })
        .catch((error) => {
          console.error('Failed to remove playlist', error)
          this.$toast.error(this.$strings.ToastRemoveFailed)
        })
        .finally(() => {
          this.processingRemove = false
        })
    },
    clickPlay() {
      const queueItems = []

      // Playlist queue will start at the first unfinished item
      //   if all items are finished then entire playlist is queued
      const itemsWithProgress = this.playableItems.map((item) => {
        return {
          ...item,
          progress: this.$store.getters['user/getUserMediaProgress'](item.libraryItemId, item.episodeId)
        }
      })

      const hasUnfinishedItems = itemsWithProgress.some((i) => !i.progress || !i.progress.isFinished)
      if (!hasUnfinishedItems) {
        console.warn('All items in playlist are finished - starting at first item')
      }

      for (let i = 0; i < itemsWithProgress.length; i++) {
        const playlistItem = itemsWithProgress[i]
        if (!hasUnfinishedItems || !playlistItem.progress || !playlistItem.progress.isFinished) {
          const libraryItem = playlistItem.libraryItem
          if (playlistItem.episode) {
            queueItems.push({
              libraryItemId: libraryItem.id,
              libraryId: libraryItem.libraryId,
              episodeId: playlistItem.episode.id,
              title: playlistItem.episode.title,
              subtitle: libraryItem.media.metadata.title,
              caption: '',
              duration: playlistItem.episode.duration || null,
              coverPath: libraryItem.media.coverPath || null
            })
          } else {
            queueItems.push({
              libraryItemId: libraryItem.id,
              libraryId: libraryItem.libraryId,
              episodeId: null,
              title: libraryItem.media.metadata.title,
              subtitle: libraryItem.media.metadata.authors.map((au) => au.name).join(', '),
              caption: '',
              duration: libraryItem.media.duration || null,
              coverPath: libraryItem.media.coverPath || null
            })
          }
        }
      }

      if (queueItems.length >= 0) {
        this.$eventBus.$emit('play-item', {
          libraryItemId: queueItems[0].libraryItemId,
          episodeId: queueItems[0].episodeId,
          queueItems
        })
      }
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>
