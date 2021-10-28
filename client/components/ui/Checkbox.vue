<template>
  <label class="flex justify-start items-start">
    <div class="bg-white border-2 rounded border-gray-400 w-6 h-6 flex flex-shrink-0 justify-center items-center focus-within:border-blue-500">
      <input v-model="selected" type="checkbox" class="opacity-0 absolute" />
      <svg v-if="selected" class="fill-current w-4 h-4 text-green-500 pointer-events-none" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
    </div>
    <div v-if="label" class="select-none">{{ label }}</div>
  </label>
</template>

<script>
export default {
  props: {
    value: Boolean,
    label: Boolean
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
    }
  },
  methods: {},
  mounted() {}
}
</script>