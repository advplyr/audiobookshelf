<template>
  <div class="relative ml-8" v-click-outside="clickOutside">
    <div class="flex items-center justify-center text-gray-300 cursor-pointer h-full" @mousedown.prevent @mouseup.prevent @click="setShowMenu(true)">
      <span class="font-mono uppercase text-gray-200">{{ playbackRate.toFixed(1) }}<span class="text-lg">⨯</span></span>
    </div>
    <div v-show="showMenu" class="absolute -top-20 left-0 z-20 bg-bg border-black-200 border shadow-xl rounded-lg" style="left: -92px">
      <div class="absolute -bottom-2 left-0 right-0 w-full flex justify-center">
        <div class="arrow-down" />
      </div>
      <div class="flex items-center h-9 relative overflow-hidden rounded-lg" style="width: 220px">
        <template v-for="rate in rates">
          <div :key="rate" class="h-full border-black-300 w-11 cursor-pointer border rounded-sm" :class="value === rate ? 'bg-black-100' : 'hover:bg-black hover:bg-opacity-10'" style="min-width: 44px; max-width: 44px" @click="set(rate)">
            <div class="w-full h-full flex justify-center items-center">
              <p class="text-xs text-center font-mono">{{ rate }}<span class="text-sm">⨯</span></p>
            </div>
          </div>
        </template>
      </div>
      <div class="w-full py-1 px-4">
        <div class="flex items-center justify-between">
          <ui-icon-btn :disabled="!canDecrement" icon="remove" @click="decrement" />
          <p class="px-2 text-3xl">{{ playbackRate }}<span class="text-2xl">⨯</span></p>
          <ui-icon-btn :disabled="!canIncrement" icon="add" @click="increment" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: [String, Number],
      default: 1
    }
  },
  data() {
    return {
      showMenu: false,
      currentPlaybackRate: 0,
      MIN_SPEED: 0.5,
      MAX_SPEED: 3
    }
  },
  computed: {
    playbackRate: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    rates() {
      return [0.5, 1, 1.2, 1.5, 2]
    },
    canIncrement() {
      return this.playbackRate + 0.1 <= this.MAX_SPEED
    },
    canDecrement() {
      return this.playbackRate - 0.1 >= this.MIN_SPEED
    }
  },
  methods: {
    clickOutside() {
      this.setShowMenu(false)
    },
    set(rate) {
      this.playbackRate = Number(rate)
      this.$nextTick(() => this.setShowMenu(false))
    },
    increment() {
      if (this.playbackRate + 0.1 > this.MAX_SPEED) return
      var newPlaybackRate = this.playbackRate + 0.1
      this.playbackRate = Number(newPlaybackRate.toFixed(1))
    },
    decrement() {
      if (this.playbackRate - 0.1 < this.MIN_SPEED) return
      var newPlaybackRate = this.playbackRate - 0.1
      this.playbackRate = Number(newPlaybackRate.toFixed(1))
    },
    setShowMenu(val) {
      if (val) {
        this.currentPlaybackRate = this.playbackRate
      } else if (this.currentPlaybackRate !== this.playbackRate) {
        this.$emit('change', this.playbackRate)
      }
      this.showMenu = val
    }
  },
  mounted() {
    this.currentPlaybackRate = this.playbackRate
  }
}
</script>