<template>
  <div class="relative w-full" v-click-outside="clickOutsideObj">
    <p v-if="label" class="text-sm font-semibold px-1" :class="disabled ? 'text-gray-300' : ''">{{ label }}</p>
    <button type="button" :aria-label="longLabel" :disabled="disabled" class="relative w-full border rounded shadow-sm pl-3 pr-8 py-2 text-left sm:text-sm" :class="buttonClass" aria-haspopup="menu" :aria-expanded="showMenu" @click.stop.prevent="clickShowMenu">
      <span class="flex items-center">
        <span class="block truncate font-sans" :class="{ 'font-semibold': selectedSubtext, 'text-sm': small }">{{ selectedText }}</span>
        <span v-if="selectedSubtext">:&nbsp;</span>
        <span v-if="selectedSubtext" class="font-normal block truncate font-sans text-sm text-gray-400">{{ selectedSubtext }}</span>
      </span>
      <span class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <span class="material-symbols text-2xl">expand_more</span>
      </span>
    </button>

    <transition name="menu">
      <ul v-show="showMenu" class="absolute z-10 -mt-px w-full bg-primary border border-black-200 shadow-lg rounded-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm" tabindex="-1" role="menu" :style="{ maxHeight: menuMaxHeight }">
        <template v-for="item in itemsToShow">
          <li :key="item.value" class="text-gray-100 relative py-2 cursor-pointer hover:bg-black-400" role="menuitem" tabindex="0" @keyup.enter="clickedOption(item.value)" @click="clickedOption(item.value)">
            <div class="flex items-center">
              <span class="ml-3 block truncate font-sans text-sm" :class="{ 'font-semibold': item.subtext }">{{ item.text }}</span>
              <span v-if="item.subtext">:&nbsp;</span>
              <span v-if="item.subtext" class="font-normal block truncate font-sans text-sm text-gray-400">{{ item.subtext }}</span>
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
    disabled: Boolean,
    small: Boolean,
    menuMaxHeight: {
      type: String,
      default: '224px'
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
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    itemsToShow() {
      return this.items.map((i) => {
        if (typeof i === 'string' || typeof i === 'number') {
          return {
            text: i,
            value: i
          }
        }
        return i
      })
    },
    selectedItem() {
      return this.itemsToShow.find((i) => i.value === this.selected)
    },
    selectedText() {
      return this.selectedItem ? this.selectedItem.text : ''
    },
    selectedSubtext() {
      return this.selectedItem ? this.selectedItem.subtext : ''
    },
    buttonClass() {
      var classes = []
      if (this.small) classes.push('h-9')
      else classes.push('h-10')

      if (this.disabled) classes.push('cursor-not-allowed border-gray-600 bg-primary bg-opacity-70 border-opacity-70 text-gray-400')
      else classes.push('cursor-pointer border-gray-600 bg-primary text-gray-100')

      return classes.join(' ')
    },
    longLabel() {
      let result = ''
      if (this.label) result += this.label + ': '
      if (this.selectedText) result += this.selectedText
      if (this.selectedSubtext) result += ' ' + this.selectedSubtext
      return result
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
    clickedOption(itemValue) {
      this.selected = itemValue
      this.showMenu = false
    }
  },
  mounted() {}
}
</script>
