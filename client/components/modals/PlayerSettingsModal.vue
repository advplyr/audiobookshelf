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

      <div v-if="!isCasting" class="w-full h-px bg-white/10 my-6"></div>

      <div v-if="!isCasting" class="flex items-center mb-4">
        <ui-toggle-switch v-model="enableSmartSpeed" @input="setEnableSmartSpeed" />
        <div class="pl-4">
          <span>{{ $strings.LabelEnableSmartSpeed || 'Enable Smart Speed' }}</span>
        </div>
      </div>
      <div v-if="!isCasting" class="flex items-center mb-4" :class="{'opacity-50 pointer-events-none': !enableSmartSpeed}">
        <ui-select-input v-model="smartSpeedRatio" :label="$strings.LabelSmartSpeedRatio || 'Smart Speed Compression Ratio'" menuMaxHeight="250px" :items="smartSpeedRatioValues" @input="setSmartSpeedRatio" />
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
      enableSmartSpeed: false,
      smartSpeedRatio: 2.5,
      smartSpeedRatioValues: [
        { text: '1.5x', value: 1.5 },
        { text: '2.0x', value: 2.0 },
        { text: '2.5x', value: 2.5 },
        { text: '3.0x', value: 3.0 },
        { text: '4.0x', value: 4.0 },
        { text: '5.0x', value: 5.0 }
      ]
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
    },
    isCasting() {
      return this.$store.state.globals.isCasting || false
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
    setEnableSmartSpeed() {
      this.$store.commit('user/SET_SMART_SPEED_ENABLED', this.enableSmartSpeed)
    },
    setSmartSpeedRatio(val) {
      this.smartSpeedRatio = val
      this.$store.commit('user/SET_SMART_SPEED_RATIO', val)
    },
    settingsUpdated() {
      this.useChapterTrack = this.$store.getters['user/getUserSetting']('useChapterTrack')
      this.jumpForwardAmount = this.$store.getters['user/getUserSetting']('jumpForwardAmount')
      this.jumpBackwardAmount = this.$store.getters['user/getUserSetting']('jumpBackwardAmount')
      this.playbackRateIncrementDecrement = this.$store.getters['user/getUserSetting']('playbackRateIncrementDecrement')

      const enableSmartSpeed = this.$store.getters['user/getUserSetting']('enableSmartSpeed')
      this.enableSmartSpeed = enableSmartSpeed !== null ? enableSmartSpeed : false

      const smartSpeedRatio = this.$store.getters['user/getUserSetting']('smartSpeedRatio')
      this.smartSpeedRatio = smartSpeedRatio !== null ? smartSpeedRatio : 2.5
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
