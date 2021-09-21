<template>
  <div ref="box" @mouseover="mouseover" @mouseleave="mouseleave">
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
    },
    disabled: Boolean
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
    },
    disabled(newVal) {
      if (newVal && this.isShowing) {
        this.hideTooltip()
      }
    }
  },
  methods: {
    updateText() {
      if (this.tooltip) {
        this.tooltip.innerHTML = this.text
        this.setTooltipPosition(this.tooltip)
      }
    },
    getTextWidth() {
      var styles = {
        'font-size': '0.75rem'
      }
      var size = this.$calculateTextSize(this.text, styles)
      console.log('Text Size', size.width, size.height)
      return size.width
    },
    createTooltip() {
      if (!this.$refs.box) return
      var tooltip = document.createElement('div')
      tooltip.className = 'absolute px-2 py-1 text-white pointer-events-none text-xs rounded shadow-lg max-w-xs'
      tooltip.style.zIndex = 100
      tooltip.style.backgroundColor = 'rgba(0,0,0,0.75)'
      tooltip.innerHTML = this.text

      this.setTooltipPosition(tooltip)

      this.tooltip = tooltip
    },
    setTooltipPosition(tooltip) {
      var boxChow = this.$refs.box.getBoundingClientRect()

      var shouldMount = !tooltip.isConnected
      // Calculate size of tooltip
      if (shouldMount) document.body.appendChild(tooltip)
      var { width, height } = tooltip.getBoundingClientRect()
      if (shouldMount) tooltip.remove()

      var top = 0
      var left = 0
      if (this.direction === 'right') {
        top = boxChow.top - height / 2 + boxChow.height / 2
        left = boxChow.left + boxChow.width + 4
      } else if (this.direction === 'bottom') {
        top = boxChow.top + boxChow.height + 4
        left = boxChow.left - width / 2 + boxChow.width / 2
      } else if (this.direction === 'top') {
        top = boxChow.top - height - 4
        left = boxChow.left - width / 2 + boxChow.width / 2
      } else if (this.direction === 'left') {
        top = boxChow.top - height / 2 + boxChow.height / 2
        left = boxChow.left - width - 4
      }
      tooltip.style.top = top + 'px'
      tooltip.style.left = left + 'px'
    },
    showTooltip() {
      if (this.disabled) return
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
