<template>
  <div class="w-full border rounded-lg flex items-center relative py-4 pl-16" :class="wrapperClass">
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
      switch (this.type) {
        case 'error':
          return 'bg-error/5 border-error/60 text-error'
        case 'warning':
          return 'bg-warning/5 border-warning/60 text-warning'
        case 'success':
          return 'bg-success/5 border-success/60 text-success'
        case 'info':
          return 'bg-info/5 border-info/60 text-info'
        default:
          return 'bg-primary/5 border-primary/60 text-primary'
      }
    }
  },
  methods: {},
  mounted() {}
}
</script>
