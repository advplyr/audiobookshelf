<template>
  <button class="btn outline-none rounded-md shadow-md relative border border-gray-600" :disabled="loading" :type="type" :class="classList" @click="click">
    <slot />
    <div v-if="loading" class="text-white absolute top-0 left-0 w-full h-full flex items-center justify-center text-opacity-100">
      <!-- <span class="material-icons animate-spin">refresh</span> -->
      <svg class="animate-spin" style="width: 24px; height: 24px" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
      </svg>
    </div>
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
    small: Boolean,
    loading: Boolean
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
button.btn:hover:not(:disabled)::before {
  background-color: rgba(255, 255, 255, 0.1);
}
button:disabled::before {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>