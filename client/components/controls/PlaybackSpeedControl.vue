<template>
  <div class="relative ml-8" v-click-outside="clickOutside">
    <div class="flex items-center justify-center text-gray-300 cursor-pointer h-full" @mousedown.prevent @mouseup.prevent @click="showMenu = !showMenu">
      <span class="font-mono uppercase text-gray-200">{{ playbackRate.toFixed(1) }}<span class="text-lg">⨯</span></span>
    </div>
    <div v-show="showMenu" class="absolute -top-10 left-0 z-20 h-9 bg-bg border-black-200 border shadow-xl rounded-lg" style="left: -114px">
      <div class="absolute -bottom-2 left-0 right-0 w-full flex justify-center">
        <div class="arrow-down" />
      </div>

      <div class="w-full h-full no-scroll flex">
        <template v-for="(rate, index) in rates">
          <div :key="rate" class="flex items-center justify-center border-black-300 w-11 hover:bg-black hover:bg-opacity-10 cursor-pointer" :class="index < rates.length - 1 ? 'border-r' : ''" style="min-width: 44px; max-width: 44px" @click="set(rate)">
            <p class="text-xs text-center font-mono">{{ rate.toFixed(1) }}<span class="text-sm">⨯</span></p>
          </div>
        </template>
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
      showMenu: false
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
      return [0.5, 0.8, 1.0, 1.3, 1.5, 2.0]
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
    }
  },
  mounted() {}
}
</script>