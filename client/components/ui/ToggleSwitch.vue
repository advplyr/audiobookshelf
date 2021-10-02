<template>
  <div>
    <div class="border rounded-full border-black-100 flex items-center cursor-pointer w-12 justify-start" :class="className" @click="clickToggle">
      <span class="rounded-full border w-6 h-6 border-black-50 shadow transform transition-transform duration-100" :class="switchClassName"></span>
    </div>
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
    disabled: Boolean
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
      return this.toggleValue ? 'translate-x-6 ' + bgColor : bgColor
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