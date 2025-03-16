<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <div class="relative h-9">
      <button type="button" class="relative w-full h-full border border-gray-500 hover:border-gray-400 rounded-sm shadow-xs pl-3 pr-3 py-0 text-left focus:outline-hidden cursor-pointer" aria-haspopup="menu" :aria-expanded="showMenu" @click.prevent="showMenu = !showMenu">
        <span class="flex items-center justify-between">
          <span class="block truncate text-xs">{{ selectedText }}</span>
        </span>
      </button>
      <span v-if="selected === 'all'" class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
      <button v-else type="button" :aria-label="$strings.ButtonClearFilter" class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer text-gray-400 hover:text-gray-300" @mousedown.stop @mouseup.stop @click.stop.prevent="clearSelected">
        <span class="material-symbols" style="font-size: 1.1rem">close</span>
      </button>
    </div>

    <div v-show="showMenu" class="absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-96 rounded-md py-1 text-sm ring-1 ring-black/5 overflow-auto focus:outline-hidden">
      <ul class="h-full w-full" role="menu">
        <template v-for="item in items">
          <li :key="item.value" class="select-none relative py-2 pr-9 cursor-pointer hover:bg-white/5" :class="item.value === selected ? 'bg-white/5 text-yellow-400' : 'text-gray-200 hover:text-white'" role="menuitem" @click="clickedOption(item)">
            <div class="flex items-center justify-between">
              <span class="font-normal ml-3 block truncate">{{ item.text }}</span>
            </div>

            <!-- selected checkmark icon -->
            <div v-if="item.value === selected" class="absolute inset-y-0 right-2 h-full flex items-center pointer-events-none">
              <span class="material-symbols text-base text-yellow-400">check</span>
            </div>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    items: {
      type: Array,
      default: () => []
    }
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
    selectedText() {
      if (!this.selected) return ''
      const filter = this.items.find((i) => i.value === this.selected)
      return filter ? filter.text : ''
    },
    filterData() {
      return this.$store.state.libraries.filterData || {}
    }
  },
  methods: {
    clearSelected() {
      this.selected = 'all'
      this.showMenu = false
      this.$nextTick(() => this.$emit('change', 'all'))
    },
    clickOutside() {
      this.showMenu = false
    },
    clickedOption(option) {
      var val = option.value
      if (this.selected === val) {
        this.showMenu = false
        return
      }
      this.selected = val
      this.showMenu = false
      this.$nextTick(() => this.$emit('change', val))
    }
  }
}
</script>
