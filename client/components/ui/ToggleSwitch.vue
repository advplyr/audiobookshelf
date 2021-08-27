<template>
  <div>
    <div class="border rounded-full border-black-100 flex items-center cursor-pointer w-12 justify-end" :class="toggleColor" @click="clickToggle">
      <span class="rounded-full border w-6 h-6 border-black-50 bg-white shadow transform transition-transform duration-100" :class="!toggleValue ? '-translate-x-6' : ''"> </span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: Boolean
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
    toggleColor() {
      return this.toggleValue ? 'bg-success' : 'bg-primary'
    }
  },
  methods: {
    clickToggle() {
      console.log('click toggle', this.toggleValue)
      this.toggleValue = !this.toggleValue
    }
  }
}
</script>