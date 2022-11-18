<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-fg border border-gray-500 hover:border-gray-400 rounded shadow-sm pl-3 pr-3 py-0 text-left focus:outline-none sm:text-sm cursor-pointer" aria-haspopup="listbox" aria-expanded="true" aria-labelledby="listbox-label" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate text-xs" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
        <span class="material-icons text-lg text-yellow-400">{{ descending ? 'expand_more' : 'expand_less' }}</span>
      </span>
    </button>

    <ul v-show="showMenu" class="absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-96 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm" role="listbox" aria-labelledby="listbox-label">
      <template v-for="item in selectItems">
        <li :key="item.value" class="text-gray-50 select-none relative py-2 pr-9 cursor-pointer hover:bg-black-400" :class="item.value === selected ? 'bg-primary bg-opacity-50' : ''" role="option" @click="clickedOption(item.value)">
          <div class="flex items-center">
            <span class="font-normal ml-3 block truncate text-xs">{{ item.text }}</span>
          </div>
          <span v-if="item.value === selected" class="text-yellow-400 absolute inset-y-0 right-0 flex items-center pr-4">
            <span class="material-icons text-xl">{{ descending ? 'expand_more' : 'expand_less' }}</span>
          </span>
        </li>
      </template>
    </ul>
  </div>
</template>

<script>
export default {
  props: {
    value: String,
    descending: Boolean
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
    selectedDesc: {
      get() {
        return this.descending
      },
      set(val) {
        this.$emit('update:descending', val)
      }
    },
    isPodcast() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType'] == 'podcast'
    },
    podcastItems() {
      return [
        {
          text: 'Title',
          value: 'media.metadata.title'
        },
        {
          text: 'Author',
          value: 'media.metadata.author'
        },
        {
          text: 'Added At',
          value: 'addedAt'
        },
        {
          text: 'Size',
          value: 'size'
        },
        {
          text: '# of Episodes',
          value: 'media.numTracks'
        },
        {
          text: 'File Birthtime',
          value: 'birthtimeMs'
        },
        {
          text: 'File Modified',
          value: 'mtimeMs'
        }
      ]
    },
    bookItems() {
      return [
        {
          text: this.$strings.LabelTitle,
          value: 'media.metadata.title'
        },
        {
          text: 'Author (First Last)',
          value: 'media.metadata.authorName'
        },
        {
          text: 'Author (Last, First)',
          value: 'media.metadata.authorNameLF'
        },
        {
          text: 'Published Year',
          value: 'media.metadata.publishedYear'
        },
        {
          text: 'Added At',
          value: 'addedAt'
        },
        {
          text: 'Size',
          value: 'size'
        },
        {
          text: 'Duration',
          value: 'media.duration'
        },
        {
          text: 'File Birthtime',
          value: 'birthtimeMs'
        },
        {
          text: 'File Modified',
          value: 'mtimeMs'
        }
      ]
    },
    seriesItems() {
      return [
        ...this.bookItems,
        {
          text: 'Sequence',
          value: 'sequence'
        }
      ]
    },
    selectItems() {
      let items = null
      if (this.isPodcast) {
        items = this.podcastItems
      } else if (this.$store.getters['user/getUserSetting']('filterBy').startsWith('series.')) {
        items = this.seriesItems
      } else {
        items = this.bookItems
      }

      if (!items.some((i) => i.value === this.selected)) {
        this.selected = items[0].value
        this.selectedDesc = !this.defaultsToAsc(items[0].value)
      }

      return items
    },
    selectedText() {
      var _selected = this.selected
      if (!_selected) return ''
      if (this.selected.startsWith('book.')) _selected = _selected.replace('book.', 'media.metadata.')
      var _sel = this.selectItems.find((i) => i.value === _selected)
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
        this.selectedDesc = !this.selectedDesc
      } else {
        this.selected = val
        if (this.defaultsToAsc(val)) this.selectedDesc = false
      }
      this.showMenu = false
      this.$nextTick(() => this.$emit('change', val))
    },
    defaultsToAsc(val) {
      return val == 'media.metadata.title' || val == 'media.metadata.author' || val == 'media.metadata.authorName' || val == 'media.metadata.authorNameLF' || val == 'sequence'
    }
  }
}
</script>