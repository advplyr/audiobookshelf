<template>
  <modals-modal v-model="show" name="player-shortcuts" :width="560" :height="'unset'" :z-index="110">
    <div class="w-full rounded-lg bg-bg box-shadow-md p-6 overflow-y-auto" style="max-height: 80vh">
      <p class="text-lg font-semibold mb-5">{{ $strings.HeaderKeyboardShortcuts }}</p>

      <div v-for="group in groups" :key="group.title" class="mb-5 last:mb-0">
        <p class="text-xs uppercase tracking-widest text-gray-400 mb-2">{{ group.title }}</p>
        <div class="rounded-lg overflow-hidden border border-white/5">
          <div v-for="(row, index) in group.rows" :key="row.label" class="flex items-center gap-3 px-3 py-2.5" :class="index % 2 ? 'bg-white/2' : ''">
            <span class="text-sm text-gray-200 grow min-w-0 truncate">{{ row.label }}</span>
            <div class="flex items-center gap-1.5 shrink-0">
              <template v-for="(combo, comboIndex) in row.combos">
                <span v-if="comboIndex" :key="`sep-${comboIndex}`" class="text-xs text-gray-600">/</span>
                <span :key="`combo-${comboIndex}`" class="flex items-center gap-1">
                  <kbd v-for="key in combo" :key="key" class="shortcut-key">{{ key }}</kbd>
                </span>
              </template>
            </div>
          </div>
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
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    hotkeys() {
      return this.$hotkeys.AudioPlayer
    },
    // Built from the hotkey constants rather than hardcoded strings, so rebinding
    // a key in plugins/constants.js updates this list instead of silently lying.
    groups() {
      const h = this.hotkeys
      return [
        {
          title: this.$strings.HeaderPlayback,
          rows: [
            { label: `${this.$strings.ButtonPlay} / ${this.$strings.ButtonPause}`, combos: [this.combo(h.PLAY_PAUSE)] },
            { label: this.$strings.ButtonJumpBackward, combos: [this.combo(h.JUMP_BACKWARD)] },
            { label: this.$strings.ButtonJumpForward, combos: [this.combo(h.JUMP_FORWARD)] }
          ]
        },
        {
          title: this.$strings.LabelVolume,
          rows: [
            { label: this.$strings.LabelVolume, combos: [this.combo(h.VOLUME_UP), this.combo(h.VOLUME_DOWN)] },
            { label: this.$strings.LabelMuteUnmute, combos: [this.combo(h.MUTE_UNMUTE)] }
          ]
        },
        {
          title: this.$strings.LabelPlaybackSpeed,
          rows: [
            { label: this.$strings.ButtonFaster, combos: [this.combo(h.INCREASE_PLAYBACK_RATE), this.combo(h.INCREASE_PLAYBACK_RATE_STEP)] },
            { label: this.$strings.ButtonSlower, combos: [this.combo(h.DECREASE_PLAYBACK_RATE), this.combo(h.DECREASE_PLAYBACK_RATE_STEP)] }
          ]
        },
        {
          title: this.$strings.HeaderView,
          rows: [
            { label: this.$strings.LabelViewChapters, combos: [this.combo(h.SHOW_CHAPTERS)] },
            { label: this.$strings.HeaderKeyboardShortcuts, combos: [this.combo(h.SHOW_SHORTCUTS)] },
            { label: this.$strings.LabelClosePlayer, combos: [this.combo(h.CLOSE)] }
          ]
        }
      ]
    }
  },
  methods: {
    // 'Shift-ArrowUp' -> ['Shift', '↑']
    combo(hotkey) {
      if (!hotkey) return []
      // Shift+Slash is '?' on the layouts this targets - showing "Shift /" reads worse
      if (hotkey === 'Shift-Slash') return ['?']
      return hotkey.split('-').map(this.keyLabel)
    },
    keyLabel(key) {
      const labels = {
        ArrowUp: '↑',
        ArrowDown: '↓',
        ArrowLeft: '←',
        ArrowRight: '→',
        Escape: 'Esc',
        Comma: ',',
        Period: '.',
        Slash: '/'
      }
      if (labels[key]) return labels[key]
      // KeyL -> L
      if (key.startsWith('Key')) return key.slice(3)
      return key
    }
  }
}
</script>

<style scoped>
.shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.4rem;
  border-radius: 0.375rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom-width: 2px;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  color: #e5e7eb;
  white-space: nowrap;
}
</style>
