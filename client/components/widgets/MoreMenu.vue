<template>
  <div class="absolute w-36 bg-bg rounded-md border border-black-200 shadow-lg z-50" v-click-outside="clickOutsideObj" style="top: 0; left: 0">
    <template v-for="(item, index) in items">
      <div :key="index" class="flex items-center px-2 py-1.5 hover:bg-white hover:bg-opacity-5 text-white text-xs cursor-pointer" @click.stop="clickAction(item.func)">
        <p>{{ item.text }}</p>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  props: {
    items: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      clickOutsideObj: {
        handler: this.clickedOutside,
        events: ['mousedown'],
        isActive: true
      }
    }
  },
  computed: {},
  methods: {
    clickAction(func) {
      this.$emit('action', func)
      this.close()
    },
    clickedOutside(e) {
      this.close()
    },
    close() {
      this.$emit('close')

      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      this.$el.parentNode.removeChild(this.$el)
    }
  },
  mounted() {},
  beforeDestroy() {}
}
</script>