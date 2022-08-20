<template>
  <div :class="`h-${size} w-${size} min-w-${size}`">
    <component :is="iconComponentName" />
  </div>
</template>

<script>
export default {
  props: {
    icon: String,
    size: {
      type: Number,
      default: 5
    }
  },
  data() {
    return {}
  },
  computed: {
    iconComponentName() {
      if (this.icon === 'default') return `icons-database-svg`
      return `icons-${this.icon}-svg`
    }
  },
  methods: {},
  mounted() {}
}
</script>