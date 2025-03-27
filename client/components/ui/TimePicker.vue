<template>
  <div tabindex="0" @focus="focusDigit('second0')" class="relative">
    <div class="rounded-sm text-gray-200 border w-full px-3 py-2" :class="focusedDigit ? 'bg-primary/50 border-gray-300' : 'bg-primary border-gray-600'" @click="clickInput" v-click-outside="clickOutsideObj">
      <div class="flex items-center">
        <template v-for="(digit, index) in digitDisplay">
          <div v-if="digit == ':'" :key="index" class="px-px" @click.stop="clickMedian(index)">:</div>
          <div v-else :key="index" class="px-px" :class="{ 'digit-focused': focusedDigit == digit }" @click.stop="focusDigit(digit)">{{ digits[digit] }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    showThreeDigitHour: Boolean
  },
  data() {
    return {
      clickOutsideObj: {
        handler: this.clickOutside,
        events: ['mousedown'],
        isActive: true
      },
      digitDisplay: ['hour1', 'hour0', ':', 'minute1', 'minute0', ':', 'second1', 'second0'],
      focusedDigit: null,
      digits: {
        hour2: 0,
        hour1: 0,
        hour0: 0,
        minute1: 0,
        minute0: 0,
        second1: 0,
        second0: 0
      },
      isOver99Hours: false
    }
  },
  watch: {
    value: {
      immediate: true,
      handler() {
        this.initDigits()
      }
    }
  },
  computed: {},
  methods: {
    initDigits() {
      var totalSeconds = !this.value || isNaN(this.value) ? 0 : Number(this.value)
      totalSeconds = Math.round(totalSeconds)

      var minutes = Math.floor(totalSeconds / 60)
      var seconds = totalSeconds - minutes * 60
      var hours = Math.floor(minutes / 60)
      minutes -= hours * 60

      this.digits.second1 = seconds <= 9 ? 0 : Number(String(seconds)[0])
      this.digits.second0 = seconds <= 9 ? seconds : Number(String(seconds)[1])

      this.digits.minute1 = minutes <= 9 ? 0 : Number(String(minutes)[0])
      this.digits.minute0 = minutes <= 9 ? minutes : Number(String(minutes)[1])

      if (hours > 99) {
        this.digits.hour2 = Number(String(hours)[0])
        this.digits.hour1 = Number(String(hours)[1])
        this.digits.hour0 = Number(String(hours)[2])
        this.isOver99Hours = true
      } else {
        this.digits.hour1 = hours <= 9 ? 0 : Number(String(hours)[0])
        this.digits.hour0 = hours <= 9 ? hours : Number(String(hours)[1])
        this.isOver99Hours = this.showThreeDigitHour
      }

      if (this.isOver99Hours) {
        this.digitDisplay = ['hour2', 'hour1', 'hour0', ':', 'minute1', 'minute0', ':', 'second1', 'second0']
      } else {
        this.digitDisplay = ['hour1', 'hour0', ':', 'minute1', 'minute0', ':', 'second1', 'second0']
      }
    },
    updateSeconds() {
      var seconds = this.digits.second0 + this.digits.second1 * 10
      seconds += this.digits.minute0 * 60 + this.digits.minute1 * 600
      seconds += this.digits.hour0 * 3600 + this.digits.hour1 * 36000
      if (this.isOver99Hours) seconds += this.digits.hour2 * 360000

      if (Number(this.value) !== seconds) {
        this.$emit('input', seconds)
        this.$emit('change', seconds)
      }
    },
    clickMedian(index) {
      // Click colon select digit to right
      if (index >= 5) {
        this.focusedDigit = 'second1'
      } else {
        this.focusedDigit = 'minute1'
      }
    },
    clickOutside() {
      this.removeFocus()
    },
    removeFocus() {
      this.focusedDigit = null
      this.removeListeners()
    },
    focusDigit(digit) {
      if (this.focusedDigit == null || isNaN(this.focusedDigit)) this.initListeners()
      this.focusedDigit = digit
    },
    clickInput() {
      if (this.focusedDigit) return
      this.focusDigit('second0')
    },
    shiftFocusLeft() {
      if (!this.focusedDigit) return
      if (this.focusedDigit.endsWith('2')) return

      const isDigit1 = this.focusedDigit.endsWith('1')
      if (!isDigit1) {
        const digit1Key = this.focusedDigit.replace('0', '1')
        this.focusedDigit = digit1Key
      } else if (this.focusedDigit.startsWith('second')) {
        this.focusedDigit = 'minute0'
      } else if (this.focusedDigit.startsWith('minute')) {
        this.focusedDigit = 'hour0'
      } else if (this.isOver99Hours && this.focusedDigit.startsWith('hour')) {
        this.focusedDigit = 'hour2'
      }
    },
    shiftFocusRight() {
      if (!this.focusedDigit) return
      if (this.focusedDigit.endsWith('2')) {
        // Must be hour2
        this.focusedDigit = 'hour1'
        return
      }
      const isDigit1 = this.focusedDigit.endsWith('1')
      if (isDigit1) {
        const digit0Key = this.focusedDigit.replace('1', '0')
        this.focusedDigit = digit0Key
      } else if (this.focusedDigit.startsWith('hour')) {
        this.focusedDigit = 'minute1'
      } else if (this.focusedDigit.startsWith('minute')) {
        this.focusedDigit = 'second1'
      }
    },
    increaseFocused() {
      if (!this.focusedDigit) return
      const isDigit1 = this.focusedDigit.endsWith('1')
      const digit = Number(this.digits[this.focusedDigit])
      if (isDigit1 && !this.focusedDigit.startsWith('hour')) this.digits[this.focusedDigit] = (digit + 1) % 6
      else this.digits[this.focusedDigit] = (digit + 1) % 10
      this.updateSeconds()
    },
    decreaseFocused() {
      if (!this.focusedDigit) return
      const isDigit1 = this.focusedDigit.endsWith('1')
      const digit = Number(this.digits[this.focusedDigit])
      if (isDigit1 && !this.focusedDigit.startsWith('hour')) this.digits[this.focusedDigit] = digit - 1 < 0 ? 5 : digit - 1
      else this.digits[this.focusedDigit] = digit - 1 < 0 ? 9 : digit - 1
      this.updateSeconds()
    },
    keydown(evt) {
      if (!this.focusedDigit || !evt.key) return

      if (evt.key === 'ArrowLeft') {
        return this.shiftFocusLeft()
      } else if (evt.key === 'ArrowRight') {
        return this.shiftFocusRight()
      } else if (evt.key === 'ArrowUp') {
        return this.increaseFocused()
      } else if (evt.key === 'ArrowDown') {
        return this.decreaseFocused()
      } else if (evt.key === 'Enter' || evt.key === 'Escape' || evt.key === 'Tab') {
        return this.removeFocus()
      }

      if (isNaN(evt.key)) return

      var digit = Number(evt.key)
      const isDigit1 = this.focusedDigit.endsWith('1')
      if (isDigit1 && !this.focusedDigit.startsWith('hour') && digit >= 6) {
        digit = 5
      }

      this.digits[this.focusedDigit] = digit

      this.updateSeconds()
      this.shiftFocusRight()
    },
    initListeners() {
      window.addEventListener('keydown', this.keydown)
    },
    removeListeners() {
      window.removeEventListener('keydown', this.keydown)
    }
  },
  mounted() {},
  beforeDestroy() {
    this.removeListeners()
  }
}
</script>

<style scoped>
.digit-focused {
  background-color: #555;
}
</style>
