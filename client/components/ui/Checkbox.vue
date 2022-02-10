<template>
  <label class="flex justify-start items-center cursor-pointer">
    <div class="border-2 rounded border-gray-400 flex flex-shrink-0 justify-center items-center" :class="wrapperClass">
      <input v-model="selected" type="checkbox" class="opacity-0 absolute cursor-pointer" />
      <svg v-if="selected" class="fill-current pointer-events-none" :class="svgClass" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
    </div>
    <div v-if="label" class="select-none pl-1 text-gray-100" :class="labelClass">{{ label }}</div>
  </label>
</template>

<script>
export default {
  props: {
    value: Boolean,
    label: String,
    small: Boolean,
    checkboxBg: {
      type: String,
      default: 'white'
    },
    checkColor: {
      type: String,
      default: 'green-500'
    }
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
      var classes = [`bg-${this.checkboxBg}`]
      if (this.small) classes.push('w-4 h-4')
      else classes.push('w-6 h-6')

      return classes.join(' ')
    },
    labelClass() {
      if (this.small) return 'text-xs md:text-sm'
      return ''
    },
    svgClass() {
      var classes = [`text-${this.checkColor}`]
      if (this.small) classes.push('w-3 h-3')
      else classes.push('w-4 h-4')

      return classes.join(' ')
    }
  },
  methods: {},
  mounted() {}
}
</script>