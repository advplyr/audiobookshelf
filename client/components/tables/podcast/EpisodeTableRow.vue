<template>
  <div class="w-full px-2 py-3 overflow-hidden relative border-b border-white border-opacity-10" @mouseover="mouseover" @mouseleave="mouseleave">
    <div v-if="episode" class="flex items-center h-24">
      <div class="w-12 min-w-12 max-w-16 h-full">
        <div class="flex h-full items-center justify-center">
          <span class="material-icons drag-handle text-lg text-white text-opacity-50 hover:text-opacity-100">menu</span>
        </div>
      </div>
      <div class="flex-grow px-2">
        <p class="text-sm font-semibold">
          {{ title }}
        </p>
        <p class="text-sm text-gray-200 episode-subtitle mt-1.5 mb-0.5">
          {{ description }}
        </p>
        <div class="flex items-center pt-2">
          <div class="h-8 px-4 border border-white border-opacity-20 hover:bg-white hover:bg-opacity-10 rounded-full flex items-center justify-center cursor-pointer" :class="userIsFinished ? 'text-white text-opacity-40' : ''" @click="playClick">
            <span class="material-icons" :class="streamIsPlaying ? '' : 'text-success'">{{ streamIsPlaying ? 'pause' : 'play_arrow' }}</span>
            <p class="pl-2 pr-1 text-sm font-semibold">{{ timeRemaining }}</p>
          </div>

          <ui-tooltip :text="userIsFinished ? 'Mark as Not Finished' : 'Mark as Finished'" direction="top">
            <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" borderless class="mx-1 mt-0.5" @click="toggleFinished" />
          </ui-tooltip>
        </div>
      </div>
      <div class="w-24 min-w-24" />
    </div>
    <div class="w-24 min-w-24 -right-0 absolute top-0 h-full transform transition-transform" :class="!isHovering ? 'translate-x-32' : 'translate-x-0'">
      <div class="flex h-full items-center">
        <div class="mx-1">
          <ui-icon-btn icon="edit" borderless @click="clickEdit" />
        </div>
        <div class="mx-1">
          <ui-icon-btn icon="close" borderless @click="removeClick" />
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
    isDragging: Boolean
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
    audioFile() {
      return this.episode.audioFile
    },
    title() {
      return this.episode.title || ''
    },
    description() {
      if (this.episode.subtitle) return this.episode.subtitle
      var desc = this.episode.description || ''
      return desc
    },
    duration() {
      return this.$secondsToTimestamp(this.episode.duration)
    },
    isStreaming() {
      return this.$store.getters['getIsEpisodeStreaming'](this.libraryItemId, this.episode.id)
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
    clickEdit() {},
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
    toggleFinished() {
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
      this.processingRemove = true

      this.$axios
        .$delete(`/api/items/${this.libraryItemId}/episode/${this.episode.id}`)
        .then((updatedPodcast) => {
          console.log(`Episode removed from podcast`, updatedPodcast)
          this.$toast.success('Episode removed from podcast')
          this.processingRemove = false
        })
        .catch((error) => {
          console.error('Failed to remove episode from podcast', error)
          this.$toast.error('Failed to remove episode from podcast')
          this.processingRemove = false
        })
    }
  },
  mounted() {}
}
</script>