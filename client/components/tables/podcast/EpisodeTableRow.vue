<template>
  <div class="w-full px-2 py-3 overflow-hidden relative border-b border-white border-opacity-10" @mouseover="mouseover" @mouseleave="mouseleave">
    <div v-if="episode" class="flex items-center cursor-pointer" :class="{ 'opacity-70': isSelected || selectionMode }" @click="clickedEpisode">
      <div class="flex-grow px-2">
        <div class="flex items-center">
          <span class="text-sm font-semibold">{{ title }}</span>
          <widgets-podcast-type-indicator :type="episode.episodeType" />
        </div>

        <p class="text-sm text-gray-200 episode-subtitle mt-1.5 mb-0.5" v-html="subtitle"></p>
        <div class="flex justify-between pt-2 max-w-xl">
          <p v-if="episode.season" class="text-sm text-gray-300">Season #{{ episode.season }}</p>
          <p v-if="episode.episode" class="text-sm text-gray-300">Episode #{{ episode.episode }}</p>
          <p v-if="episode.chapters?.length" class="text-sm text-gray-300">{{ episode.chapters.length }} Chapters</p>
          <p v-if="publishedAt" class="text-sm text-gray-300">Published {{ $formatDate(publishedAt, dateFormat) }}</p>
        </div>

        <div class="flex items-center pt-2">
          <button class="h-8 px-4 border border-white border-opacity-20 hover:bg-white hover:bg-opacity-10 rounded-full flex items-center justify-center cursor-pointer focus:outline-none" :class="userIsFinished ? 'text-white text-opacity-40' : ''" @click.stop="playClick">
            <span class="material-icons text-2xl" :class="streamIsPlaying ? '' : 'text-success'">{{ streamIsPlaying ? 'pause' : 'play_arrow' }}</span>
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
      <div v-if="isHovering || isSelected || selectionMode" class="hidden md:block w-12 min-w-12" />
    </div>
    <div v-if="isSelected || selectionMode" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-10 z-10 cursor-pointer" @click.stop="clickedSelectionBg" />
    <div class="hidden md:block md:w-12 md:min-w-12 md:-right-0 md:absolute md:top-0 h-full transform transition-transform z-20" :class="!isHovering && !isSelected && !selectionMode ? 'translate-x-24' : 'translate-x-0'">
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
    libraryItemId: String,
    episode: {
      type: Object,
      default: () => {}
    },
    selectionMode: Boolean
  },
  data() {
    return {
      isProcessingReadUpdate: false,
      processingRemove: false,
      isHovering: false,
      isSelected: false
    }
  },
  computed: {
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    audioFile() {
      return this.episode.audioFile
    },
    title() {
      return this.episode.title || ''
    },
    subtitle() {
      return this.episode.subtitle || this.description
    },
    description() {
      return this.episode.description || ''
    },
    duration() {
      return this.$secondsToTimestamp(this.episode.duration)
    },
    libraryItemIdStreaming() {
      return this.$store.getters['getLibraryItemIdStreaming']
    },
    isStreamingFromDifferentLibrary() {
      return this.$store.getters['getIsStreamingFromDifferentLibrary']
    },
    isStreaming() {
      return this.$store.getters['getIsMediaStreaming'](this.libraryItemId, this.episode.id)
    },
    isQueued() {
      return this.$store.getters['getIsMediaQueued'](this.libraryItemId, this.episode.id)
    },
    streamIsPlaying() {
      return this.$store.state.streamIsPlaying && this.isStreaming
    },
    itemProgress() {
      return this.$store.getters['user/getUserMediaProgress'](this.libraryItemId, this.episode.id)
    },
    itemProgressPercent() {
      return this.itemProgress ? this.itemProgress.progress : 0
    },
    userIsFinished() {
      return this.itemProgress ? !!this.itemProgress.isFinished : false
    },
    timeRemaining() {
      if (this.streamIsPlaying) return 'Playing'
      if (!this.itemProgress) return this.$elapsedPretty(this.episode.duration)
      if (this.userIsFinished) return 'Finished'
      var remaining = Math.floor(this.itemProgress.duration - this.itemProgress.currentTime)
      return `${this.$elapsedPretty(remaining)} left`
    },
    publishedAt() {
      return this.episode.publishedAt
    },
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    }
  },
  methods: {
    clickAddToPlaylist() {
      this.$emit('addToPlaylist', this.episode)
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
    clickEdit() {
      this.$emit('edit', this.episode)
    },
    playClick() {
      if (this.streamIsPlaying) {
        this.$eventBus.$emit('pause-item')
      } else {
        this.$emit('play', this.episode)
      }
    },
    toggleFinished(confirmed = false) {
      if (!this.userIsFinished && this.itemProgressPercent > 0 && !confirmed) {
        const payload = {
          message: `Are you sure you want to mark "${this.title}" as finished?`,
          callback: (confirmed) => {
            if (confirmed) {
              this.toggleFinished(true)
            }
          },
          type: 'yesNo'
        }
        this.$store.commit('globals/setConfirmPrompt', payload)
        return
      }

      var updatePayload = {
        isFinished: !this.userIsFinished
      }
      this.isProcessingReadUpdate = true
      this.$axios
        .$patch(`/api/me/progress/${this.libraryItemId}/${this.episode.id}`, updatePayload)
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
      this.$emit('remove', this.episode)
    },
    queueBtnClick() {
      if (this.isQueued) {
        // Remove from queue
        this.$store.commit('removeItemFromQueue', { libraryItemId: this.libraryItemId, episodeId: this.episode.id })
      } else {
        // Add to queue
        this.$emit('addToQueue', this.episode)
      }
    }
  }
}
</script>
