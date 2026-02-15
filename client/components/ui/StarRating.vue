<template>
  <div class="flex items-center" :class="{ 'cursor-pointer': !readonly }">
    <div v-for="n in 5" :key="n" class="relative px-0.5" @mouseenter="hoverStar(n)" @mouseleave="hoverStar(0)" @click="setRating(n)">
      <span class="material-symbols text-yellow-400" :style="{ fontSize: size + 'px' }" :class="{ fill: n <= displayRating }">star</span>
    </div>
  </div>
</template>

<script>
/**
 * A reusable 5-star rating component.
 * Supports read-only display and interactive rating selection.
 * 
 * @emit input - Emits the selected rating (1-5)
 */
export default {
  props: {
    /** The current rating value (1-5) */
    value: {
      type: Number,
      default: 0
    },
    /** If true, the rating cannot be changed */
    readonly: {
      type: Boolean,
      default: false
    },
    /** The size of the stars in pixels */
    size: {
      type: Number,
      default: 24
    }
  },
  data() {
    return {
      hoverRating: 0
    }
  },
  computed: {
    displayRating() {
      return this.hoverRating || this.value
    }
  },
  methods: {
    hoverStar(n) {
      if (this.readonly) return
      this.hoverRating = n
    },
    setRating(n) {
      if (this.readonly) return
      this.$emit('input', n)
    }
  }
}
</script>

<style scoped>
.material-symbols {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.material-symbols.fill {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
