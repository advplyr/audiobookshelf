<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-fg border border-gray-500 hover:border-gray-300 rounded shadow-sm pl-3 pr-3 py-0 text-left focus:outline-none sm:text-sm cursor-pointer" aria-haspopup="listbox" aria-expanded="true" aria-labelledby="listbox-label" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
      </span>
      <span class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
    </button>

    <ul v-show="showMenu" class="absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-56 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" role="listbox" aria-labelledby="listbox-label">
      <template v-for="item in items">
        <li :key="item.value" class="text-gray-50 select-none relative py-2 pr-9 cursor-pointer hover:bg-black-400" :class="item.value === selected ? 'bg-primary bg-opacity-50' : ''" role="option" @click="clickedOption(item.value)">
          <div class="flex items-center">
            <span class="font-normal ml-3 block truncate">{{ item.text }}</span>
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>

<script>
export default {
  props: {
    value: String
  },
  data() {
    return {
      showMenu: false,
      items: [
        {
          text: 'All',
          value: 'all'
        },
        {
          text: 'Genre',
          value: 'genre'
        },
        {
          text: 'Tag',
          value: 'tag'
        }
      ]
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
      var _sel = this.items.find((i) => i.value === this.selected)
      if (!_sel) return ''
      return _sel.text
    }
  },
  methods: {
    clickOutside() {
      this.showMenu = false
    },
    clickedOption(val) {
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