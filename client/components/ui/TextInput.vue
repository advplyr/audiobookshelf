<template>
  <div ref="wrapper" class="relative">
    <input
      :id="inputId"
      :name="inputName"
      ref="input"
      v-model="inputValue"
      :type="actualType"
      :step="step"
      :min="min"
      :readonly="readonly"
      :disabled="disabled"
      :placeholder="placeholder"
      dir="auto"
      class="rounded bg-primary text-gray-200 focus:border-gray-300 focus:bg-bg focus:outline-none border border-gray-600 h-full w-full"
      :class="classList"
      @keyup="keyup"
      @change="change"
      @focus="focused"
      @blur="blurred"
    />
    <div v-if="clearable && inputValue" class="absolute top-0 right-0 h-full px-2 flex items-center justify-center">
      <span class="material-symbols text-gray-300 cursor-pointer" style="font-size: 1.1rem" @click.stop.prevent="clear">close</span>
    </div>
    <div v-if="type === 'password' && isHovering" class="absolute top-0 right-0 h-full px-4 flex items-center justify-center">
      <span class="material-symbols text-gray-400 cursor-pointer text-lg" @click.stop.prevent="showPassword = !showPassword">{{ !showPassword ? 'visibility' : 'visibility_off' }}</span>
    </div>
    <div v-else-if="showCopy" class="absolute top-0 right-0 h-full px-4 flex items-center justify-center">
      <span class="material-symbols text-gray-400 cursor-pointer text-lg" @click.stop.prevent="copyToClipboard">{{ !hasCopied ? 'content_copy' : 'done' }}</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    placeholder: String,
    readonly: Boolean,
    type: {
      type: String,
      default: 'text'
    },
    disabled: Boolean,
    paddingY: {
      type: Number,
      default: 2
    },
    paddingX: {
      type: Number,
      default: 3
    },
    noSpinner: Boolean,
    textCenter: Boolean,
    clearable: Boolean,
    inputId: String,
    inputName: String,
    showCopy: Boolean,
    step: [String, Number],
    min: [String, Number],
    customInputClass: String
  },
  data() {
    return {
      showPassword: false,
      isHovering: false,
      isFocused: false,
      hasCopied: false
    }
  },
  computed: {
    inputValue: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    classList() {
      var _list = []
      _list.push(`px-${this.paddingX}`)
      _list.push(`py-${this.paddingY}`)
      if (this.noSpinner) _list.push('no-spinner')
      if (this.textCenter) _list.push('text-center')
      if (this.customInputClass) _list.push(this.customInputClass)
      return _list.join(' ')
    },
    actualType() {
      if (this.type === 'password' && this.showPassword) return 'text'
      return this.type
    }
  },
  methods: {
    copyToClipboard() {
      if (this.hasCopied) return
      this.$copyToClipboard(this.inputValue).then((success) => {
        this.hasCopied = success
        setTimeout(() => {
          this.hasCopied = false
        }, 2000)
      })
    },
    clear() {
      this.inputValue = ''
      this.$emit('clear')
    },
    focused() {
      this.isFocused = true
      this.$emit('focus')
    },
    blurred() {
      this.isFocused = false
      this.$emit('blur')
    },
    change(e) {
      this.$emit('change', e.target.value)
    },
    keyup(e) {
      this.$emit('keyup', e)
    },
    blur() {
      if (this.$refs.input) this.$refs.input.blur()
    },
    setFocus() {
      if (this.$refs.input) this.$refs.input.focus()
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    }
  },
  mounted() {
    if (this.type === 'password' && this.$refs.wrapper) {
      this.$refs.wrapper.addEventListener('mouseover', this.mouseover)
      this.$refs.wrapper.addEventListener('mouseleave', this.mouseleave)
    }
  }
}
</script>

<style scoped>
input {
  border-style: inherit !important;
}
input:read-only {
  color: #bbb;
  background-color: #444;
}
input::-webkit-calendar-picker-indicator {
  filter: invert(1);
}
</style>
