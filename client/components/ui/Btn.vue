<template>
  <button class="btn outline-none rounded-md shadow-md relative border border-gray-600" :type="type" :class="classList" @click="click">
    <slot />
  </button>
</template>

<script>
export default {
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    type: {
      type: String,
      default: ''
    },
    paddingX: Number,
    small: Boolean
  },
  data() {
    return {}
  },
  computed: {
    classList() {
      var list = []
      list.push('text-white')
      list.push(`bg-${this.color}`)
      if (this.small) {
        list.push('text-sm')
        if (this.paddingX === undefined) list.push('px-4')
        list.push('py-1')
      } else {
        if (this.paddingX === undefined) list.push('px-8')
        list.push('py-2')
      }
      if (this.paddingX !== undefined) {
        list.push(`px-${this.paddingX}`)
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

<style>
button.btn::before {
  content: '';
  position: absolute;
  border-radius: 6px;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0);
  transition: all 0.1s ease-in-out;
}
button.btn:hover::before {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>