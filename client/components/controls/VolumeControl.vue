<template>
  <div class="relative" v-click-outside="clickOutside" @mouseover="mouseover" @mouseleave="mouseleave">
    <button :aria-label="$strings.LabelVolume" class="text-gray-300 hover:text-white" @mousedown.prevent @mouseup.prevent @click="clickVolumeIcon">
      <span class="material-symbols text-2xl sm:text-3xl">{{ volumeIcon }}</span>
    </button>
    <transition name="menux">
      <div v-show="isOpen" class="volumeMenu absolute bg-bg shadow-xs rounded-lg" :class="isHorizontal ? 'horizontal-menu' : 'vertical-menu'" :style="menuStyle">
        <div ref="volumeTrack" class="bg-gray-500 relative cursor-pointer rounded-full" :class="isHorizontal ? 'horizontal-track' : 'vertical-track'" @mousedown="mousedownTrack" @click="clickVolumeTrack">
          <div class="bg-gray-100 absolute pointer-events-none rounded-full" :class="isHorizontal ? 'horizontal-fill' : 'vertical-fill'" :style="fillStyle" />
          <div class="w-2.5 h-2.5 bg-white shadow-xs rounded-full absolute pointer-events-none" :class="isDragging ? 'transform scale-125 origin-center' : ''" :style="cursorStyle" />
        </div>
      </div>
    </transition>
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
      isHovering: false,
      posY: 0,
      posX: 0,
      lastValue: 0.5,
      isMute: false,
      verticalTrackHeight: 112 - 20,
      horizontalTrackWidth: 112 - 20,
      openTimeout: null
    }
  },
  computed: {
    isHorizontal() {
      // Check if eReader is shown to determine orientation
      return this.$store && this.$store.state && this.$store.state.showEReader
    },
    trackSize() {
      return this.isHorizontal ? this.horizontalTrackWidth : this.verticalTrackHeight
    },
    volume: {
      get() {
        return this.value
      },
      set(val) {
        try {
          localStorage.setItem('volume', val)
        } catch (error) {
          console.error('Failed to store volume', error)
        }
        this.$emit('input', val)
      }
    },
    menuStyle() {
      if (this.isHorizontal) {
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          zIndex: 100
        }
      } else {
        return {
          top: '-116px',
          zIndex: 100
        }
      }
    },
    fillStyle() {
      if (this.isHorizontal) {
        return {
          width: this.volume * this.trackSize + 'px',
          height: '100%',
          left: '0',
          top: '0'
        }
      } else {
        return {
          height: this.volume * this.trackSize + 'px',
          width: '100%',
          left: '0',
          bottom: '0'
        }
      }
    },
    cursorStyle() {
      if (this.isHorizontal) {
        const left = this.volume * this.trackSize - 3
        return {
          left: left + 'px',
          top: '-3px'
        }
      } else {
        const bottom = this.volume * this.trackSize - 3
        return {
          bottom: bottom + 'px',
          left: '-3px'
        }
      }
    },
    volumeIcon() {
      if (this.volume <= 0) return 'volume_mute'
      else if (this.volume <= 0.5) return 'volume_down'
      else return 'volume_up'
    }
  },
  methods: {
    scroll(e) {
      if (!e || !e.wheelDeltaY) return
      if (e.wheelDeltaY > 0) {
        this.volume = Math.min(1, this.volume + 0.1)
      } else {
        this.volume = Math.max(0, this.volume - 0.1)
      }
    },
    mouseover() {
      if (!this.isHovering) {
        window.addEventListener('mousewheel', this.scroll)
      }
      this.isHovering = true
      this.setOpen()
    },
    mouseleave() {
      if (this.isHovering) {
        window.removeEventListener('mousewheel', this.scroll)
      }
      this.isHovering = false
    },
    setOpen() {
      this.isOpen = true
      clearTimeout(this.openTimeout)
      this.openTimeout = setTimeout(() => {
        if (!this.isHovering && !this.isDragging) {
          this.isOpen = false
        } else {
          this.setOpen()
        }
      }, 600)
    },
    mousemove(e) {
      if (this.isHorizontal) {
        // Horizontal movement
        const diff = e.x - this.posX
        this.posX = e.x
        const volShift = diff / this.trackSize
        const newVol = Math.min(Math.max(0, this.volume + volShift), 1)
        this.volume = newVol
      } else {
        // Vertical movement (original logic)
        const diff = this.posY - e.y
        this.posY = e.y
        const volShift = diff / this.trackSize
        const newVol = Math.min(Math.max(0, this.volume + volShift), 1)
        this.volume = newVol
      }
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

      if (this.isHorizontal) {
        this.posX = e.x
        const vol = e.offsetX / this.trackSize
        this.volume = Math.min(Math.max(vol, 0), 1)
      } else {
        this.posY = e.y
        const vol = 1 - e.offsetY / this.trackSize
        this.volume = Math.min(Math.max(vol, 0), 1)
      }

      document.body.addEventListener('mousemove', this.mousemove)
      document.body.addEventListener('mouseup', this.mouseup)
      e.preventDefault()
    },
    clickOutside() {
      this.isOpen = false
    },
    clickVolumeIcon() {
      this.isMute = !this.isMute
      if (this.isMute) {
        this.lastValue = this.volume
        this.volume = 0
      } else {
        this.volume = this.lastValue || 0.5
      }
    },
    toggleMute() {
      this.clickVolumeIcon()
    },
    clickVolumeTrack(e) {
      if (this.isHorizontal) {
        const vol = e.offsetX / this.trackSize
        this.volume = Math.min(Math.max(vol, 0), 1)
      } else {
        const vol = 1 - e.offsetY / this.trackSize
        this.volume = Math.min(Math.max(vol, 0), 1)
      }
    }
  },
  mounted() {
    if (this.value === 0) {
      this.isMute = true
    }
    const storageVolume = localStorage.getItem('volume')
    if (storageVolume && !isNaN(storageVolume)) {
      this.volume = parseFloat(storageVolume)
    }
  },
  beforeDestroy() {
    window.removeEventListener('mousewheel', this.scroll)
    document.body.removeEventListener('mousemove', this.mousemove)
    document.body.removeEventListener('mouseup', this.mouseup)
  }
}
</script>

<style scoped>
.vertical-menu {
  height: 112px;
  width: 24px;
  padding: 8px 0;
}

.horizontal-menu {
  width: 112px;
  height: 24px;
  padding: 0 8px;
}

.vertical-track {
  width: 4px;
  height: 100%;
  margin: 0 10px;
}

.horizontal-track {
  height: 4px;
  width: 100%;
  margin: 10px 0;
}

.vertical-fill {
  width: 100%;
}

.horizontal-fill {
  height: 100%;
}

/* Smooth transitions for orientation changes */
.volumeMenu {
  transition: all 0.3s ease;
}

.menux-enter-active,
.menux-leave-active {
  transition: opacity 0.2s;
}

.menux-enter,
.menux-leave-to {
  opacity: 0;
}
</style>
