<template>
  <div ref="wrapper" class="modal modal-bg w-full h-full fixed top-0 left-0 bg-primary items-center justify-center opacity-0 hidden" :class="`z-${zIndex} bg-opacity-${bgOpacity}`">
    <div class="absolute top-0 left-0 right-0 w-full h-36 bg-gradient-to-t from-transparent via-black-500 to-black-700 opacity-90 pointer-events-none" />

    <div class="absolute top-5 right-5 h-12 w-12 flex items-center justify-center cursor-pointer text-white hover:text-gray-300" @click="clickClose">
      <span class="material-icons text-4xl">close</span>
    </div>
    <slot name="outer" />
    <div ref="content" style="min-width: 400px; min-height: 200px" class="relative text-white" :style="{ height: modalHeight, width: modalWidth, marginTop: contentMarginTop + 'px' }" v-click-outside="clickBg">
      <slot />
      <div v-if="processing" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-black bg-opacity-60 rounded-lg flex items-center justify-center">
        <ui-loading-indicator />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    name: String,
    value: Boolean,
    processing: Boolean,
    persistent: {
      type: Boolean,
      default: true
    },
    width: {
      type: [String, Number],
      default: 500
    },
    height: {
      type: [String, Number],
      default: 'unset'
    },
    contentMarginTop: {
      type: Number,
      default: 50
    },
    zIndex: {
      type: Number,
      default: 40
    },
    bgOpacity: {
      type: Number,
      default: 75
    }
  },
  data() {
    return {
      el: null,
      content: null
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.$nextTick(this.setShow)
      } else {
        this.setHide()
      }
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
    modalHeight() {
      if (typeof this.height === 'string') {
        return this.height
      } else {
        return this.height + 'px'
      }
    },
    modalWidth() {
      return typeof this.width === 'string' ? this.width : this.width + 'px'
    }
  },
  methods: {
    clickClose() {
      this.show = false
    },
    clickBg(ev) {
      if (this.processing && this.persistent) return
      if (ev.srcElement.classList.contains('modal-bg')) {
        this.show = false
      }
    },
    hotkey(action) {
      if (action === this.$hotkeys.Modal.CLOSE) {
        this.show = false
      }
    },
    setShow() {
      if (!this.el || !this.content) {
        this.init()
      }
      if (!this.el || !this.content) {
        return
      }

      document.body.appendChild(this.el)
      setTimeout(() => {
        this.content.style.transform = 'scale(1)'
      }, 10)
      document.documentElement.classList.add('modal-open')

      this.$eventBus.$on('modal-hotkey', this.hotkey)
      this.$store.commit('setOpenModal', this.name)
    },
    setHide() {
      if (this.content) this.content.style.transform = 'scale(0)'
      if (this.el) this.el.remove()
      document.documentElement.classList.remove('modal-open')

      this.$eventBus.$off('modal-hotkey', this.hotkey)
      this.$store.commit('setOpenModal', null)
    },
    init() {
      this.el = this.$refs.wrapper
      this.content = this.$refs.content
      if (this.content && this.el) {
        this.el.classList.remove('hidden')
        this.el.classList.add('flex')
        this.content.style.transform = 'scale(0)'
        this.content.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        this.el.style.opacity = 1
        this.el.remove()
      } else {
        console.warn('Invalid modal init', this.name)
      }
    }
  },
  mounted() {}
}
</script>