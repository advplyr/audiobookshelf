<template>
  <div class="w-full">
    <slot>
      <label :for="identifier" class="px-1 text-sm font-semibold" :class="{ 'text-gray-400': disabled }">
        {{ label }}
        <em v-if="note" class="font-normal text-xs pl-2">{{ note }}</em>
      </label>
    </slot>
    <ui-text-input :placeholder="placeholder || label" :inputId="identifier" ref="input" v-model="inputValue" :disabled="disabled" :readonly="readonly" :type="type" :min="min" :show-copy="showCopy" class="w-full" :class="inputClass" :trim-whitespace="trimWhitespace" @blur="inputBlurred" />
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    label: String,
    placeholder: String,
    note: String,
    type: {
      type: String,
      default: 'text'
    },
    min: [String, Number],
    readonly: Boolean,
    disabled: Boolean,
    inputClass: String,
    showCopy: Boolean,
    trimWhitespace: Boolean
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
    identifier() {
      return Math.random().toString(36).substring(2)
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
