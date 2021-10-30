<template>
  <label class="flex justify-start items-start">
    <div class="bg-white border-2 rounded border-gray-400 flex flex-shrink-0 justify-center items-center focus-within:border-blue-500" :class="wrapperClass">
      <input v-model="selected" type="checkbox" class="opacity-0 absolute" />
      <svg v-if="selected" class="fill-current text-green-500 pointer-events-none" :class="svgClass" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
    </div>
    <div v-if="label" class="select-none">{{ label }}</div>
  </label>
</template>

<script>
export default {
  props: {
    value: Boolean,
    label: Boolean,
    small: Boolean
  },
  data() {
    return {}
  },
  computed: {
    selected: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', !!val)
      }
    },
    wrapperClass() {
      if (this.small) return 'w-4 h-4'
      return 'w-6 h-6'
    },
    svgClass() {
      if (this.small) return 'w-3 h-3'
      return 'w-4 h-4'
    }
  },
  methods: {},
  mounted() {}
}
</script>