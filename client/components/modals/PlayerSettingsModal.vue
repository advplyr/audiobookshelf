<template>
  <modals-modal v-model="show" name="player-settings" :width="500" :height="'unset'">
    <div ref="container" class="w-full rounded-lg bg-bg box-shadow-md overflow-y-auto overflow-x-hidden p-4" style="max-height: 80vh">
      <h3 class="text-xl font-semibold mb-4">Player Settings</h3>
      <div class="flex items-center">
        <ui-toggle-switch v-model="useChapterTrack" @input="setUseChapterTrack" />
        <div class="pl-4"><span>Use Chapter Track</span></div>
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
      useChapterTrack: false
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
    setUseChapterTrack(val) {
      this.$store.dispatch('user/updateUserSettings', { useChapterTrack: this.useChapterTrack })
    }
  },
  mounted() {
    this.useChapterTrack = this.$store.state.user.settings.useChapterTrack
  }
}
</script>