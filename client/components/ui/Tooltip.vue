<template>
  <div ref="box" class="tooltip-box" @mouseover="mouseover" @mouseleave="mouseleave">
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      required: true
    },
    direction: {
      type: String,
      default: 'right'
    }
  },
  data() {
    return {
      tooltip: null,
      isShowing: false
    }
  },
  watch: {
    text() {
      this.updateText()
    }
  },
  methods: {
    updateText() {
      if (this.tooltip) {
        this.tooltip.innerHTML = this.text
      }
    },
    createTooltip() {
      if (!this.$refs.box) return
      var boxChow = this.$refs.box.getBoundingClientRect()
      var top = 0
      var left = 0
      if (this.direction === 'right') {
        top = boxChow.top
        left = boxChow.left + boxChow.width + 4
      } else if (this.direction === 'bottom') {
        top = boxChow.top + boxChow.height + 4
        left = boxChow.left
      } else if (this.direction === 'top') {
        top = boxChow.top - 24
        left = boxChow.left
      }
      var tooltip = document.createElement('div')
      tooltip.className = 'absolute px-2 bg-black bg-opacity-90 py-1 text-white pointer-events-none text-xs rounded shadow-lg'
      tooltip.style.top = top + 'px'
      tooltip.style.left = left + 'px'
      tooltip.style.zIndex = 100
      tooltip.innerHTML = this.text
      this.tooltip = tooltip
    },
    showTooltip() {
      if (!this.tooltip) {
        this.createTooltip()
      }
      document.body.appendChild(this.tooltip)
      this.isShowing = true
    },
    hideTooltip() {
      if (!this.tooltip) return
      this.tooltip.remove()
      this.isShowing = false
    },
    mouseover() {
      if (!this.isShowing) this.showTooltip()
    },
    mouseleave() {
      if (this.isShowing) this.hideTooltip()
    }
  },
  beforeDestroy() {
    this.hideTooltip()
  }
}
</script>
