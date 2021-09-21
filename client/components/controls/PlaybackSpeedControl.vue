<template>
  <div class="relative ml-8" v-click-outside="clickOutside">
    <div class="flex items-center justify-center text-gray-300 cursor-pointer h-full" @mousedown.prevent @mouseup.prevent @click="showMenu = !showMenu">
      <span class="font-mono uppercase text-gray-200">{{ playbackRate.toFixed(1) }}<span class="text-lg">⨯</span></span>
    </div>
    <div v-show="showMenu" class="absolute -top-10 left-0 z-20 h-9 bg-bg border-black-200 border shadow-xl rounded-lg" style="left: -114px">
      <div class="absolute -bottom-2 left-0 right-0 w-full flex justify-center">
        <div class="arrow-down" />
      </div>

      <div class="w-full h-full no-scroll flex px-7 relative overflow-hidden">
        <div class="absolute left-0 top-0 h-full w-7 border-r border-black-300 bg-black-300 rounded-l-lg flex items-center justify-center cursor-pointer" :class="rateIndex === 0 ? 'bg-black-400 text-gray-400' : 'hover:bg-black-200'" @mousedown.prevent @mouseup.prevent @click="leftArrowClick">
          <span class="material-icons" style="font-size: 1.2rem">chevron_left</span>
        </div>
        <div class="overflow-hidden relative" style="width: 220px">
          <div class="flex items-center h-full absolute top-0 left-0 transition-transform duration-100" :style="{ transform: `translateX(${xPos}px)` }">
            <template v-for="rate in rates">
              <div :key="rate" class="h-full border-black-300 w-11 cursor-pointer border-r" :class="value === rate ? 'bg-black-100' : 'hover:bg-black hover:bg-opacity-10'" style="min-width: 44px; max-width: 44px" @click="set(rate)">
                <div class="w-full h-full flex justify-center items-center">
                  <p class="text-xs text-center font-mono">{{ rate }}<span class="text-sm">⨯</span></p>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="absolute top-0 right-0 h-full w-7 bg-black-300 rounded-r-lg flex items-center justify-center cursor-pointer" :class="rateIndex === rates.length - numVisible ? 'bg-black-400 text-gray-400' : 'hover:bg-black-200'" @mousedown.prevent @mouseup.prevent @click="rightArrowClick">
          <span class="material-icons" style="font-size: 1.2rem">chevron_right</span>
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
      rateIndex: 1,
      numVisible: 5
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
      return [0.25, 0.5, 0.8, 1, 1.3, 1.5, 2, 2.5, 3]
    },
    xPos() {
      return -1 * this.rateIndex * 44
    }
  },
  methods: {
    clickOutside() {
      this.showMenu = false
    },
    set(rate) {
      var newPlaybackRate = Number(rate)
      var hasChanged = this.playbackRate !== newPlaybackRate
      this.playbackRate = newPlaybackRate
      if (hasChanged) this.$emit('change', newPlaybackRate)
      this.showMenu = false
    },
    leftArrowClick() {
      this.rateIndex = Math.max(0, this.rateIndex - 1)
    },
    rightArrowClick() {
      this.rateIndex = Math.min(this.rates.length - this.numVisible, this.rateIndex + 1)
    }
  },
  mounted() {}
}
</script>