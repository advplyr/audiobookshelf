<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-fg border border-gray-500 hover:border-gray-400 rounded shadow-sm pl-3 pr-3 py-0 text-left focus:outline-none sm:text-sm cursor-pointer" aria-haspopup="listbox" aria-expanded="true" aria-labelledby="listbox-label" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate text-xs" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
      </span>
      <span v-if="selected === 'all'" class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
      <div v-else class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer text-gray-400 hover:text-gray-300" @mousedown.stop @mouseup.stop @click.stop.prevent="clearSelected">
        <span class="material-icons" style="font-size: 1.1rem">close</span>
      </div>
    </button>

    <div v-show="showMenu" class="absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-96 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
      <ul v-show="!sublist" class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
        <template v-for="item in selectItems">
          <li :key="item.value" class="text-gray-50 select-none relative py-2 pr-9 cursor-pointer hover:bg-black-400" :class="item.value === selected ? 'bg-primary bg-opacity-50' : ''" role="option" @click="clickedOption(item)">
            <div class="flex items-center justify-between">
              <span class="font-normal ml-3 block truncate text-sm md:text-base">{{ item.text }}</span>
            </div>
            <div v-if="item.sublist" class="absolute right-1 top-0 bottom-0 h-full flex items-center">
              <span class="material-icons">arrow_right</span>
            </div>
          </li>
        </template>
      </ul>
      <ul v-show="sublist" class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
        <li class="text-gray-50 select-none relative py-2 pl-9 cursor-pointer hover:bg-black-400" role="option" @click="sublist = null">
          <div class="absolute left-1 top-0 bottom-0 h-full flex items-center">
            <span class="material-icons">arrow_left</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-normal ml-3 block truncate">Back</span>
          </div>
        </li>
        <li v-if="!sublistItems.length" class="text-gray-400 select-none relative px-2" role="option">
          <div class="flex items-center justify-center">
            <span class="font-normal block truncate py-2">No {{ sublist }}</span>
          </div>
        </li>
        <li v-else-if="sublist === 'series'" class="text-gray-50 select-none relative px-2 cursor-pointer hover:bg-black-400" role="option" @click="clickedSublistOption($encode('No Series'))">
          <div class="flex items-center">
            <span class="font-normal block truncate py-2 text-xs text-white text-opacity-80">No Series</span>
          </div>
        </li>
        <template v-for="item in sublistItems">
          <li :key="item.value" class="text-gray-50 select-none relative px-2 cursor-pointer hover:bg-black-400" :class="`${sublist}.${item.value}` === selected ? 'bg-primary bg-opacity-50' : ''" role="option" @click="clickedSublistOption(item.value)">
            <div class="flex items-center">
              <span class="font-normal truncate py-2 text-xs">{{ item.text }}</span>
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
    value: String
  },
  data() {
    return {
      showMenu: false,
      sublist: null,
      bookItems: [
        {
          text: 'All',
          value: 'all'
        },
        {
          text: 'Genre',
          value: 'genres',
          sublist: true
        },
        {
          text: 'Tag',
          value: 'tags',
          sublist: true
        },
        {
          text: 'Series',
          value: 'series',
          sublist: true
        },
        {
          text: 'Authors',
          value: 'authors',
          sublist: true
        },
        {
          text: 'Narrator',
          value: 'narrators',
          sublist: true
        },
        {
          text: 'Language',
          value: 'languages',
          sublist: true
        },
        {
          text: 'Progress',
          value: 'progress',
          sublist: true
        },
        {
          text: 'Missing',
          value: 'missing',
          sublist: true
        },
        {
          text: 'Issues',
          value: 'issues',
          sublist: false
        }
      ],
      podcastItems: [
        {
          text: 'All',
          value: 'all'
        },
        {
          text: 'Genre',
          value: 'genres',
          sublist: true
        },
        {
          text: 'Tag',
          value: 'tags',
          sublist: true
        },
        {
          text: 'Issues',
          value: 'issues',
          sublist: false
        }
      ]
    }
  },
  watch: {
    showMenu(newVal) {
      if (!newVal) {
        if (this.sublist && !this.selectedItemSublist) this.sublist = null
        if (!this.sublist && this.selectedItemSublist) this.sublist = this.selectedItemSublist
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
    isPodcast() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType'] == 'podcast'
    },
    selectItems() {
      if (this.isPodcast) return this.podcastItems
      return this.bookItems
    },
    selectedItemSublist() {
      return this.selected && this.selected.includes('.') ? this.selected.split('.')[0] : false
    },
    selectedText() {
      if (!this.selected) return ''
      var parts = this.selected.split('.')
      var filterName = this.selectItems.find((i) => i.value === parts[0])
      var filterValue = null
      if (parts.length > 1) {
        var decoded = this.$decode(parts[1])
        if (decoded.startsWith('aut_')) {
          var author = this.authors.find((au) => au.id == decoded)
          if (author) filterValue = author.name
        } else if (decoded.startsWith('ser_')) {
          var series = this.series.find((se) => se.id == decoded)
          if (series) filterValue = series.name
        } else {
          filterValue = decoded
        }
      }
      if (filterName && filterValue) {
        return `${filterName.text}: ${filterValue}`
      } else if (filterName) {
        return filterName.text
      } else if (filterValue) {
        return filterValue
      } else {
        return ''
      }
    },
    genres() {
      return this.filterData.genres || []
    },
    tags() {
      return this.filterData.tags || []
    },
    series() {
      return this.filterData.series || []
    },
    authors() {
      return this.filterData.authors || []
    },
    narrators() {
      return this.filterData.narrators || []
    },
    languages() {
      return this.filterData.languages || []
    },
    progress() {
      return ['Finished', 'In Progress', 'Not Started', 'Not Finished']
    },
    missing() {
      return ['ASIN', 'ISBN', 'Subtitle', 'Author', 'Publish Year', 'Series', 'Description', 'Genres', 'Tags', 'Narrator', 'Publisher', 'Language']
    },
    sublistItems() {
      return (this[this.sublist] || []).map((item) => {
        if (typeof item === 'string') {
          return {
            text: item,
            value: this.$encode(item)
          }
        } else {
          return {
            text: item.name,
            value: this.$encode(item.id)
          }
        }
      })
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
      if (!this.selectedItemSublist) this.sublist = null
      this.showMenu = false
    },
    clickedSublistOption(item) {
      this.clickedOption({ value: `${this.sublist}.${item}` })
    },
    clickedOption(option) {
      if (option.sublist) {
        this.sublist = option.value
        return
      }

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