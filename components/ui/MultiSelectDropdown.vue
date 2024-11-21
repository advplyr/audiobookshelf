<template>
  <div class="w-full" v-click-outside="clickOutsideObj">
    <p class="px-1 text-sm font-semibold">{{ label }}</p>
    <div ref="wrapper" class="relative">
      <div ref="inputWrapper" style="min-height: 40px" class="flex-wrap relative w-full shadow-sm flex items-center bg-primary border border-gray-600 rounded-md px-2 py-1 cursor-pointer" @click.stop.prevent="clickWrapper" @mouseup.stop.prevent @mousedown.prevent>
        <div v-for="item in selectedItems" :key="item.value" class="rounded-full px-2 py-1 ma-0.5 text-xs bg-bg flex flex-nowrap whitespace-nowrap items-center relative">
          <div class="w-full h-full rounded-full absolute top-0 left-0 opacity-0 hover:opacity-100 px-1 bg-bg bg-opacity-75 flex items-center justify-end cursor-pointer">
            <span class="material-symbols text-white hover:text-error" style="font-size: 1.1rem" @click.stop="removeItem(item.value)">close</span>
          </div>
          {{ item.text }}
        </div>
      </div>

      <transition name="menu">
        <ul ref="menu" v-show="showMenu" class="absolute z-60 -mt-px w-full bg-primary border border-black-200 shadow-lg max-h-56 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" role="listbox" aria-labelledby="listbox-label">
          <template v-for="item in items">
            <li :key="item.value" class="text-gray-50 select-none relative py-2 pr-9 cursor-pointer hover:bg-black-400" role="option" @click="clickedOption($event, item)" @mouseup.stop.prevent @mousedown.prevent>
              <p class="font-normal ml-3 block truncate">{{ item.text }}</p>

              <div v-if="selected.includes(item.value)" class="text-yellow-400 absolute inset-y-0 right-0 my-auto w-5 h-5 mr-3 overflow-hidden">
                <span class="material-symbols text-xl">check</span>
              </div>
            </li>
          </template>
          <li v-if="!items.length" class="text-gray-50 select-none relative py-2 pr-9" role="option">
            <div class="flex items-center justify-center">
              <span class="font-normal">{{ $strings.MessageNoItems }}</span>
            </div>
          </li>
        </ul>
      </transition>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: Array,
      default: () => []
    },
    items: {
      type: Array,
      default: () => []
    },
    label: String
  },
  data() {
    return {
      showMenu: false,
      menu: null,
      clickOutsideObj: {
        handler: this.closeMenu,
        events: ['mousedown'],
        isActive: true
      }
    }
  },
  computed: {
    selected: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    selectedItems() {
      return (this.value || []).map((v) => {
        return this.items.find((i) => i.value === v) || { text: v, value: v }
      })
    }
  },
  methods: {
    recalcMenuPos() {
      if (!this.menu || !this.$refs.inputWrapper) return
      var boundingBox = this.$refs.inputWrapper.getBoundingClientRect()
      this.menu.style.top = boundingBox.y + boundingBox.height - 4 + 'px'
      this.menu.style.left = boundingBox.x + 'px'
      this.menu.style.width = boundingBox.width + 'px'
    },
    unmountMountMenu() {
      if (!this.$refs.menu || !this.$refs.inputWrapper) return
      this.menu = this.$refs.menu

      var boundingBox = this.$refs.inputWrapper.getBoundingClientRect()
      this.menu.remove()
      document.body.appendChild(this.menu)
      this.menu.style.top = boundingBox.y + boundingBox.height - 4 + 'px'
      this.menu.style.left = boundingBox.x + 'px'
      this.menu.style.width = boundingBox.width + 'px'
    },
    clickedOption(e, item) {
      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }
      var newSelected = null
      if (this.selected.includes(item.value)) {
        newSelected = this.selected.filter((s) => s !== item.value)
      } else {
        newSelected = this.selected.concat([item.value])
      }
      this.$emit('input', newSelected)
      this.$nextTick(() => {
        this.recalcMenuPos()
      })
    },
    closeMenu() {
      this.showMenu = false
      this.removeListener()
    },
    clickWrapper() {
      this.showMenu = !this.showMenu
      if (this.showMenu) this.setListener()
      else this.removeListener()
    },
    removeItem(itemValue) {
      var remaining = this.selected.filter((i) => i !== itemValue)
      this.$emit('input', remaining)

      this.$nextTick(() => {
        this.recalcMenuPos()
      })
    },
    scroll() {
      this.recalcMenuPos()
    },
    setListener() {
      document.addEventListener('scroll', this.scroll, true)
    },
    removeListener() {
      document.removeEventListener('scroll', this.scroll, true)
    }
  },
  mounted() {},
  beforeDestroy() {
    if (this.menu) this.menu.remove()
  }
}
</script>
