<template>
  <input ref="input" v-model="inputValue" :type="type" :readonly="readonly" :disabled="disabled" :placeholder="placeholder" class="py-2 px-1 bg-transparent border-b border-opacity-0 border-gray-400 focus:border-opacity-100 focus:outline-none" @keyup="keyup" @change="change" @focus="focused" @blur="blurred" />
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
    disabled: Boolean
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