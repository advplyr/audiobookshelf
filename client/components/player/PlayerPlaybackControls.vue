<template>
  <div class="flex justify-center pt-4 pb-2 lg:pt-0 lg:pb-2">
    <div class="flex items-center justify-center flex-grow">
      <template v-if="!loading">
        <ui-tooltip direction="top" :text="$strings.ButtonPreviousChapter" class="mr-4 lg:mr-8">
          <button :aria-label="$strings.ButtonPreviousChapter" class="text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="prevChapter">
            <span class="material-symbols text-2xl sm:text-3xl">first_page</span>
          </button>
        </ui-tooltip>
        <ui-tooltip direction="top" :text="jumpBackwardText">
          <button :aria-label="jumpForwardText" class="text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="jumpBackward">
            <span class="material-symbols text-2xl sm:text-3xl">replay</span>
          </button>
        </ui-tooltip>
        <button :aria-label="paused ? $strings.ButtonPlay : $strings.ButtonPause" class="p-2 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-4 lg:mx-8" :class="seekLoading ? 'animate-spin' : ''" @mousedown.prevent @mouseup.prevent @click.stop="playPause">
          <span class="material-symbols fill text-2xl">{{ seekLoading ? 'autorenew' : paused ? 'play_arrow' : 'pause' }}</span>
        </button>
        <ui-tooltip direction="top" :text="jumpForwardText">
          <button :aria-label="jumpForwardText" class="text-gray-300" @mousedown.prevent @mouseup.prevent @click.stop="jumpForward">
            <span class="material-symbols text-2xl sm:text-3xl">forward_media</span>
          </button>
        </ui-tooltip>
        <ui-tooltip direction="top" :text="hasNextLabel" class="ml-4 lg:ml-8">
          <button :aria-label="hasNextLabel" :disabled="!hasNext" class="text-gray-300 disabled:text-gray-500" @mousedown.prevent @mouseup.prevent @click.stop="next">
            <span class="material-symbols text-2xl sm:text-3xl">last_page</span>
          </button>
        </ui-tooltip>
      </template>
      <template v-else>
        <div class="cursor-pointer p-2 shadow-sm bg-accent flex items-center justify-center rounded-full text-primary mx-8 animate-spin">
          <span class="material-symbols text-2xl">autorenew</span>
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
    hasNextItemInQueue: Boolean
  },
  data() {
    return {}
  },
  computed: {
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
