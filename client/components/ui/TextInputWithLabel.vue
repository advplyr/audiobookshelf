<template>
  <div class="w-full">
    <p class="px-1 text-sm">{{ label }}</p>
    <ui-text-input v-model="inputValue" :disabled="disabled" class="w-full" />
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    label: String,
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
  methods: {},
  mounted() {}
}
</script>