<template>
  <div class="flex justify-center pt-4 pb-2 lg:pt-0 lg:pb-2">
    <div class="flex items-center justify-center grow">
      <template v-if="!loading">
        <ui-tooltip direction="top" :disabled="noTooltips" :text="$strings.ButtonPreviousChapter" :class="large ? 'mr-6 lg:mr-10' : 'mr-4 lg:mr-8'">
          <button :aria-label="$strings.ButtonPreviousChapter" class="ctrl-btn text-gray-300 hover:text-white" @mousedown.prevent @mouseup.prevent @click.stop="prevChapter">
            <span class="material-symbols" :class="large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'">first_page</span>
          </button>
        </ui-tooltip>
        <ui-tooltip direction="top" :disabled="noTooltips" :text="jumpBackwardText">
          <button :aria-label="jumpBackwardText" class="ctrl-btn text-gray-300 hover:text-white" @mousedown.prevent @mouseup.prevent @click.stop="jumpBackward">
            <span class="material-symbols" :class="large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'">replay</span>
          </button>
        </ui-tooltip>
        <button :aria-label="paused ? $strings.ButtonPlay : $strings.ButtonPause" class="ctrl-play shadow-xs flex items-center justify-center rounded-full mx-4 lg:mx-8" :class="[seekLoading ? 'animate-spin' : '', whitePlayButton ? 'bg-white text-black' : 'bg-accent text-primary', large ? 'p-4' : 'p-2']" @mousedown.prevent @mouseup.prevent @click.stop="playPause">
          <span :key="playIcon" class="material-symbols fill ctrl-play-icon" :class="large ? 'text-4xl' : 'text-2xl'">{{ playIcon }}</span>
        </button>
        <ui-tooltip direction="top" :disabled="noTooltips" :text="jumpForwardText">
          <button :aria-label="jumpForwardText" class="ctrl-btn text-gray-300 hover:text-white" @mousedown.prevent @mouseup.prevent @click.stop="jumpForward">
            <span class="material-symbols" :class="large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'">forward_media</span>
          </button>
        </ui-tooltip>
        <ui-tooltip direction="top" :disabled="noTooltips" :text="hasNextLabel" :class="large ? 'ml-6 lg:ml-10' : 'ml-4 lg:ml-8'">
          <button :aria-label="hasNextLabel" :disabled="!hasNext" class="ctrl-btn text-gray-300 hover:text-white disabled:text-gray-500" @mousedown.prevent @mouseup.prevent @click.stop="next">
            <span class="material-symbols" :class="large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'">last_page</span>
          </button>
        </ui-tooltip>
      </template>
      <template v-else>
        <div class="cursor-pointer shadow-xs flex items-center justify-center rounded-full mx-8 animate-spin" :class="[whitePlayButton ? 'bg-white text-black' : 'bg-accent text-primary', large ? 'p-4' : 'p-2']">
          <span class="material-symbols" :class="large ? 'text-4xl' : 'text-2xl'">autorenew</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    loading: Boolean,
    seekLoading: Boolean,
    paused: Boolean,
    hasNextChapter: Boolean,
    hasNextItemInQueue: Boolean,
    large: Boolean,
    whitePlayButton: Boolean,
    noTooltips: Boolean
  },
  data() {
    return {}
  },
  computed: {
    playIcon() {
      if (this.seekLoading) return 'autorenew'
      return this.paused ? 'play_arrow' : 'pause'
    },
    jumpForwardText() {
      return this.getJumpText('jumpForwardAmount', this.$strings.ButtonJumpForward)
    },
    jumpBackwardText() {
      return this.getJumpText('jumpBackwardAmount', this.$strings.ButtonJumpBackward)
    },
    hasNextLabel() {
      if (this.hasNextItemInQueue && !this.hasNextChapter) return this.$strings.ButtonNextItemInQueue
      return this.$strings.ButtonNextChapter
    },
    hasNext() {
      return this.hasNextItemInQueue || this.hasNextChapter
    }
  },
  methods: {
    playPause() {
      this.$emit('playPause')
    },
    prevChapter() {
      this.$emit('prevChapter')
    },
    next() {
      if (!this.hasNext) return
      this.$emit('next')
    },
    jumpBackward() {
      this.$emit('jumpBackward')
    },
    jumpForward() {
      this.$emit('jumpForward')
    },
    getJumpText(setting, prefix) {
      const amount = this.$store.getters['user/getUserSetting'](setting)
      if (!amount) return prefix

      let formattedTime = ''
      if (amount <= 60) {
        formattedTime = this.$getString('LabelTimeDurationXSeconds', [amount])
      } else {
        const minutes = Math.floor(amount / 60)
        formattedTime = this.$getString('LabelTimeDurationXMinutes', [minutes])
      }

      return `${prefix} - ${formattedTime}`
    }
  },
  mounted() {}
}
</script>

<style scoped>
/* Secondary controls: color change only, no motion */
.ctrl-btn {
  transition: color 0.15s ease;
}

/* Play/pause: springy press + icon swap morph */
.ctrl-play {
  transition: transform 0.28s cubic-bezier(0.34, 1.45, 0.64, 1), box-shadow 0.2s ease;
}
.ctrl-play:hover {
  transform: scale(1.08);
}
.ctrl-play:active {
  transform: scale(0.9);
  transition-duration: 0.1s;
}
.ctrl-play-icon {
  display: inline-block;
  animation: ctrl-icon-pop 0.26s cubic-bezier(0.34, 1.45, 0.64, 1);
}
@keyframes ctrl-icon-pop {
  from {
    opacity: 0;
    transform: scale(0.55);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ctrl-play,
  .ctrl-play-icon {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
</style>
