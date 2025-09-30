<template>
  <div ref="wrapper" class="relative ml-4 sm:ml-8" v-click-outside="clickOutside">
    <div class="flex items-center justify-center text-gray-300 cursor-pointer h-full" @mousedown.prevent @mouseup.prevent @click="setShowMenu(true)">
      <span class="text-themed text-sm sm:text-base">{{ playbackRateDisplay }}<span class="text-base">x</span></span>
    </div>
    <div v-show="showMenu" class="absolute z-20 bg-bg border-black-200 border shadow-xl rounded-lg" :style="{ left: menuLeft + 'px', top: menuTop + 'px' }">
      <div class="absolute w-full flex justify-center" :style="{ left: arrowLeft + 'px', [arrowPosition]: '-6px' }">
        <div :class="arrowPosition === 'top' ? 'arrow-up' : 'arrow-down'" />
      </div>
      <div class="flex items-center relative overflow-hidden rounded-lg" :style="{ width: '220px', height: menuHeight + 'px' }">
        <template v-for="rate in rates">
          <div :key="rate" class="border-black-300 w-11 cursor-pointer border rounded-xs" :class="value === rate ? 'bg-black-100' : 'hover:bg-black/10'" :style="{ minWidth: '44px', maxWidth: '44px', height: menuHeight + 'px' }" @click="set(rate)">
            <div class="w-full h-full flex justify-center items-center">
              <p class="text-xs text-center">{{ rate }}<span class="text-sm">x</span></p>
            </div>
          </div>
        </template>
      </div>
      <div class="w-full py-1 px-1">
        <div class="flex items-center justify-between">
          <ui-icon-btn :disabled="!canDecrement" icon="remove" @click="decrement" />
          <p class="px-2 text-2xl sm:text-3xl">{{ playbackRateDisplay }}<span class="text-2xl">x</span></p>
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
    },
    playbackRateIncrementDecrement: {
      type: Number,
      default: 0.1
    }
  },
  data() {
    return {
      showMenu: false,
      currentPlaybackRate: 0,
      MIN_SPEED: 0.5,
      MAX_SPEED: 10,
      menuLeft: -96,
      arrowLeft: 0,
      menuTop: -88, // Default top position
      arrowPosition: 'bottom' // 'top' or 'bottom'
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
      return this.playbackRate + this.playbackRateIncrementDecrement <= this.MAX_SPEED
    },
    canDecrement() {
      return this.playbackRate - this.playbackRateIncrementDecrement >= this.MIN_SPEED
    },
    playbackRateDisplay() {
      if (this.playbackRateIncrementDecrement == 0.05) return this.playbackRate.toFixed(2)
      // For 0.1 increment: Only show 2 decimal places if the playback rate is 2 decimals
      const numDecimals = String(this.playbackRate).split('.')[1]?.length || 0
      if (numDecimals <= 1) return this.playbackRate.toFixed(1)
      return this.playbackRate.toFixed(2)
    },
    showEReader() {
      return this.$store.state.showEReader
    },
    menuHeight() {
      return this.showEReader ? 18 : 36 // Half height when eReader is shown
    }
  },
  watch: {
    showEReader() {
      if (this.showMenu) {
        this.updateMenuPositions()
      }
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
      if (this.playbackRate + this.playbackRateIncrementDecrement > this.MAX_SPEED) return
      var newPlaybackRate = this.playbackRate + this.playbackRateIncrementDecrement
      this.playbackRate = Number(newPlaybackRate.toFixed(2))
    },
    decrement() {
      if (this.playbackRate - this.playbackRateIncrementDecrement < this.MIN_SPEED) return
      var newPlaybackRate = this.playbackRate - this.playbackRateIncrementDecrement
      this.playbackRate = Number(newPlaybackRate.toFixed(2))
    },
    updateMenuPositions() {
      if (!this.$refs.wrapper) return
      const boundingBox = this.$refs.wrapper.getBoundingClientRect()

      // Calculate horizontal position
      if (boundingBox.left + 110 > window.innerWidth - 10) {
        this.menuLeft = window.innerWidth - 230 - boundingBox.left
        this.arrowLeft = Math.abs(this.menuLeft) - 96
      } else {
        this.menuLeft = -96
        this.arrowLeft = 0
      }

      // Calculate vertical position based on eReader state
      if (this.showEReader) {
        // When eReader is shown, position menu with margin bottom zero (at the bottom of the trigger)
        this.menuTop = 0
        this.arrowPosition = 'top'
      } else {
        // Default position (above the trigger)
        this.menuTop = -88
        this.arrowPosition = 'bottom'
      }
    },
    setShowMenu(val) {
      if (val) {
        this.updateMenuPositions()
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

<style scoped>
.arrow-down {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--color-bg);
}

.arrow-up {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid var(--color-bg);
}
</style>
