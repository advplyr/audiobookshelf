<template>
  <modals-modal v-model="show" name="player-settings" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-4" style="max-height: 80vh; min-height: 40vh">
      <h3 class="text-xl font-semibold mb-8">Player Settings</h3>
      <div class="flex items-center mb-4">
        <ui-toggle-switch v-model="useChapterTrack" @input="setUseChapterTrack" />
        <div class="pl-4"><span>Use Chapter Track</span></div>
      </div>
      <div class="flex items-center mb-4">
        <ui-dropdown v-model="jumpForwardAmount" :label="$strings.LabelJumpForwardAmount" :value="jumpForwardAmount" :items="jumpValues" @input="setJumpForwardAmount" />
      </div>
      <div class="flex items-center">
        <ui-dropdown v-model="jumpBackwardAmount" :label="$strings.LabelJumpBackwardAmount" :value="jumpBackwardAmount" :items="jumpValues" @input="setJumpBackwardAmount" />
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
        { text: '10 seconds', value: 10 },
        { text: '15 seconds', value: 15 },
        { text: '30 seconds', value: 30 },
        { text: '1 minute', value: 60 },
        { text: '2 minutes', value: 120 },
        { text: '5 minutes', value: 300 }
      ],
      jumpForwardAmount: 10,
      jumpBackwardAmount: 10
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
    }
  },
  mounted() {
    this.useChapterTrack = this.$store.getters['user/getUserSetting']('useChapterTrack')
    this.jumpForwardAmount = this.$store.getters['user/getUserSetting']('jumpForwardAmount')
    this.jumpBackwardAmount = this.$store.getters['user/getUserSetting']('jumpBackwardAmount')
  }
}
</script>