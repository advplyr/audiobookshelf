<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-fg border border-gray-500 hover:border-gray-400 rounded shadow-sm pl-3 pr-3 py-0 text-left focus:outline-none sm:text-sm cursor-pointer" aria-haspopup="listbox" aria-expanded="true" aria-labelledby="listbox-label" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate text-xs" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
      </span>
    </button>

    <ul v-show="showMenu" class="absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-80 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" role="listbox" aria-labelledby="listbox-label">
      <template v-for="item in items">
        <li :key="item.value" class="text-gray-50 select-none relative py-2 pr-9 cursor-pointer hover:bg-black-400" :class="item.value === selected ? 'bg-primary bg-opacity-50' : ''" role="option" @click="clickedOption(item.value)">
          <div class="flex items-center">
            <span class="font-normal ml-3 block truncate text-xs">{{ item.text }}</span>
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
  },
  data() {
    return {
      showMenu: false,
      items: [
        {
          text: 'All Episodes',
          value: 'all'
        },
        {
          text: 'Unplayed',
          value: 'unplayed'
        },
        {
          text: 'Played',
          value: 'played'
        },
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
      var _selected = this.selected
      if (!_selected) return ''
      var _sel = this.items.find((i) => i.value === _selected)
      if (!_sel) return ''
      return _sel.text
    }
  },
  methods: {
    clickOutside() {
      this.showMenu = false
    },
    clickedOption(val) {
      this.selected = val
      this.showMenu = false
      this.$nextTick(() => this.$emit('change', val))
    }
  }
}
</script>