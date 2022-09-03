<template>
  <div class="w-full">
    <slot>
      <p class="px-1 text-sm font-semibold" :class="{ 'text-gray-400': disabled }">
        {{ label }}<em v-if="note" class="font-normal text-xs pl-2">{{ note }}</em>
      </p>
    </slot>
    <ui-text-input ref="input" v-model="inputValue" :disabled="disabled" :readonly="readonly" :type="type" class="w-full" :class="inputClass" @blur="inputBlurred" />
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    label: String,
    note: String,
    type: {
      type: String,
      default: 'text'
    },
    readonly: Boolean,
    disabled: Boolean,
    inputClass: String
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
    setFocus() {
      if (this.$refs.input && this.$refs.input.setFocus) {
        this.$refs.input.setFocus()
      }
    },
    blur() {
      if (this.$refs.input && this.$refs.input.blur) {
        this.$refs.input.blur()
      }
    },
    inputBlurred() {
      this.$emit('blur')
    }
  },
  mounted() {}
}
</script>