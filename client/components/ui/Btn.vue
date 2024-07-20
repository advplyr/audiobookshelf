<template>
  <nuxt-link v-if="to" :to="to" class="abs-btn outline-none rounded-md shadow-md relative border border-gray-600 text-center" :disabled="disabled || loading" :class="classList" @click.native="click">
    <slot />
    <div v-if="loading" class="text-white absolute top-0 left-0 w-full h-full flex items-center justify-center text-opacity-100">
      <svg class="animate-spin" style="width: 24px; height: 24px" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
      </svg>
    </div>
  </nuxt-link>
  <button v-else class="abs-btn outline-none rounded-md shadow-md relative border border-gray-600" :disabled="disabled || loading" :type="type" :class="classList" @mousedown.prevent @click="click">
    <slot />
    <div v-if="loading" class="text-white absolute top-0 left-0 w-full h-full flex items-center justify-center text-opacity-100">
      <span v-if="progress">{{ progress }}</span>
      <svg v-else class="animate-spin" style="width: 24px; height: 24px" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
      </svg>
    </div>
  </button>
</template>

<script>
export default {
  props: {
    to: String,
    color: {
      type: String,
      default: 'primary'
    },
    type: {
      type: String,
      default: ''
    },
    paddingX: Number,
    paddingY: Number,
    small: Boolean,
    loading: Boolean,
    disabled: Boolean,
    progress: String
  },
  data() {
    return {}
  },
  computed: {
    classList() {
      var list = []
      if (this.loading) list.push('text-opacity-0')
      list.push('text-white')
      list.push(`bg-${this.color}`)
      if (this.small) {
        list.push('text-sm')
        if (this.paddingX === undefined) list.push('px-4')
        if (this.paddingY === undefined) list.push('py-1')
      } else {
        if (this.paddingX === undefined) list.push('px-8')
        if (this.paddingY === undefined) list.push('py-2')
      }
      if (this.paddingX !== undefined) {
        list.push(`px-${this.paddingX}`)
      }
      if (this.paddingY !== undefined) {
        list.push(`py-${this.paddingY}`)
      }
      if (this.disabled) {
        list.push('cursor-not-allowed')
      }
      return list
    }
  },
  methods: {
    click(e) {
      this.$emit('click', e)
    }
  },
  mounted() {}
}
</script>
