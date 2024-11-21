<template>
  <div ref="wrapper" class="modal modal-bg w-full h-full fixed top-0 left-0 bg-primary bg-opacity-75 flex items-center justify-center z-40 opacity-0">
    <div class="absolute top-0 left-0 right-0 w-full h-36 bg-gradient-to-t from-transparent via-black-500 to-black-700 opacity-90 pointer-events-none" />
    <div ref="content" style="min-width: 400px; min-height: 200px" class="relative text-white" :style="{ height: modalHeight, width: modalWidth }">
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: Boolean,
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
        this.setShow()
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
    setShow() {
      document.body.appendChild(this.el)
      setTimeout(() => {
        this.content.style.transform = 'scale(1)'
      }, 10)
    },
    setHide() {
      this.content.style.transform = 'scale(0)'
      this.el.remove()
    }
  },
  mounted() {
    this.el = this.$refs.wrapper
    this.content = this.$refs.content
    this.content.style.transform = 'scale(0)'
    this.content.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    this.el.style.opacity = 1
    this.el.remove()
  }
}
</script>