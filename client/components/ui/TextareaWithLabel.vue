<template>
  <div class="w-full">
    <p class="px-1 text-sm font-semibold">{{ label }}</p>
    <ui-textarea-input v-model="inputValue" :rows="rows" class="w-full" />
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    label: String,
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
  methods: {},
  mounted() {}
}
</script>