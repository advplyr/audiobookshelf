<template>
  <textarea ref="input" v-model="inputValue" :rows="rows" :readonly="readonly" :disabled="disabled" :placeholder="placeholder" dir="auto" class="py-2 px-3 rounded-sm bg-primary text-gray-200 focus:border-gray-500 focus:outline-hidden" :class="transparent ? '' : 'border border-gray-600'" @change="change" />
</template>

<script>
export default {
  props: {
    value: [String, Number],
    placeholder: String,
    readonly: Boolean,
    rows: {
      type: Number,
      default: 2
    },
    transparent: Boolean,
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
    change(e) {
      this.$emit('change', e.target.value)
    },
    blur() {
      if (this.$refs.input && this.$refs.input.blur) {
        this.$refs.input.blur()
      }
    }
  },
  mounted() {}
}
</script>

<style scoped>
textarea {
  border-style: inherit !important;
}
textarea:read-only {
  color: #aaa;
  background-color: #444;
}
</style>