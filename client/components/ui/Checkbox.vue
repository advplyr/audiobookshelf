<template>
  <label class="flex justify-start items-center" :class="!disabled ? 'cursor-pointer' : ''">
    <div class="border-2 rounded flex flex-shrink-0 justify-center items-center" :class="wrapperClass">
      <input v-model="selected" :disabled="disabled" type="checkbox" class="opacity-0 absolute" :class="!disabled ? 'cursor-pointer' : ''" />
      <svg v-if="selected" class="fill-current pointer-events-none" :class="svgClass" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
    </div>
    <div v-if="label" class="select-none text-gray-100" :class="labelClassname">{{ label }}</div>
  </label>
</template>

<script>
export default {
  props: {
    value: Boolean,
    label: String,
    small: Boolean,
    medium: Boolean,
    checkboxBg: {
      type: String,
      default: 'white'
    },
    borderColor: {
      type: String,
      default: 'gray-400'
    },
    checkColor: {
      type: String,
      default: 'green-500'
    },
    labelClass: {
      type: String,
      default: ''
    },
    disabled: Boolean
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
      var classes = [`bg-${this.checkboxBg} border-${this.borderColor}`]
      if (this.small) classes.push('w-4 h-4')
      else if (this.medium) classes.push('w-5 h-5')
      else classes.push('w-6 h-6')

      return classes.join(' ')
    },
    labelClassname() {
      if (this.labelClass) return this.labelClass
      var classes = ['pl-1']
      if (this.small) classes.push('text-xs md:text-sm')
      else if (this.medium) classes.push('text-base md:text-lg')
      return classes.join(' ')
    },
    svgClass() {
      var classes = [`text-${this.checkColor}`]
      if (this.small) classes.push('w-3 h-3')
      else if (this.medium) classes.push('w-3.5 h-3.5')
      else classes.push('w-4 h-4')

      return classes.join(' ')
    }
  },
  methods: {},
  mounted() {}
}
</script>