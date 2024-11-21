<template>
  <div class="w-full bg-primary bg-opacity-40">
    <div class="w-full h-14 flex items-center px-4 md:px-6 py-2 bg-primary">
      <p class="pr-4">{{ $strings.HeaderPlaylistItems }}</p>

      <div class="w-6 h-6 md:w-7 md:h-7 bg-white bg-opacity-10 rounded-full flex items-center justify-center">
        <span class="text-xs md:text-sm font-mono leading-none">{{ items.length }}</span>
      </div>
      <div class="flex-grow" />
      <p v-if="totalDuration" class="text-sm text-gray-200">{{ totalDurationPretty }}</p>
    </div>
    <draggable v-model="itemsCopy" v-bind="dragOptions" class="list-group" handle=".drag-handle" draggable=".item" tag="div" @start="drag = true" @end="drag = false" @update="draggableUpdate">
      <transition-group type="transition" :name="!drag ? 'playlist-item' : null">
        <template v-for="(item, index) in itemsCopy">
          <tables-playlist-item-table-row :key="index" :is-dragging="drag" :item="item" :playlist-id="playlistId" :book-cover-aspect-ratio="bookCoverAspectRatio" class="item" :class="drag ? '' : 'playlist-item-item'" @edit="editItem" />
        </template>
      </transition-group>
    </draggable>
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  props: {
    playlistId: String,
    items: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      drag: false,
      dragOptions: {
        animation: 200,
        group: 'description',
        ghostClass: 'ghost'
      },
      itemsCopy: []
    }
  },
  watch: {
    items: {
      handler(newVal) {
        this.init()
      }
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    totalDuration() {
      var _total = 0
      this.items.forEach((item) => {
        if (item.episode) _total += item.episode.duration
        else _total += item.libraryItem.media.duration
      })
      return _total
    },
    totalDurationPretty() {
      return this.$elapsedPrettyExtended(this.totalDuration)
    }
  },
  methods: {
    editItem(playlistItem) {
      if (playlistItem.episode) {
        const episodeIds = this.items.map((pi) => pi.episodeId)
        this.$store.commit('setEpisodeTableEpisodeIds', episodeIds)
        this.$store.commit('setSelectedLibraryItem', playlistItem.libraryItem)
        this.$store.commit('globals/setSelectedEpisode', playlistItem.episode)
        this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
      } else {
        const itemIds = this.items.map((i) => i.libraryItemId)
        this.$store.commit('setBookshelfBookIds', itemIds)
        this.$store.commit('showEditModal', playlistItem.libraryItem)
      }
    },
    draggableUpdate() {
      var playlistUpdate = {
        items: this.itemsCopy.map((i) => ({ libraryItemId: i.libraryItemId, episodeId: i.episodeId }))
      }
      this.$axios
        .$patch(`/api/playlists/${this.playlistId}`, playlistUpdate)
        .then((playlist) => {
          console.log('Playlist updated', playlist)
        })
        .catch((error) => {
          console.error('Failed to update playlist', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
    },
    init() {
      this.itemsCopy = this.items.map((i) => ({ ...i }))
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
.playlist-item-item {
  transition: all 0.4s ease;
}

.playlist-item-enter-from,
.playlist-item-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.playlist-item-leave-active {
  position: absolute;
}
</style>
