<template>
  <div class="w-full">
    <p class="px-1 text-sm font-semibold" :class="disabled ? 'text-gray-400' : ''">{{ label }}</p>
    <ui-textarea-input ref="input" v-model="inputValue" :disabled="disabled" :readonly="readonly" :rows="rows" class="w-full" />
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    label: String,
    disabled: Boolean,
    readonly: Boolean,
    rows: {
      type: Number,
      default: 2
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
    }
  },
  methods: {
    blur() {
      if (this.$refs.input && this.$refs.input.blur) {
        this.$refs.input.blur()
      }
    }
  },
  mounted() {}
}
</script>