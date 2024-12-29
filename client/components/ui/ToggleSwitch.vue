<template>
  <div>
    <button :aria-labelledby="labeledBy" :aria-label="label" role="checkbox" type="button" class="border rounded-full border-black-100 flex items-center cursor-pointer justify-start" :style="{ width: buttonWidth + 'px' }" :aria-checked="toggleValue" :class="className" @click="clickToggle">
      <span class="rounded-full border border-black-50 shadow transform transition-transform duration-100" :style="{ width: cursorHeightWidth + 'px', height: cursorHeightWidth + 'px' }" :class="switchClassName"></span>
    </button>
  </div>
</template>

<script>
export default {
  props: {
    value: Boolean,
    onColor: {
      type: String,
      default: 'success'
    },
    offColor: {
      type: String,
      default: 'primary'
    },
    disabled: Boolean,
    labeledBy: String,
    label: String,
    size: {
      type: String,
      default: 'md'
    }
  },
  computed: {
    toggleValue: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    className() {
      if (this.disabled) return this.toggleValue ? `bg-${this.onColor} cursor-not-allowed` : `bg-${this.offColor} cursor-not-allowed`
      return this.toggleValue ? `bg-${this.onColor}` : `bg-${this.offColor}`
    },
    switchClassName() {
      var bgColor = this.disabled ? 'bg-gray-300' : 'bg-white'
      return this.toggleValue ? 'translate-x-5 ' + bgColor : bgColor
    },
    cursorHeightWidth() {
      if (this.size === 'sm') return 16
      return 20
    },
    buttonWidth() {
      return this.cursorHeightWidth * 2
    }
  },
  methods: {
    clickToggle() {
      if (this.disabled) return
      this.toggleValue = !this.toggleValue
    }
  }
}
</script>