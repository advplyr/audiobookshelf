<template>
  <input ref="input" v-model="inputValue" :type="type" :readonly="readonly" :disabled="disabled" :placeholder="placeholder" class="rounded bg-primary text-gray-200 focus:border-gray-500 focus:outline-none border border-gray-600" :class="classList" @keyup="keyup" @change="change" @focus="focused" @blur="blurred" />
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
    }
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
      return _list.join(' ')
    }
  },
  methods: {
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