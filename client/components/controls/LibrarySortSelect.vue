<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-fg border border-gray-500 hover:border-gray-400 rounded shadow-sm pl-3 pr-3 py-0 text-left focus:outline-none sm:text-sm cursor-pointer" aria-haspopup="listbox" aria-expanded="true" aria-labelledby="listbox-label" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate text-xs" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
        <span class="material-icons text-lg text-yellow-400">{{ descending ? 'expand_more' : 'expand_less' }}</span>
      </span>
    </button>

    <ul v-show="showMenu" class="absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-96 rounded-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none text-sm" role="listbox" aria-labelledby="listbox-label">
      <template v-for="item in selectItems">
        <li :key="item.value" class="select-none relative py-2 pr-9 cursor-pointer hover:bg-white/5" :class="item.value === selected ? 'bg-white/5 text-yellow-400' : 'text-gray-200 hover:text-white'" role="option" @click="clickedOption(item.value)">
          <div class="flex items-center">
            <span class="font-normal ml-3 block truncate">{{ item.text }}</span>
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
    libraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    isPodcast() {
      return this.libraryMediaType === 'podcast'
    },
    isMusic() {
      return this.libraryMediaType === 'music'
    },
    podcastItems() {
      return [
        {
          text: this.$strings.LabelTitle,
          value: 'media.metadata.title'
        },
        {
          text: this.$strings.LabelAuthor,
          value: 'media.metadata.author'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelSize,
          value: 'size'
        },
        {
          text: this.$strings.LabelNumberOfEpisodes,
          value: 'media.numTracks'
        },
        {
          text: this.$strings.LabelFileBirthtime,
          value: 'birthtimeMs'
        },
        {
          text: this.$strings.LabelFileModified,
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
          text: this.$strings.LabelAuthorFirstLast,
          value: 'media.metadata.authorName'
        },
        {
          text: this.$strings.LabelAuthorLastFirst,
          value: 'media.metadata.authorNameLF'
        },
        {
          text: this.$strings.LabelPublishYear,
          value: 'media.metadata.publishedYear'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelSize,
          value: 'size'
        },
        {
          text: this.$strings.LabelDuration,
          value: 'media.duration'
        },
        {
          text: this.$strings.LabelFileBirthtime,
          value: 'birthtimeMs'
        },
        {
          text: this.$strings.LabelFileModified,
          value: 'mtimeMs'
        }
      ]
    },
    seriesItems() {
      return [
        ...this.bookItems,
        {
          text: this.$strings.LabelSequence,
          value: 'sequence'
        }
      ]
    },
    musicItems() {
      return [
        {
          text: this.$strings.LabelTitle,
          value: 'media.metadata.title'
        },
        {
          text: this.$strings.LabelAddedAt,
          value: 'addedAt'
        },
        {
          text: this.$strings.LabelSize,
          value: 'size'
        },
        {
          text: this.$strings.LabelDuration,
          value: 'media.duration'
        },
        {
          text: this.$strings.LabelFileBirthtime,
          value: 'birthtimeMs'
        },
        {
          text: this.$strings.LabelFileModified,
          value: 'mtimeMs'
        }
      ]
    },
    selectItems() {
      let items = null
      if (this.isPodcast) {
        items = this.podcastItems
      } else if (this.isMusic) {
        items = this.musicItems
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