<template>
  <div ref="box" @mouseover="mouseover" @mouseleave="mouseleave">
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    text: {
      type: [String, Number],
      required: true
    },
    direction: {
      type: String,
      default: 'right'
    },
    /**
     * Delay showing the tooltip after X milliseconds of hovering
     */
    delayOnShow: {
      type: Number,
      default: 0
    },
    disabled: Boolean
  },
  data() {
    return {
      tooltip: null,
      tooltipId: null,
      isShowing: false,
      hideTimeout: null,
      delayOnShowTimeout: null
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
    createTooltip() {
      if (!this.$refs.box) return
      var tooltip = document.createElement('div')
      this.tooltipId = String(Math.floor(Math.random() * 10000))
      tooltip.id = this.tooltipId
      tooltip.className = 'tooltip-wrapper absolute px-2 py-1 text-white text-xs rounded-sm shadow-lg max-w-xs text-center hidden sm:block'
      tooltip.style.zIndex = 100
      tooltip.style.backgroundColor = 'rgba(0,0,0,0.85)'
      tooltip.innerHTML = this.text
      tooltip.addEventListener('mouseover', this.cancelHide)
      tooltip.addEventListener('mouseleave', this.hideTooltip)

      this.setTooltipPosition(tooltip)

      this.tooltip = tooltip
    },
    setTooltipPosition(tooltip) {
      const boxRect = this.$refs.box.getBoundingClientRect()

      const shouldMount = !tooltip.isConnected

      // Calculate size of tooltip
      if (shouldMount) document.body.appendChild(tooltip)
      const tooltipRect = tooltip.getBoundingClientRect()
      if (shouldMount) tooltip.remove()

      // Subtracting scrollbar size
      const windowHeight = window.innerHeight - 8
      const windowWidth = window.innerWidth - 8

      let top = 0
      let left = 0
      if (this.direction === 'right') {
        top = Math.max(0, boxRect.top - tooltipRect.height / 2 + boxRect.height / 2)
        left = Math.max(0, boxRect.left + boxRect.width + 4)
      } else if (this.direction === 'bottom') {
        top = Math.max(0, boxRect.top + boxRect.height + 4)
        left = Math.max(0, boxRect.left - tooltipRect.width / 2 + boxRect.width / 2)
      } else if (this.direction === 'top') {
        top = Math.max(0, boxRect.top - tooltipRect.height - 4)
        left = Math.max(0, boxRect.left - tooltipRect.width / 2 + boxRect.width / 2)
      } else if (this.direction === 'left') {
        top = Math.max(0, boxRect.top - tooltipRect.height / 2 + boxRect.height / 2)
        left = Math.max(0, boxRect.left - tooltipRect.width - 4)
      }

      // Shift left if tooltip would overflow the window on the right
      if (left + tooltipRect.width > windowWidth) {
        left -= left + tooltipRect.width - windowWidth
      }
      // Shift up if tooltip would overflow the window on the bottom
      if (top + tooltipRect.height > windowHeight) {
        top -= top + tooltipRect.height - windowHeight
      }

      tooltip.style.top = top + 'px'
      tooltip.style.left = left + 'px'
    },
    showTooltip() {
      if (this.disabled) return
      if (!this.tooltip) {
        this.createTooltip()
        if (!this.tooltip) return
      }
      if (!this.$refs.box) return // Ensure element is not destroyed
      try {
        document.body.appendChild(this.tooltip)
        this.setTooltipPosition(this.tooltip)
      } catch (error) {
        console.error(error)
      }

      this.isShowing = true
    },
    hideTooltip() {
      if (!this.tooltip) return
      this.tooltip.remove()
      this.isShowing = false
    },
    cancelHide() {
      clearTimeout(this.hideTimeout)
    },
    mouseover() {
      if (this.isShowing || this.disabled) return

      if (this.delayOnShow) {
        if (this.delayOnShowTimeout) {
          // Delay already running
          return
        }

        this.delayOnShowTimeout = setTimeout(() => {
          this.showTooltip()
          this.delayOnShowTimeout = null
        }, this.delayOnShow)
      } else {
        this.showTooltip()
      }
    },
    mouseleave() {
      if (!this.isShowing) {
        clearTimeout(this.delayOnShowTimeout)
        this.delayOnShowTimeout = null
        return
      }

      this.hideTimeout = setTimeout(this.hideTooltip, 100)
    }
  },
  beforeDestroy() {
    this.hideTooltip()
  }
}
</script>
