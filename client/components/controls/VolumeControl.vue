<template>
  <div class="relative" v-click-outside="clickOutside">
    <div class="cursor-pointer" @mousedown.prevent @mouseup.prevent @click="clickVolumeIcon">
      <span class="material-icons text-3xl">volume_up</span>
    </div>
    <div v-show="isOpen" class="absolute bottom-10 left-0 h-28 py-2 bg-white shadow-sm rounded-lg">
      <div ref="volumeTrack" class="w-2 border-2 border-white h-full bg-gray-400 mx-4 relative cursor-pointer" @mousedown="mousedownTrack" @click="clickVolumeTrack">
        <div class="w-3 h-3 bg-gray-500 shadow-sm rounded-full absolute -left-1 bottom-0 pointer-events-none" :class="isDragging ? 'transform scale-150' : ''" :style="{ top: cursorTop + 'px' }" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: Number
  },
  data() {
    return {
      isOpen: false,
      isDragging: false,
      posY: 0,
      trackHeight: 112 - 16
    }
  },
  computed: {
    volume: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    cursorTop() {
      var top = this.trackHeight * this.volume
      return top - 6
    }
  },
  methods: {
    mousemove(e) {
      var diff = this.posY - e.y
      this.posY = e.y
      var volShift = 0
      if (diff < 0) {
        // Volume up
        volShift = diff / this.trackHeight
      } else {
        // volume down
        volShift = diff / this.trackHeight
      }
      var newVol = this.volume - volShift
      newVol = Math.min(Math.max(0, newVol), 1)
      this.volume = newVol
      e.preventDefault()
    },
    mouseup(e) {
      if (this.isDragging) {
        this.isDragging = false
        document.body.removeEventListener('mousemove', this.mousemove)
        document.body.removeEventListener('mouseup', this.mouseup)
      }
    },
    mousedownTrack(e) {
      this.isDragging = true
      this.posY = e.y
      var vol = e.offsetY / e.target.clientHeight
      vol = Math.min(Math.max(vol, 0), 1)
      this.volume = vol
      document.body.addEventListener('mousemove', this.mousemove)
      document.body.addEventListener('mouseup', this.mouseup)
      e.preventDefault()
    },
    clickOutside() {
      this.isOpen = false
    },
    clickVolumeIcon() {
      this.isOpen = !this.isOpen
    },
    clickVolumeTrack(e) {
      var vol = e.offsetY / e.target.clientHeight
      vol = Math.min(Math.max(vol, 0), 1)
      this.volume = vol
    }
  },
  mounted() {}
}
</script>