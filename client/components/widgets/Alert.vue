<template>
  <div class="w-full bg-opacity-5 border border-opacity-60 rounded-lg flex items-center relative py-4 pl-16" :class="wrapperClass">
    <div class="absolute top-0 left-4 h-full flex items-center">
      <span class="material-symbols text-2xl">{{ icon }}</span>
    </div>
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    type: {
      type: String,
      default: 'error'
    }
  },
  data() {
    return {}
  },
  computed: {
    icon() {
      if (this.type === 'error' || this.type === 'warning') return 'report'
      return 'info'
    },
    wrapperClass() {
      return `bg-${this.type} border-${this.type} text-${this.type}`
    }
  },
  methods: {},
  mounted() {}
}
</script>
