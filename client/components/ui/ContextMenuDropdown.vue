<template>
  <div class="relative h-9 w-9" v-click-outside="clickOutsideObj">
    <slot :disabled="disabled" :showMenu="showMenu" :clickShowMenu="clickShowMenu" :processing="processing">
      <button v-if="!processing" type="button" :disabled="disabled" class="relative h-full w-full flex items-center justify-center shadow-xs pl-3 pr-3 text-left focus:outline-hidden cursor-pointer text-gray-100 hover:text-gray-200 rounded-full hover:bg-white/5" :aria-label="$strings.LabelMore" aria-haspopup="menu" :aria-expanded="showMenu" @click.stop.prevent="clickShowMenu">
        <span class="material-symbols text-2xl" :class="iconClass">&#xe5d4;</span>
      </button>
      <div v-else class="h-full w-full flex items-center justify-center">
        <widgets-loading-spinner />
      </div>
    </slot>

    <transition name="menu">
      <div v-show="showMenu" ref="menuWrapper" role="menu" class="absolute right-0 mt-1 z-10 bg-bg border border-black-200 shadow-lg rounded-md py-1 focus:outline-hidden sm:text-sm" :style="{ width: menuWidth + 'px' }">
        <template v-for="(item, index) in items">
          <template v-if="item.subitems">
            <button :key="index" role="menuitem" aria-haspopup="menu" class="flex items-center px-2 py-1.5 hover:bg-white/5 text-white text-xs cursor-default w-full" :class="{ 'bg-white/5': mouseoverItemIndex == index }" @mouseover="mouseoverItem(index)" @mouseleave="mouseleaveItem(index)" @click.stop>
              <p>{{ item.text }}</p>
            </button>
            <div
              v-if="mouseoverItemIndex === index"
              :key="`subitems-${index}`"
              @mouseover="mouseoverSubItemMenu(index)"
              @mouseleave="mouseleaveSubItemMenu(index)"
              class="absolute bg-bg border rounded-b-md border-black-200 shadow-lg z-50 -ml-px py-1"
              :class="openSubMenuLeft ? 'rounded-l-md' : 'rounded-r-md'"
              :style="{ left: submenuLeftPos + 'px', top: index * 28 + 'px', width: submenuWidth + 'px' }"
            >
              <button v-for="(subitem, subitemindex) in item.subitems" :key="`subitem-${subitemindex}`" role="menuitem" class="flex items-center px-2 py-1.5 hover:bg-white/5 text-white text-xs cursor-pointer w-full" @click.stop="clickAction(subitem.action, subitem.data)">
                <p>{{ subitem.text }}</p>
              </button>
            </div>
          </template>
          <button v-else :key="index" role="menuitem" class="flex items-center px-2 py-1.5 hover:bg-white/5 text-white text-xs cursor-pointer w-full" @click.stop="clickAction(item.action)">
            <p class="text-left">{{ item.text }}</p>
          </button>
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
    },
    iconClass: {
      type: String,
      default: ''
    },
    menuWidth: {
      type: Number,
      default: 192
    },
    processing: Boolean
  },
  data() {
    return {
      clickOutsideObj: {
        handler: this.clickedOutside,
        events: ['mousedown'],
        isActive: true
      },
      submenuWidth: 144,
      showMenu: false,
      mouseoverItemIndex: null,
      isOverSubItemMenu: false,
      openSubMenuLeft: false
    }
  },
  computed: {
    submenuLeftPos() {
      return this.openSubMenuLeft ? -(this.submenuWidth - 1) : this.menuWidth - 0.5
    }
  },
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
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
      this.$nextTick(() => {
        const boundingRect = this.$refs.menuWrapper?.getBoundingClientRect()
        if (boundingRect) {
          this.openSubMenuLeft = window.innerWidth - boundingRect.x < this.menuWidth + this.submenuWidth + 5
        }
      })
    },
    clickedOutside() {
      this.showMenu = false
    },
    clickAction(action, data) {
      if (this.disabled) return
      this.showMenu = false
      this.$emit('action', { action, data })
    }
  },
  mounted() {}
}
</script>
