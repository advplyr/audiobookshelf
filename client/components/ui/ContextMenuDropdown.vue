<template>
  <div class="relative h-9 w-9" v-click-outside="clickOutsideObj">
    <button type="button" :disabled="disabled" class="relative h-full w-full flex items-center justify-center shadow-sm pl-3 pr-3 text-left focus:outline-none cursor-pointer text-gray-100 hover:text-gray-200 rounded-full hover:bg-white/5" aria-haspopup="listbox" aria-expanded="true" @click.stop.prevent="clickShowMenu">
      <span class="material-icons">more_vert</span>
    </button>

    <transition name="menu">
      <div v-show="showMenu" class="absolute right-0 mt-1 z-10 bg-bg border border-black-200 shadow-lg max-h-56 w-48 rounded-md py-1 overflow-auto focus:outline-none sm:text-sm">
        <template v-for="(item, index) in items">
          <div :key="index" class="flex items-center px-2 py-1.5 hover:bg-white hover:bg-opacity-5 text-white text-xs cursor-pointer" @click.stop="clickAction(item.action)">
            <p>{{ item.text }}</p>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    disabled: Boolean,
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
      showMenu: false
    }
  },
  computed: {},
  methods: {
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
    },
    clickedOutside() {
      this.showMenu = false
    },
    clickAction(action) {
      if (this.disabled) return
      this.showMenu = false
      this.$emit('action', action)
    }
  },
  mounted() {}
}
</script>