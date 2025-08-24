<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-fg border border-gray-500 hover:border-gray-400 rounded-sm shadow-xs pl-3 pr-3 py-0 text-left focus:outline-hidden sm:text-sm cursor-pointer" aria-haspopup="menu" :aria-expanded="showMenu" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate text-xs" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
        <span class="material-symbols text-lg text-yellow-400" :aria-label="descending ? $strings.LabelSortDescending : $strings.LabelSortAscending">{{ descending ? 'expand_more' : 'expand_less' }}</span>
      </span>
    </button>

    <ul v-show="showMenu" class="librarySortMenu absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg max-h-96 rounded-md py-1 ring-1 ring-black/5 overflow-auto focus:outline-hidden text-sm" role="menu">
      <template v-for="item in selectItems">
        <li :key="item.value" class="select-none relative py-2 pr-9 cursor-pointer hover:bg-white/5" :class="item.value === selected ? 'bg-white/5 text-yellow-400' : 'text-gray-200 hover:text-white'" role="menuitem" @click="clickedOption(item.value)">
          <div class="flex items-center">
            <span class="font-normal ml-3 block truncate">{{ item.text }}</span>
          </div>
          <span v-if="item.value === selected" class="text-yellow-400 absolute inset-y-0 right-0 flex items-center pr-4">
            <span class="material-symbols text-xl" :aria-label="descending ? $strings.LabelSortDescending : $strings.LabelSortAscending">{{ descending ? 'expand_more' : 'expand_less' }}</span>
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
        },
        {
          text: this.$strings.LabelRandomly,
          value: 'random'
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
        },
        {
          text: this.$strings.LabelLibrarySortByProgress,
          value: 'progress'
        },
        {
          text: this.$strings.LabelLibrarySortByProgressStarted,
          value: 'progress.createdAt'
        },
        {
          text: this.$strings.LabelLibrarySortByProgressFinished,
          value: 'progress.finishedAt'
        },
        {
          text: this.$strings.LabelRandomly,
          value: 'random'
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

<style scoped>
.librarySortMenu {
  max-height: calc(100vh - 125px);
}
</style>
