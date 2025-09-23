<template>
  <div class="rating-input flex items-center" :aria-label="label" :class="{ 'read-only': readOnly }">
    <div
      v-for="star in 5"
      :key="star"
      class="star-container relative"
      :data-star="star"
      @mouseleave="handleMouseleave"
      @mousemove="handleMousemove"
      @click="handleClick()"
    >
      <template v-if="icon === 'star'">
        <svg class="star star-empty" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
        <svg class="star star-filled absolute top-0 left-0" :style="{ clipPath: getClipPath(star), fill: color, stroke: color }" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      </template>
      <template v-if="icon === 'flame'">
        <ui-flame-icon class="star" :empty="true" />
        <ui-flame-icon class="star star-filled absolute top-0 left-0" :style="{ clipPath: getClipPath(star) }" />
      </template>
    </div>
    <span class="ml-2 text-white/70">{{ displayValue }}/5</span>
  </div>
</template>

<script>
export default {
  name: 'RatingInput',
  props: {
    value: {
      type: Number,
      default: 0
    },
    label: {
      type: String,
      default: 'Rating'
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    icon: {
      type: String,
      default: 'star'
    },
    color: {
      type: String,
      default: '#f59e0b'
    }
  },
  data() {
    return {
      hoverValue: 0
    }
  },
  computed: {
    internalValue() {
      return this.hoverValue > 0 ? this.hoverValue : this.value
    },
    displayValue() {
      return this.value.toFixed(1)
    }
  },
  methods: {
    handleClick() {
      if (this.readOnly) return
      this.$emit('input', this.hoverValue)
    },
    handleMousemove(event) {
      if (this.readOnly) return
      const { left, width } = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - left
      const star = parseInt(event.currentTarget.dataset.star)
      const halfWidth = width / 2
      this.hoverValue = x < halfWidth ? star - 0.5 : star
    },
    handleMouseleave() {
      if (this.readOnly) return
      this.hoverValue = 0
    },
    getClipPath(star) {
      if (this.internalValue >= star) {
        return 'inset(0 0 0 0)'
      } else if (this.internalValue > star - 1 && this.internalValue < star) {
        if (this.internalValue >= star - 0.5) {
          return 'inset(0 50% 0 0)'
        }
      }
      return 'inset(0 100% 0 0)'
    }
  }
}
</script>

<style scoped>
.star {
  width: 24px;
  height: 24px;
  cursor: pointer;
}
.star.read-only {
  cursor: default;
}
.star-empty {
  fill: transparent;
  stroke: #d1d5db;
}
.star-filled {
  stroke-width: 1.5;
}
</style> 