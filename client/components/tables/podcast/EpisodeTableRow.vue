<template>
  <div class="w-full px-2 py-3 overflow-hidden relative border-b border-white border-opacity-10" @mouseover="mouseover" @mouseleave="mouseleave">
    <div v-if="episode" class="flex items-center h-24 cursor-pointer" @click="$emit('view', episode)">
      <div class="flex-grow px-2">
        <p class="text-sm font-semibold">
          {{ title }}
        </p>

        <p class="text-sm text-gray-200 episode-subtitle mt-1.5 mb-0.5">{{ subtitle }}</p>

        <div class="flex items-center pt-2">
          <button class="h-8 px-4 border border-white border-opacity-20 hover:bg-white hover:bg-opacity-10 rounded-full flex items-center justify-center cursor-pointer focus:outline-none" :class="userIsFinished ? 'text-white text-opacity-40' : ''" @click.stop="playClick">
            <span class="material-icons" :class="streamIsPlaying ? '' : 'text-success'">{{ streamIsPlaying ? 'pause' : 'play_arrow' }}</span>
            <p class="pl-2 pr-1 text-sm font-semibold">{{ timeRemaining }}</p>
          </button>

          <ui-tooltip :text="userIsFinished ? 'Mark as Not Finished' : 'Mark as Finished'" direction="top">
            <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" borderless class="mx-1 mt-0.5" @click="toggleFinished" />
          </ui-tooltip>
          <p v-if="episode.season" class="px-4 text-sm text-gray-300">Season #{{ episode.season }}</p>
          <p v-if="episode.episode" class="px-4 text-sm text-gray-300">Episode #{{ episode.episode }}</p>
          <p v-if="publishedAt" class="px-4 text-sm text-gray-300">Published {{ $formatDate(publishedAt, 'MMM do, yyyy') }}</p>
        </div>
      </div>
      <div class="w-24 min-w-24" />
    </div>
    <div class="w-24 min-w-24 -right-0 absolute top-0 h-full transform transition-transform" :class="!isHovering ? 'translate-x-32' : 'translate-x-0'">
      <div class="flex h-full items-center">
        <div class="mx-1">
          <ui-icon-btn v-if="userCanUpdate" icon="edit" borderless @click="clickEdit" />
        </div>
        <div class="mx-1">
          <ui-icon-btn v-if="userCanDelete" icon="close" borderless @click="removeClick" />
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
    }
  },
  data() {
    return {
      isProcessingReadUpdate: false,
      processingRemove: false,
      isHovering: false
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
      return this.episode.subtitle || ''
    },
    description() {
      return this.episode.description || ''
    },
    duration() {
      return this.$secondsToTimestamp(this.episode.duration)
    },
    isStreaming() {
      return this.$store.getters['getIsMediaStreaming'](this.libraryItemId, this.episode.id)
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
    }
  },
  methods: {
    mouseover() {
      // if (this.isDragging) return
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
        this.$eventBus.$emit('play-item', {
          libraryItemId: this.libraryItemId,
          episodeId: this.episode.id
        })
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
          this.$toast.success(`Item marked as ${updatePayload.isFinished ? 'Finished' : 'Not Finished'}`)
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          this.$toast.error(`Failed to mark as ${updatePayload.isFinished ? 'Finished' : 'Not Finished'}`)
        })
    },
    removeClick() {
      this.$emit('remove', this.episode)
    }
  }
}
</script>