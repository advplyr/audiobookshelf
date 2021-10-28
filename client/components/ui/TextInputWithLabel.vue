<template>
  <div class="w-full">
    <p class="px-1 text-sm font-semibold" :class="disabled ? 'text-gray-400' : ''">
      {{ label }}<em v-if="note" class="font-normal text-xs pl-2">{{ note }}</em>
    </p>
    <ui-text-input v-model="inputValue" :disabled="disabled" :type="type" class="w-full" />
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