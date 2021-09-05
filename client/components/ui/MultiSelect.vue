<template>
  <div class="w-full">
    <p class="px-1 text-sm font-semibold">{{ label }}</p>
    <div ref="wrapper" class="relative">
      <form @submit.prevent="submitForm">
        <div ref="inputWrapper" style="min-height: 40px" class="flex-wrap relative w-full shadow-sm flex items-center bg-primary border border-gray-600 rounded-md px-2 py-1 cursor-text" @click.stop.prevent="clickWrapper" @mouseup.stop.prevent @mousedown.prevent>
          <div v-for="item in selected" :key="item" class="rounded-full px-2 py-1 ma-0.5 text-xs bg-bg flex flex-nowrap whitespace-nowrap items-center relative">
            <div class="w-full h-full rounded-full absolute top-0 left-0 opacity-0 hover:opacity-100 px-1 bg-bg bg-opacity-75 flex items-center justify-end cursor-pointer">
              <span class="material-icons text-white hover:text-error" style="font-size: 1.1rem" @click.stop="removeItem(item)">close</span>
            </div>
            {{ item }}
          </div>
          <input ref="input" v-model="textInput" style="min-width: 40px; width: 40px" class="h-full bg-primary focus:outline-none px-1" @keydown="keydownInput" @focus="inputFocus" @blur="inputBlur" />
        </div>
      </form>

      <ul ref="menu" v-show="showMenu" class="absolute z-50 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-56 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" role="listbox" aria-labelledby="listbox-label">
        <template v-for="item in itemsToShow">
          <li :key="item" class="text-gray-50 select-none relative py-2 pr-9 cursor-pointer hover:bg-black-400" role="option" @click="clickedOption($event, item)" @mouseup.stop.prevent @mousedown.prevent>
            <div class="flex items-center">
              <span class="font-normal ml-3 block truncate">{{ item }}</span>
            </div>
            <span v-if="selected.includes(item)" class="text-yellow-400 absolute inset-y-0 right-0 flex items-center pr-4">
              <span class="material-icons text-xl">checkmark</span>
            </span>
          </li>
        </template>
        <li v-if="!itemsToShow.length" class="text-gray-50 select-none relative py-2 pr-9" role="option">
          <div class="flex items-center justify-center">
            <span class="font-normal">No items</span>
          </div>
        </li>
      </ul>
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
      textInput: null,
      currentSearch: null,
      typingTimeout: null,
      isFocused: false,
      menu: null
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
    showMenu() {
      return this.isFocused
    },
    itemsToShow() {
      if (!this.currentSearch || !this.textInput) {
        return this.items
      }

      return this.items.filter((i) => {
        var iValue = String(i).toLowerCase()
        return iValue.includes(this.currentSearch.toLowerCase())
      })
    }
  },
  methods: {
    keydownInput() {
      clearTimeout(this.typingTimeout)
      this.typingTimeout = setTimeout(() => {
        this.currentSearch = this.textInput
      }, 100)
      this.setInputWidth()
    },
    setInputWidth() {
      setTimeout(() => {
        var value = this.$refs.input.value
        var len = value.length * 7 + 24
        this.$refs.input.style.width = len + 'px'
        this.recalcMenuPos()
      }, 50)
    },
    recalcMenuPos() {
      if (!this.menu) return
      var boundingBox = this.$refs.inputWrapper.getBoundingClientRect()
      this.menu.style.top = boundingBox.y + boundingBox.height - 4 + 'px'
      this.menu.style.left = boundingBox.x + 'px'
      this.menu.style.width = boundingBox.width + 'px'
    },
    unmountMountMenu() {
      if (!this.$refs.menu) return
      this.menu = this.$refs.menu

      var boundingBox = this.$refs.inputWrapper.getBoundingClientRect()
      this.menu.remove()
      document.body.appendChild(this.menu)
      this.menu.style.top = boundingBox.y + boundingBox.height - 4 + 'px'
      this.menu.style.left = boundingBox.x + 'px'
      this.menu.style.width = boundingBox.width + 'px'
    },
    inputFocus() {
      if (!this.menu) {
        this.unmountMountMenu()
      }
      this.isFocused = true
      this.recalcMenuPos()
    },
    inputBlur() {
      setTimeout(() => {
        if (document.activeElement === this.$refs.input) {
          return
        }
        this.isFocused = false
      }, 50)
    },
    focus() {
      if (this.$refs.input) this.$refs.input.focus()
    },
    blur() {
      if (this.$refs.input) this.$refs.input.blur()
    },
    clickedOption(e, itemValue) {
      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }
      if (this.$refs.input) this.$refs.input.focus()

      var newSelected = null
      if (this.selected.includes(itemValue)) {
        newSelected = this.selected.filter((s) => s !== itemValue)
      } else {
        newSelected = this.selected.concat([itemValue])
      }
      this.textInput = null
      this.currentSearch = null
      this.$emit('input', newSelected)
      this.$nextTick(() => {
        this.recalcMenuPos()
      })
    },
    clickWrapper() {
      if (this.showMenu) {
        return this.blur()
      }
      this.focus()
    },
    removeItem(item) {
      var remaining = this.selected.filter((i) => i !== item)
      this.$emit('input', remaining)
      this.$nextTick(() => {
        this.recalcMenuPos()
      })
    },
    insertNewItem(item) {
      this.selected.push(item)
      this.$emit('input', this.selected)
      this.textInput = null
      this.currentSearch = null
      this.$nextTick(() => {
        this.blur()
      })
    },
    submitForm() {
      if (!this.textInput) return

      var cleaned = this.textInput.toLowerCase().trim()
      var matchesItem = this.items.find((i) => {
        return i === cleaned
      })
      if (matchesItem) {
        this.clickedOption(null, matchesItem)
      } else {
        this.insertNewItem(this.textInput)
      }
    }
  },
  mounted() {}
}
</script>