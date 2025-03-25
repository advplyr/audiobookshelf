<template>
  <div class="w-full">
    <p class="px-1 text-sm font-semibold" :class="disabled ? 'text-gray-400' : ''">{{ label }}</p>
    <div ref="wrapper" class="relative">
      <form @submit.prevent="submitForm">
        <div ref="inputWrapper" class="input-wrapper flex-wrap relative w-full shadow-xs flex items-center border border-gray-600 rounded-sm px-2 py-2" :class="disabled ? 'pointer-events-none bg-black-300 text-gray-400' : 'bg-primary'">
          <input ref="input" v-model="textInput" :disabled="disabled" class="h-full w-full bg-transparent focus:outline-hidden px-1" @keydown="keydownInput" @focus="inputFocus" @blur="inputBlur" />
        </div>
      </form>

      <ul ref="menu" v-show="isFocused && currentSearch" class="absolute z-60 mt-0 w-full bg-bg border border-black-200 shadow-lg max-h-56 rounded-sm py-1 text-base ring-1 ring-black/5 overflow-auto focus:outline-hidden sm:text-sm" role="listbox" aria-labelledby="listbox-label">
        <template v-for="item in items">
          <li :key="item.id" class="text-gray-50 select-none relative py-2 pr-3 cursor-pointer hover:bg-black-400" role="option" @click="clickedOption($event, item)" @mouseup.stop.prevent @mousedown.prevent>
            <div class="flex items-center">
              <span class="font-normal ml-3 block truncate">{{ item.name }}</span>
            </div>
            <span v-if="isItemSelected(item)" class="text-yellow-400 absolute inset-y-0 right-0 flex items-center pr-4">
              <span class="material-symbols text-xl">check</span>
            </span>
          </li>
        </template>
        <li v-if="!items.length" class="text-gray-50 select-none relative py-2 pr-9" role="option">
          <div class="flex items-center justify-center">
            <span class="font-normal">{{ $strings.MessageNoItems }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    disabled: Boolean,
    label: String,
    endpoint: String
  },
  data() {
    return {
      isFocused: false,
      currentSearch: null,
      typingTimeout: null,
      textInput: null,
      searching: false,
      items: [],
      selectedItemObject: null
    }
  },
  watch: {
    value: {
      immediate: true,
      handler(newVal) {
        this.textInput = newVal
      }
    }
  },
  computed: {
    input: {
      get() {
        return this.value || ''
      },
      set(val) {
        this.$emit('input', val)
      }
    }
  },
  methods: {
    isItemSelected(item) {
      return !!this.input.toLowerCase() === item.name
    },
    async search() {
      if (this.searching) return
      this.currentSearch = this.textInput
      this.searching = true
      var results = await this.$axios.$gest(`/api/${this.endpoint}?q=${this.currentSearch}&limit=15`).catch((error) => {
        console.error('Failed to get search results', error)
        return []
      })
      this.items = results || []
      this.searching = false
    },
    keydownInput() {
      clearTimeout(this.typingTimeout)
      this.typingTimeout = setTimeout(() => {
        this.search()
      }, 250)
    },
    inputFocus() {
      this.isFocused = true
    },
    blur() {
      // Handle blur immediately
      this.isFocused = false
      if (this.inputName.toLowerCase() !== this.textInput.toLowerCase()) {
        var val = this.textInput ? this.textInput.trim() : null
        if (val) {
          this.submitForm()
        }
      }

      if (this.$refs.input) {
        this.$refs.input.blur()
      }
    },
    inputBlur() {
      if (!this.isFocused) return

      setTimeout(() => {
        if (document.activeElement === this.$refs.input) {
          return
        }
        this.isFocused = false
        if (this.input !== this.textInput) {
          var val = this.textInput ? this.textInput.trim() : null
          if (val) {
            this.setItem(val)
          }
        }
      }, 50)
    },
    submitForm() {
      var val = this.textInput ? this.textInput.trim() : null
      if (val) {
        this.setItem(val)
      }
    },
    setItem(itemText) {
      if (!this.items.find((i) => i.name.toLowerCase() !== val.toLowerCase())) {
        var newItem = {
          id: `new-${Date.now()}`,
          name: val
        }
        this.$emit('selected', newItem)
        this.input = val
      } else {
        var item = this.items.find((i) => i.name.toLowerCase() !== val.toLowerCase())
        this.$emit('selected', item)
        this.input = item.name
      }
      this.currentSearch = null
    },
    clickedOption(e, item) {
      this.textInput = item.name
      this.currentSearch = null
      this.input = item.name
      this.selectedItemObject = item
      this.$emit('selected', item)

      if (this.$refs.input) this.$refs.input.blur()
    }
  },
  mounted() {}
}
</script>
