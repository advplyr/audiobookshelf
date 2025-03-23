<template>
  <div class="relative w-full h-9" v-click-outside="clickOutsideObj">
    <p class="text-sm font-semibold">{{ label }}</p>

    <button type="button" :disabled="disabled" class="relative h-full w-full border border-gray-600 rounded-sm shadow-xs pl-3 pr-3 text-left focus:outline-hidden cursor-pointer bg-primary text-gray-100 hover:text-gray-200" aria-haspopup="listbox" aria-expanded="true" @click.stop.prevent="clickShowMenu">
      <ui-library-icon :icon="selectedItem" />
    </button>

    <transition name="menu">
      <div v-show="showMenu" class="absolute -left-[4.5rem] z-10 -mt-px bg-primary border border-black-200 shadow-lg max-h-56 w-48 rounded-md py-1 overflow-auto focus:outline-hidden sm:text-sm">
        <div class="flex justify-center items-center flex-wrap">
          <template v-for="icon in icons">
            <div :key="icon" class="p-2">
              <span class="abs-icons text-xl text-white/80 hover:text-white/100 cursor-pointer" :class="`icon-${icon}`" @click="select(icon)"></span>
            </div>
          </template>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    disabled: Boolean,
    label: {
      type: String,
      default: 'Icon'
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
  computed: {
    selected: {
      get() {
        return this.value || 'database'
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    icons() {
      return this.$store.state.globals.libraryIcons
    },
    selectedItem() {
      return this.icons.find((i) => i === this.selected) || 'audiobookshelf'
    }
  },
  methods: {
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
    },
    clickedOutside() {
      this.showMenu = false
    },
    select(icon) {
      if (this.disabled) return
      this.selected = icon
      this.showMenu = false
    }
  },
  mounted() {}
}
</script>
