<template>
  <div class="relative">
    <input ref="input" v-model="inputValue" :type="type" :readonly="readonly" :disabled="disabled" :placeholder="placeholder" class="rounded bg-primary text-gray-200 focus:border-gray-500 focus:outline-none border border-gray-600 h-full w-full" :class="classList" @keyup="keyup" @change="change" @focus="focused" @blur="blurred" />
    <div v-if="clearable && inputValue" class="absolute top-0 right-0 h-full px-2 flex items-center justify-center">
      <span class="material-icons text-gray-300 cursor-pointer" style="font-size: 1.1rem" @click.stop.prevent="clear">close</span>
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
    clearable: Boolean
  },
  data() {
    return {}
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
      return _list.join(' ')
    }
  },
  methods: {
    clear() {
      this.inputValue = ''
    },
    focused() {
      this.$emit('focus')
    },
    blurred() {
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
    }
  },
  mounted() {}
}
</script>

<style scoped>
input {
  border-style: inherit !important;
}
input:read-only {
  background-color: #444;
}
</style>