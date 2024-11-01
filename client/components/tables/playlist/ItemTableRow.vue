<template>
  <div class="w-full px-1 md:px-2 py-2 overflow-hidden relative" @mouseover="mouseover" @mouseleave="mouseleave" :class="isHovering ? 'bg-white bg-opacity-5' : ''">
    <div v-if="item" class="flex h-16 md:h-20">
      <div class="w-10 min-w-10 md:w-16 md:max-w-16 h-full">
        <div class="flex h-full items-center justify-center">
          <span class="material-symbols drag-handle text-lg md:text-xl">menu</span>
        </div>
      </div>
      <div class="h-full relative flex items-center" :style="{ width: coverWidth + 'px', minWidth: coverWidth + 'px', maxWidth: coverWidth + 'px' }">
        <covers-book-cover :library-item="libraryItem" :width="coverWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />
        <div class="absolute top-0 left-0 bg-black bg-opacity-50 flex items-center justify-center h-full w-full z-10" v-show="isHovering && showPlayBtn">
          <div class="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-40 cursor-pointer" @click="playClick">
            <span class="material-symbols fill text-2xl">play_arrow</span>
          </div>
        </div>
      </div>
      <div class="flex-grow overflow-hidden max-w-48 md:max-w-md h-full flex items-center px-2 md:px-3">
        <div>
          <div class="truncate max-w-48 md:max-w-md">
            <nuxt-link :to="`/item/${libraryItem.id}`" class="truncate hover:underline text-sm md:text-base">{{ itemTitle }}</nuxt-link>
          </div>
          <div class="truncate max-w-48 md:max-w-md text-xs md:text-sm text-gray-300">
            <template v-for="(author, index) in bookAuthors">
              <nuxt-link :key="author.id" :to="`/author/${author.id}`" class="truncate hover:underline">{{ author.name }}</nuxt-link
              ><span :key="author.id + '-comma'" v-if="index < bookAuthors.length - 1">,&nbsp;</span>
            </template>
            <nuxt-link v-if="episode" :to="`/item/${libraryItem.id}`" class="truncate hover:underline">{{ mediaMetadata.title }}</nuxt-link>
          </div>
          <p class="text-xs md:text-sm text-gray-400">{{ itemDuration }}</p>
        </div>
      </div>
    </div>
    <div class="w-40 absolute top-0 -right-24 h-full transform transition-transform" :class="!isHovering ? 'translate-x-0' : translateDistance">
      <div class="flex h-full items-center">
        <ui-tooltip :text="userIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="top">
          <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" borderless class="mx-1 mt-0.5" @click="toggleFinished" />
        </ui-tooltip>
        <div v-if="userCanUpdate" class="mx-1" :class="isHovering ? '' : 'ml-6'">
          <ui-icon-btn icon="edit" borderless @click="clickEdit" />
        </div>
        <div class="mx-1" :class="isHovering ? '' : 'ml-6'">
          <ui-icon-btn icon="close" borderless @click="removeClick" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    playlistId: String,
    item: {
      type: Object,
      default: () => {}
    },
    isDragging: Boolean,
    bookCoverAspectRatio: Number
  },
  data() {
    return {
      isProcessingReadUpdate: false,
      processingRemove: false,
      isHovering: false
    }
  },
  watch: {
    isDragging: {
      handler(newVal) {
        if (newVal) {
          this.isHovering = false
        }
      }
    }
  },
  computed: {
    translateDistance() {
      if (!this.userCanUpdate) return '-translate-x-12'
      return '-translate-x-24'
    },
    libraryItem() {
      return this.item.libraryItem || {}
    },
    episode() {
      return this.item.episode
    },
    episodeId() {
      return this.episode ? this.episode.id : null
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    tracks() {
      if (this.episode) return []
      return this.media.tracks || []
    },
    itemTitle() {
      if (this.episode) return this.episode.title
      return this.mediaMetadata.title || ''
    },
    bookAuthors() {
      if (this.episode) return []
      return this.mediaMetadata.authors || []
    },
    itemDuration() {
      if (this.episode) return this.$elapsedPretty(this.episode.duration)
      return this.$elapsedPretty(this.media.duration)
    },
    isMissing() {
      return this.libraryItem.isMissing
    },
    isInvalid() {
      return this.libraryItem.isInvalid
    },
    isStreaming() {
      return this.$store.getters['getIsMediaStreaming'](this.libraryItem.id, this.episodeId)
    },
    showPlayBtn() {
      return !this.isMissing && !this.isInvalid && !this.isStreaming && (this.tracks.length || this.episode)
    },
    itemProgress() {
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id, this.episodeId)
    },
    userIsFinished() {
      return this.itemProgress ? !!this.itemProgress.isFinished : false
    },
    coverSize() {
      return this.$store.state.globals.isMobile ? 30 : 50
    },
    coverWidth() {
      if (this.bookCoverAspectRatio === 1) return this.coverSize * 1.6
      return this.coverSize
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    }
  },
  methods: {
    mouseover() {
      if (this.isDragging) return
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    playClick() {
      let queueItem = null
      if (this.episode) {
        queueItem = {
          libraryItemId: this.libraryItem.id,
          libraryId: this.libraryItem.libraryId,
          episodeId: this.episodeId,
          title: this.itemTitle,
          subtitle: this.mediaMetadata.title,
          caption: '',
          duration: this.media.duration || null,
          coverPath: this.media.coverPath || null
        }
      } else {
        queueItem = {
          libraryItemId: this.libraryItem.id,
          libraryId: this.libraryItem.libraryId,
          episodeId: null,
          title: this.itemTitle,
          subtitle: this.bookAuthors.map((au) => au.name).join(', '),
          caption: '',
          duration: this.media.duration || null,
          coverPath: this.media.coverPath || null
        }
      }

      this.$eventBus.$emit('play-item', {
        libraryItemId: this.libraryItem.id,
        episodeId: this.episodeId,
        queueItems: [queueItem]
      })
    },
    clickEdit() {
      this.$emit('edit', this.item)
    },
    toggleFinished() {
      var updatePayload = {
        isFinished: !this.userIsFinished
      }
      this.isProcessingReadUpdate = true

      let routepath = `/api/me/progress/${this.libraryItem.id}`
      if (this.episodeId) routepath += `/${this.episodeId}`

      this.$axios
        .$patch(routepath, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    removeClick() {
      this.processingRemove = true

      let routepath = `/api/playlists/${this.playlistId}/item/${this.libraryItem.id}`
      if (this.episodeId) routepath += `/${this.episodeId}`

      this.$axios
        .$delete(routepath)
        .then((updatedPlaylist) => {
          if (!updatedPlaylist.items.length) {
            console.log(`All items removed so playlist was removed`, updatedPlaylist)
            this.$toast.success(this.$strings.ToastPlaylistRemoveSuccess)
          } else {
            console.log(`Item removed from playlist`, updatedPlaylist)
            this.$toast.success(this.$strings.ToastPlaylistUpdateSuccess)
          }
        })
        .catch((error) => {
          console.error('Failed to remove item from playlist', error)
          this.$toast.error(this.$strings.ToastFailedToUpdate)
        })
        .finally(() => {
          this.processingRemove = false
        })
    }
  },
  mounted() {}
}
</script>
