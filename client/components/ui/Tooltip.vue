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
    }
  },
  data() {
    return {
      tooltip: null,
      isShowing: false
    }
  },
  methods: {
    createTooltip() {
      var boxChow = this.$refs.box.getBoundingClientRect()
      var top = boxChow.top
      var left = boxChow.left + boxChow.width + 4

      var tooltip = document.createElement('div')
      tooltip.className = 'absolute px-2 bg-black bg-opacity-60 py-1 text-white pointer-events-none text-xs'
      tooltip.style.top = top + 'px'
      tooltip.style.left = left + 'px'
      tooltip.style.zIndex = 100
      tooltip.innerText = this.text
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
