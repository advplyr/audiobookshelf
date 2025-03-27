<template>
  <div :class="`${classList}`" class="flex items-center justify-center">
    <span class="abs-icons" :class="`icon-${iconToUse}`"></span>
  </div>
</template>

<script>
export default {
  props: {
    icon: {
      type: String,
      default: 'audiobookshelf'
    },
    fontSize: {
      type: String,
      default: 'text-lg'
    },
    size: {
      type: Number,
      default: 5
    }
  },
  data() {
    return {}
  },
  computed: {
    classList() {
      switch (this.size) {
        case 6:
          return `h-6 w-6 min-w-6 ${this.fontSize}`
        default:
          return `h-5 w-5 min-w-5 ${this.fontSize}`
      }
    },
    iconToUse() {
      return this.icons.includes(this.icon) ? this.icon : 'audiobookshelf'
    },
    icons() {
      return this.$store.state.globals.libraryIcons
    }
  },
  methods: {},
  mounted() {}
}
</script>