<template>
  <div class="relative w-full" v-click-outside="clickOutside">
    <p class="text-sm text-opacity-75 mb-1">{{ label }}</p>
    <button type="button" :disabled="disabled" class="relative h-10 w-full border border-gray-500 rounded shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none sm:text-sm cursor-pointer bg-primary" aria-haspopup="listbox" aria-expanded="true" @click.stop.prevent="clickShowMenu">
      <span class="flex items-center">
        <span class="block truncate">{{ selectedText }}</span>
      </span>
      <span class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <span class="material-icons text-gray-100">expand_more</span>
      </span>
    </button>

    <transition name="menu">
      <ul v-show="showMenu" class="absolute z-10 -mt-px w-full bg-primary border border-black-200 shadow-lg max-h-56 rounded-b-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" tabindex="-1" role="listbox">
        <template v-for="item in items">
          <li :key="item.value" class="text-gray-100 select-none relative py-2 cursor-pointer hover:bg-black-400" id="listbox-option-0" role="option" @click="clickedOption(item.value)">
            <div class="flex items-center">
              <span class="font-normal ml-3 block truncate font-sans text-sm">{{ item.text }}</span>
            </div>
          </li>
        </template>
      </ul>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    value: [String, Number],
    label: {
      type: String,
      default: ''
    },
    items: {
      type: Array,
      default: () => []
    },
    disabled: Boolean
  },
  data() {
    return {
      showMenu: false
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
    selectedItem() {
      return this.items.find((i) => i.value === this.selected)
    },
    selectedText() {
      return this.selectedItem ? this.selectedItem.text : ''
    }
  },
  methods: {
    clickShowMenu() {
      if (this.disabled) return
      this.showMenu = !this.showMenu
    },
    clickOutside() {
      this.showMenu = false
    },
    clickedOption(itemValue) {
      this.selected = itemValue
      this.showMenu = false
    }
  },
  mounted() {}
}
</script>