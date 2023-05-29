<template>
  <div class="absolute w-36 bg-bg rounded-md border border-black-200 shadow-lg z-50" v-click-outside="clickOutsideObj" style="top: 0; left: 0">
    <template v-for="(item, index) in items">
      <template v-if="item.subitems">
        <div :key="index" class="flex items-center px-2 py-1.5 hover:bg-white hover:bg-opacity-5 text-white text-xs cursor-default" @mouseover="mouseoverItem(index)" @mouseleave="mouseleaveItem(index)" @click.stop>
          <p>{{ item.text }}</p>
        </div>
        <div v-if="mouseoverItemIndex === index" :key="`subitems-${index}`" @mouseover="mouseoverSubItemMenu(index)" @mouseleave="mouseleaveSubItemMenu(index)" class="absolute w-36 bg-bg rounded-md border border-black-200 shadow-lg z-50" :style="{ left: 143 + 'px', top: index * 28 + 'px' }">
          <div v-for="(subitem, subitemindex) in item.subitems" :key="`subitem-${subitemindex}`" class="flex items-center px-2 py-1.5 hover:bg-white hover:bg-opacity-5 text-white text-xs cursor-pointer" @click.stop="clickAction(subitem.func, subitem.data)">
            <p>{{ subitem.text }}</p>
          </div>
        </div>
      </template>
      <div v-else :key="index" class="flex items-center px-2 py-1.5 hover:bg-white hover:bg-opacity-5 text-white text-xs cursor-pointer" @mouseover="mouseoverItem(index)" @mouseleave="mouseleaveItem(index)" @click.stop="clickAction(item.func)">
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
      },
      mouseoverItemIndex: null,
      isOverSubItemMenu: false
    }
  },
  computed: {},
  methods: {
    mouseoverSubItemMenu(index) {
      this.isOverSubItemMenu = true
    },
    mouseleaveSubItemMenu(index) {
      setTimeout(() => {
        if (this.isOverSubItemMenu && this.mouseoverItemIndex === index) this.mouseoverItemIndex = null
      }, 1)
    },
    mouseoverItem(index) {
      this.isOverSubItemMenu = false
      this.mouseoverItemIndex = index
    },
    mouseleaveItem(index) {
      setTimeout(() => {
        if (this.isOverSubItemMenu) return
        if (this.mouseoverItemIndex === index) this.mouseoverItemIndex = null
      }, 1)
    },
    clickAction(func, data) {
      this.$emit('action', {
        func,
        data
      })
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