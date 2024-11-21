<template>
  <div :id="`lazy-episode-${index}`" class="w-full h-full cursor-pointer" @mouseover="mouseover" @mouseleave="mouseleave">
    <div class="flex" @click="clickedEpisode">
      <div class="flex-grow">
        <div dir="auto" class="flex items-center">
          <span class="text-sm font-semibold">{{ episodeTitle }}</span>
          <widgets-podcast-type-indicator :type="episodeType" />
        </div>

        <div class="h-10 flex items-center mt-1.5 mb-0.5 overflow-hidden">
          <p class="text-sm text-gray-200 line-clamp-2" v-html="episodeSubtitle"></p>
        </div>
        <div class="h-8 flex items-center">
          <div class="w-full inline-flex justify-between max-w-xl">
            <p v-if="episode?.season" class="text-sm text-gray-300">{{ $getString('LabelSeasonNumber', [episode.season]) }}</p>
            <p v-if="episode?.episode" class="text-sm text-gray-300">{{ $getString('LabelEpisodeNumber', [episode.episode]) }}</p>
            <p v-if="episode?.chapters?.length" class="text-sm text-gray-300">{{ $getString('LabelChapterCount', [episode.chapters.length]) }}</p>
            <p v-if="publishedAt" class="text-sm text-gray-300">{{ $getString('LabelPublishedDate', [$formatDate(publishedAt, dateFormat)]) }}</p>
          </div>
        </div>

        <div class="flex items-center pt-2">
          <button class="h-8 px-4 border border-white border-opacity-20 hover:bg-white hover:bg-opacity-10 rounded-full flex items-center justify-center cursor-pointer focus:outline-none" :class="userIsFinished ? 'text-white text-opacity-40' : ''" @click.stop="playClick">
            <span class="material-symbols fill text-2xl" :class="streamIsPlaying ? '' : 'text-success'">{{ streamIsPlaying ? 'pause' : 'play_arrow' }}</span>
            <p class="pl-2 pr-1 text-sm font-semibold">{{ timeRemaining }}</p>
          </button>

          <ui-tooltip v-if="libraryItemIdStreaming && !isStreamingFromDifferentLibrary" :text="isQueued ? $strings.MessageRemoveFromPlayerQueue : $strings.MessageAddToPlayerQueue" :class="isQueued ? 'text-success' : ''" direction="top">
            <ui-icon-btn :icon="isQueued ? 'playlist_add_check' : 'playlist_play'" borderless @click="queueBtnClick" />
          </ui-tooltip>

          <ui-tooltip :text="userIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="top">
            <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" borderless class="mx-1 mt-0.5" @click="toggleFinished" />
          </ui-tooltip>

          <ui-tooltip :text="$strings.LabelYourPlaylists" direction="top">
            <ui-icon-btn icon="playlist_add" borderless @click="clickAddToPlaylist" />
          </ui-tooltip>

          <ui-icon-btn v-if="userCanUpdate" icon="edit" borderless @click="clickEdit" />
          <ui-icon-btn v-if="userCanDelete" icon="close" borderless @click="removeClick" />
        </div>
      </div>
      <div v-if="isHovering || isSelected || isSelectionMode" class="hidden md:block w-12 min-w-12" />
    </div>

    <div v-if="isSelected || isSelectionMode" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-10 z-10 cursor-pointer" @click.stop="clickedSelectionBg" />
    <div class="hidden md:block md:w-12 md:min-w-12 md:-right-0 md:absolute md:top-0 h-full transform transition-transform z-20" :class="!isHovering && !isSelected && !isSelectionMode ? 'translate-x-24' : 'translate-x-0'">
      <div class="flex h-full items-center">
        <div class="mx-1">
          <ui-checkbox v-model="isSelected" @input="selectedUpdated" checkbox-bg="bg" />
        </div>
      </div>
    </div>

    <div v-if="!userIsFinished" class="absolute bottom-0 left-0 h-0.5 bg-warning" :style="{ width: itemProgressPercent * 100 + '%' }" />
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    libraryItemId: String,
    episode: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      isProcessingReadUpdate: false,
      processingRemove: false,
      isHovering: false,
      isSelected: false,
      isSelectionMode: false
    }
  },
  computed: {
    store() {
      return this.$store || this.$nuxt.$store
    },
    axios() {
      return this.$axios || this.$nuxt.$axios
    },
    userCanUpdate() {
      return this.store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.store.getters['user/getUserCanDelete']
    },
    episodeId() {
      return this.episode?.id || ''
    },
    episodeTitle() {
      return this.episode?.title || ''
    },
    episodeSubtitle() {
      return this.episode?.subtitle || ''
    },
    episodeType() {
      return this.episode?.episodeType || ''
    },
    publishedAt() {
      return this.episode?.publishedAt
    },
    dateFormat() {
      return this.store.state.serverSettings.dateFormat
    },
    itemProgress() {
      return this.store.getters['user/getUserMediaProgress'](this.libraryItemId, this.episodeId)
    },
    itemProgressPercent() {
      return this.itemProgress?.progress || 0
    },
    userIsFinished() {
      return !!this.itemProgress?.isFinished
    },
    libraryItemIdStreaming() {
      return this.store.getters['getLibraryItemIdStreaming']
    },
    isStreamingFromDifferentLibrary() {
      return this.store.getters['getIsStreamingFromDifferentLibrary']
    },
    isStreaming() {
      return this.store.getters['getIsMediaStreaming'](this.libraryItemId, this.episodeId)
    },
    isQueued() {
      return this.store.getters['getIsMediaQueued'](this.libraryItemId, this.episodeId)
    },
    streamIsPlaying() {
      return this.store.state.streamIsPlaying && this.isStreaming
    },
    timeRemaining() {
      if (this.streamIsPlaying) return this.$strings.ButtonPlaying
      if (!this.itemProgress) return this.$elapsedPretty(this.episode?.duration || 0)
      if (this.userIsFinished) return this.$strings.LabelFinished

      const duration = this.itemProgress.duration || this.episode?.duration || 0
      const remaining = Math.floor(duration - this.itemProgress.currentTime)
      return this.$getString('LabelTimeLeft', [this.$elapsedPretty(remaining)])
    }
  },
  methods: {
    setSelectionMode(isSelectionMode) {
      this.isSelectionMode = isSelectionMode
      if (!this.isSelectionMode) this.isSelected = false
    },
    clickedEpisode() {
      this.$emit('view', this.episode)
    },
    clickedSelectionBg() {
      this.isSelected = !this.isSelected
      this.selectedUpdated(this.isSelected)
    },
    selectedUpdated(value) {
      this.$emit('selected', { isSelected: value, episode: this.episode })
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    playClick() {
      if (this.streamIsPlaying) {
        const eventBus = this.$eventBus || this.$nuxt.$eventBus
        eventBus.$emit('pause-item')
      } else {
        this.$emit('play', this.episode)
      }
    },
    queueBtnClick() {
      if (this.isQueued) {
        // Remove from queue
        this.store.commit('removeItemFromQueue', { libraryItemId: this.libraryItemId, episodeId: this.episodeId })
      } else {
        // Add to queue
        this.$emit('addToQueue', this.episode)
      }
    },
    toggleFinished(confirmed = false) {
      if (!this.userIsFinished && this.itemProgressPercent > 0 && !confirmed) {
        const payload = {
          message: this.$getString('MessageConfirmMarkItemFinished', [this.episodeTitle]),
          callback: (confirmed) => {
            if (confirmed) {
              this.toggleFinished(true)
            }
          },
          type: 'yesNo'
        }
        this.store.commit('globals/setConfirmPrompt', payload)
        return
      }

      const updatePayload = {
        isFinished: !this.userIsFinished
      }
      this.isProcessingReadUpdate = true
      this.axios
        .$patch(`/api/me/progress/${this.libraryItemId}/${this.episodeId}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          const toast = this.$toast || this.$nuxt.$toast
          toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    clickAddToPlaylist() {
      this.$emit('addToPlaylist', this.episode)
    },
    clickEdit() {
      this.$emit('edit', this.episode)
    },
    removeClick() {
      this.$emit('remove', this.episode)
    },
    destroy() {
      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      if (this.$el && this.$el.parentNode) {
        this.$el.parentNode.removeChild(this.$el)
      } else if (this.$el && this.$el.remove) {
        this.$el.remove()
      }
    }
  },
  mounted() {}
}
</script>
