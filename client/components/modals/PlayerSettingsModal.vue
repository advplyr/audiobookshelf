<template>
  <modals-modal v-model="show" name="player-settings" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-4" style="max-height: 80vh; min-height: 40vh">
      <h3 class="text-xl font-semibold mb-8">{{ $strings.HeaderPlayerSettings }}</h3>
      <div class="flex items-center mb-4">
        <ui-toggle-switch v-model="useChapterTrack" @input="setUseChapterTrack" />
        <div class="pl-4">
          <span>{{ $strings.LabelUseChapterTrack }}</span>
        </div>
      </div>
      <div class="flex items-center mb-4">
        <ui-select-input v-model="jumpForwardAmount" :label="$strings.LabelJumpForwardAmount" menuMaxHeight="250px" :items="jumpValues" @input="setJumpForwardAmount" />
      </div>
      <div class="flex items-center mb-4">
        <ui-select-input v-model="jumpBackwardAmount" :label="$strings.LabelJumpBackwardAmount" menuMaxHeight="250px" :items="jumpValues" @input="setJumpBackwardAmount" />
      </div>
      <div class="flex items-center mb-4">
        <ui-select-input v-model="playbackRateIncrementDecrement" :label="$strings.LabelPlaybackRateIncrementDecrement" menuMaxHeight="250px" :items="playbackRateIncrementDecrementValues" @input="setPlaybackRateIncrementDecrementAmount" />
      </div>

      <div class="border-t pt-4 mt-6">
        <h4 class="text-lg font-medium mb-4">{{ $strings.HeaderChapterIntroOutroSkipSettings }}</h4>

        <div class="flex items-center mb-4">
          <ui-toggle-switch v-model="skipIntro" @input="setSkipIntro" />
          <div class="pl-4 flex-1">
            <span>{{ $strings.LabelSkipChapterIntro }}</span>
          </div>
          <ui-text-input v-model="introDuration" type="number" min="0" max="60" @input="setIntroDuration" class="w-20" />
          <span class="ml-2 text-sm text-gray-400">{{ $strings.LabelSeconds }}</span>
        </div>

        <div class="flex items-center mb-4">
          <ui-toggle-switch v-model="skipOutro" @input="setSkipOutro" />
          <div class="pl-4 flex-1">
            <span>{{ $strings.LabelSkipChapterOutro }}</span>
          </div>
          <ui-text-input v-model="outroDuration" type="number" min="0" max="60" @input="setOutroDuration" class="w-20" />
          <span class="ml-2 text-sm text-gray-400">{{ $strings.LabelSeconds }}</span>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean
  },
  data() {
    return {
      useChapterTrack: false,
      jumpValues: [
        { text: this.$getString('LabelTimeDurationXSeconds', ['10']), value: 10 },
        { text: this.$getString('LabelTimeDurationXSeconds', ['15']), value: 15 },
        { text: this.$getString('LabelTimeDurationXSeconds', ['30']), value: 30 },
        { text: this.$getString('LabelTimeDurationXSeconds', ['60']), value: 60 },
        { text: this.$getString('LabelTimeDurationXMinutes', ['2']), value: 120 },
        { text: this.$getString('LabelTimeDurationXMinutes', ['5']), value: 300 }
      ],
      jumpForwardAmount: 10,
      jumpBackwardAmount: 10,
      playbackRateIncrementDecrementValues: [0.1, 0.05],
      playbackRateIncrementDecrement: 0.1,
      skipIntro: false,
      introDuration: 10,
      skipOutro: false,
      outroDuration: 10
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  methods: {
    setUseChapterTrack() {
      this.$store.dispatch('user/updateUserSettings', { useChapterTrack: this.useChapterTrack })
    },
    setJumpForwardAmount(val) {
      this.jumpForwardAmount = val
      this.$store.dispatch('user/updateUserSettings', { jumpForwardAmount: val })
    },
    setJumpBackwardAmount(val) {
      this.jumpBackwardAmount = val
      this.$store.dispatch('user/updateUserSettings', { jumpBackwardAmount: val })
    },
    setPlaybackRateIncrementDecrementAmount(val) {
      this.playbackRateIncrementDecrement = val
      this.$store.dispatch('user/updateUserSettings', { playbackRateIncrementDecrement: val })
    },
    setSkipIntro() {
      this.$store.dispatch('user/updateUserSettings', { skipIntro: this.skipIntro })
    },
    setIntroDuration() {
      this.introDuration = Math.max(0, Math.min(60, parseInt(this.introDuration) || 0))
      this.$store.dispatch('user/updateUserSettings', { introDuration: this.introDuration })
    },
    setSkipOutro() {
      this.$store.dispatch('user/updateUserSettings', { skipOutro: this.skipOutro })
    },
    setOutroDuration() {
      this.outroDuration = Math.max(0, Math.min(60, parseInt(this.outroDuration) || 0))
      this.$store.dispatch('user/updateUserSettings', { outroDuration: this.outroDuration })
    },
    settingsUpdated() {
      this.useChapterTrack = this.$store.getters['user/getUserSetting']('useChapterTrack')
      this.jumpForwardAmount = this.$store.getters['user/getUserSetting']('jumpForwardAmount')
      this.jumpBackwardAmount = this.$store.getters['user/getUserSetting']('jumpBackwardAmount')
      this.playbackRateIncrementDecrement = this.$store.getters['user/getUserSetting']('playbackRateIncrementDecrement')
      this.skipIntro = this.$store.getters['user/getUserSetting']('skipIntro') || false
      this.introDuration = this.$store.getters['user/getUserSetting']('introDuration') || 10
      this.skipOutro = this.$store.getters['user/getUserSetting']('skipOutro') || false
      this.outroDuration = this.$store.getters['user/getUserSetting']('outroDuration') || 10
    }
  },
  mounted() {
    this.settingsUpdated()
    this.$eventBus.$on('user-settings', this.settingsUpdated)
  },
  beforeDestroy() {
    this.$eventBus.$off('user-settings', this.settingsUpdated)
  }
}
</script>
