<template>
  <div class="flex pt-4 pb-2 md:pt-0 md:pb-2">
    <div class="flex-grow" />
    <template v-if="!loading">
      <button :aria-label="$strings.ButtonPreviousChapter" class="flex items-center justify-center text-gray-300 mr-4 md:mr-8" @mousedown.prevent @mouseup.prevent @click.stop="prevChapter">
        <span class="material-icons text-2xl sm:text-3xl">first_page</span>
      </button>
      <button :aria-label="$strings.ButtonJumpBackward" class="flex items-center justify-center text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="jumpBackward">
        <span class="material-icons text-2xl sm:text-3xl">replay_10</span>
      </button>
      <button :aria-label="paused ? $strings.ButtonPlay : $strings.ButtonPause" class="p-2 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-4 md:mx-8" :class="seekLoading ? 'animate-spin' : ''" @mousedown.prevent @mouseup.prevent @click.stop="playPause">
        <span class="material-icons text-2xl">{{ seekLoading ? 'autorenew' : paused ? 'play_arrow' : 'pause' }}</span>
      </button>
      <button :aria-label="$strings.ButtonJumpForward" class="flex items-center justify-center text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="jumpForward">
        <span class="material-icons text-2xl sm:text-3xl">forward_10</span>
      </button>
      <button :aria-label="$strings.ButtonNextChapter" class="flex items-center justify-center ml-4 md:ml-8" :disabled="!hasNextChapter" :class="hasNextChapter ? 'text-gray-300' : 'text-gray-500'" @mousedown.prevent @mouseup.prevent @click.stop="nextChapter">
        <span class="material-icons text-2xl sm:text-3xl">last_page</span>
      </button>
      <controls-playback-speed-control v-model="playbackRateInput" @input="playbackRateUpdated" @change="playbackRateChanged" />
    </template>
    <template v-else>
      <div class="cursor-pointer p-2 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-8 animate-spin">
        <span class="material-icons">autorenew</span>
      </div>
    </template>
    <div class="flex-grow" />
  </div>
</template>

<script>
export default {
  props: {
    loading: Boolean,
    seekLoading: Boolean,
    playbackRate: Number,
    paused: Boolean,
    hasNextChapter: Boolean
  },
  data() {
    return {}
  },
  computed: {
    playbackRateInput: {
      get() {
        return this.playbackRate
      },
      set(val) {
        this.$emit('update:playbackRate', val)
      }
    }
  },
  methods: {
    playPause() {
      this.$emit('playPause')
    },
    prevChapter() {
      this.$emit('prevChapter')
    },
    nextChapter() {
      if (!this.hasNextChapter) return
      this.$emit('nextChapter')
    },
    jumpBackward() {
      this.$emit('jumpBackward')
    },
    jumpForward() {
      this.$emit('jumpForward')
    },
    playbackRateUpdated(playbackRate) {
      this.$emit('setPlaybackRate', playbackRate)
    },
    playbackRateChanged(playbackRate) {
      this.$emit('setPlaybackRate', playbackRate)
      this.$store.dispatch('user/updateUserSettings', { playbackRate }).catch((err) => {
        console.error('Failed to update settings', err)
      })
    }
  },
  mounted() {}
}
</script>