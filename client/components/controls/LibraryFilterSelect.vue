<template>
  <div ref="wrapper" class="relative" v-click-outside="clickOutside">
    <button type="button" class="relative w-full h-full bg-bg border border-gray-500 hover:border-gray-400 rounded shadow-sm pl-3 pr-3 py-0 text-left focus:outline-none sm:text-sm cursor-pointer" aria-haspopup="listbox" aria-expanded="true" aria-labelledby="listbox-label" @click.prevent="showMenu = !showMenu">
      <span class="flex items-center justify-between">
        <span class="block truncate text-xs" :class="!selectedText ? 'text-gray-300' : ''">{{ selectedText }}</span>
      </span>
      <span v-if="selected === 'all'" class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </span>
      <div v-else class="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer text-gray-400 hover:text-gray-200" @mousedown.stop @mouseup.stop @click.stop.prevent="clearSelected">
        <span class="material-icons" style="font-size: 1.1rem">close</span>
      </div>
    </button>

    <div v-show="showMenu" class="absolute z-10 mt-1 w-full bg-bg border border-black-200 shadow-lg rounded-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none text-sm libraryFilterMenu">
      <ul v-show="!sublist" class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
        <template v-for="item in selectItems">
          <li :key="item.value" class="select-none relative py-2 pr-9 cursor-pointer hover:bg-white/5" :class="item.value === selected ? 'bg-white/5 text-yellow-400' : 'text-gray-200 hover:text-white'" role="option" @click="clickedOption(item)">
            <div class="flex items-center justify-between">
              <span class="font-normal ml-3 block truncate text-sm">{{ item.text }}</span>
            </div>
            <div v-if="item.sublist" class="absolute right-1 top-0 bottom-0 h-full flex items-center">
              <span class="material-icons text-2xl">arrow_right</span>
            </div>
            <!-- selected checkmark icon -->
            <div v-if="item.value === selected" class="absolute inset-y-0 right-2 h-full flex items-center pointer-events-none">
              <span class="material-icons text-base text-yellow-400">check</span>
            </div>
          </li>
        </template>
      </ul>
      <ul v-show="sublist" class="h-full w-full" role="listbox" aria-labelledby="listbox-label">
        <li class="text-gray-50 select-none relative py-2 pl-9 cursor-pointer hover:bg-white/5" role="option" @click="sublist = null">
          <div class="absolute left-1 top-0 bottom-0 h-full flex items-center">
            <span class="material-icons text-2xl">arrow_left</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-normal block truncate">Back</span>
          </div>
        </li>
        <li v-if="!sublistItems.length" class="text-gray-400 select-none relative px-2" role="option">
          <div class="flex items-center justify-center">
            <span class="font-normal block truncate py-2">No {{ sublist }}</span>
          </div>
        </li>
        <template v-for="item in sublistItems">
          <li :key="item.value" class="select-none relative px-2 cursor-pointer hover:bg-white/5" :class="`${sublist}.${item.value}` === selected ? 'bg-white/5 text-yellow-400' : 'text-gray-200 hover:text-white'" role="option" @click="clickedSublistOption(item.value)">
            <div class="flex items-center">
              <span class="font-normal truncate py-2 text-xs">{{ item.text }}</span>
            </div>
            <!-- selected checkmark icon -->
            <div v-if="`${sublist}.${item.value}` === selected" class="absolute inset-y-0 right-2 h-full flex items-center pointer-events-none">
              <span class="material-icons text-base text-yellow-400">check</span>
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
    isSeries: Boolean
  },
  data() {
    return {
      showMenu: false,
      sublist: null
    }
  },
  watch: {
    showMenu(newVal) {
      if (newVal) {
        this.sublist = this.selectedItemSublist
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
    libraryMediaType() {
      return this.$store.getters['libraries/getCurrentLibraryMediaType']
    },
    isPodcast() {
      return this.libraryMediaType === 'podcast'
    },
    isMusic() {
      return this.libraryMediaType === 'music'
    },
    seriesItems() {
      return [
        {
          text: this.$strings.LabelAll,
          value: 'all'
        },
        {
          text: this.$strings.LabelGenre,
          value: 'genres',
          sublist: true
        },
        {
          text: this.$strings.LabelTag,
          value: 'tags',
          sublist: true
        },
        {
          text: this.$strings.LabelAuthor,
          value: 'authors',
          sublist: true
        },
        {
          text: this.$strings.LabelNarrator,
          value: 'narrators',
          sublist: true
        },
        {
          text: this.$strings.LabelPublisher,
          value: 'publishers',
          sublist: true
        },
        {
          text: this.$strings.LabelLanguage,
          value: 'languages',
          sublist: true
        },
        {
          text: this.$strings.LabelSeriesProgress,
          value: 'progress',
          sublist: true
        }
      ]
    },
    bookItems() {
      return [
        {
          text: this.$strings.LabelAll,
          value: 'all'
        },
        {
          text: this.$strings.LabelGenre,
          value: 'genres',
          sublist: true
        },
        {
          text: this.$strings.LabelTag,
          value: 'tags',
          sublist: true
        },
        {
          text: this.$strings.LabelSeries,
          value: 'series',
          sublist: true
        },
        {
          text: this.$strings.LabelAuthor,
          value: 'authors',
          sublist: true
        },
        {
          text: this.$strings.LabelNarrator,
          value: 'narrators',
          sublist: true
        },
        {
          text: this.$strings.LabelPublisher,
          value: 'publishers',
          sublist: true
        },
        {
          text: this.$strings.LabelLanguage,
          value: 'languages',
          sublist: true
        },
        {
          text: this.$strings.LabelProgress,
          value: 'progress',
          sublist: true
        },
        {
          text: this.$strings.LabelMissing,
          value: 'missing',
          sublist: true
        },
        {
          text: this.$strings.LabelTracks,
          value: 'tracks',
          sublist: true
        },
        {
          text: this.$strings.LabelEbooks,
          value: 'ebooks',
          sublist: true
        },
        {
          text: this.$strings.LabelAbridged,
          value: 'abridged',
          sublist: false
        },
        {
          text: this.$strings.ButtonIssues,
          value: 'issues',
          sublist: false
        },
        {
          text: this.$strings.LabelRSSFeedOpen,
          value: 'feed-open',
          sublist: false
        }
      ]
    },
    podcastItems() {
      return [
        {
          text: this.$strings.LabelAll,
          value: 'all'
        },
        {
          text: this.$strings.LabelGenre,
          value: 'genres',
          sublist: true
        },
        {
          text: this.$strings.LabelTag,
          value: 'tags',
          sublist: true
        },
        {
          text: this.$strings.LabelLanguage,
          value: 'languages',
          sublist: true
        },
        {
          text: this.$strings.ButtonIssues,
          value: 'issues',
          sublist: false
        }
      ]
    },
    musicItems() {
      return [
        {
          text: this.$strings.LabelAll,
          value: 'all'
        },
        {
          text: this.$strings.LabelGenre,
          value: 'genres',
          sublist: true
        },
        {
          text: this.$strings.LabelTag,
          value: 'tags',
          sublist: true
        },
        {
          text: this.$strings.ButtonIssues,
          value: 'issues',
          sublist: false
        }
      ]
    },
    selectItems() {
      if (this.isSeries) return this.seriesItems
      if (this.isPodcast) return this.podcastItems
      if (this.isMusic) return this.musicItems
      return this.bookItems
    },
    selectedItemSublist() {
      return this.selected?.includes('.') ? this.selected.split('.')[0] : null
    },
    selectedText() {
      if (!this.selected) return ''
      const parts = this.selected.split('.')
      const filterName = this.selectItems.find((i) => i.value === parts[0])
      let filterValue = null
      if (parts.length > 1) {
        const decoded = this.$decode(parts[1])
        if (parts[0] === 'authors') {
          const author = this.authors.find((au) => au.id == decoded)
          if (author) filterValue = author.name
        } else if (parts[0] === 'series') {
          if (decoded === 'no-series') {
            filterValue = this.$strings.MessageNoSeries
          } else {
            const series = this.series.find((se) => se.id == decoded)
            if (series) filterValue = series.name
          }
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
    publishers() {
      return this.filterData.publishers || []
    },
    progress() {
      return [
        {
          id: 'finished',
          name: this.$strings.LabelFinished
        },
        {
          id: 'in-progress',
          name: this.$strings.LabelInProgress
        },
        {
          id: 'not-started',
          name: this.$strings.LabelNotStarted
        },
        {
          id: 'not-finished',
          name: this.$strings.LabelNotFinished
        }
      ]
    },
    tracks() {
      return [
        {
          id: 'none',
          name: this.$strings.LabelTracksNone
        },
        {
          id: 'single',
          name: this.$strings.LabelTracksSingleTrack
        },
        {
          id: 'multi',
          name: this.$strings.LabelTracksMultiTrack
        }
      ]
    },
    ebooks() {
      return [
        {
          id: 'ebook',
          name: this.$strings.LabelHasEbook
        },
        {
          id: 'no-ebook',
          name: this.$strings.LabelMissingEbook
        },
        {
          id: 'supplementary',
          name: this.$strings.LabelHasSupplementaryEbook
        },
        {
          id: 'no-supplementary',
          name: this.$strings.LabelMissingSupplementaryEbook
        }
      ]
    },
    missing() {
      return [
        {
          id: 'asin',
          name: 'ASIN'
        },
        {
          id: 'isbn',
          name: 'ISBN'
        },
        {
          id: 'subtitle',
          name: this.$strings.LabelSubtitle
        },
        {
          id: 'authors',
          name: this.$strings.LabelAuthor
        },
        {
          id: 'publishedYear',
          name: this.$strings.LabelPublishYear
        },
        {
          id: 'series',
          name: this.$strings.LabelSeries
        },
        {
          id: 'description',
          name: this.$strings.LabelDescription
        },
        {
          id: 'genres',
          name: this.$strings.LabelGenres
        },
        {
          id: 'tags',
          name: this.$strings.LabelTags
        },
        {
          id: 'narrators',
          name: this.$strings.LabelNarrator
        },
        {
          id: 'publisher',
          name: this.$strings.LabelPublisher
        },
        {
          id: 'language',
          name: this.$strings.LabelLanguage
        },
        {
          id: 'cover',
          name: this.$strings.LabelCover
        }
      ]
    },
    sublistItems() {
      const sublistItems = (this[this.sublist] || []).map((item) => {
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
      if (this.sublist === 'series') {
        sublistItems.unshift({
          text: this.$strings.MessageNoSeries,
          value: this.$encode('no-series')
        })
      }
      return sublistItems
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

      const val = option.value
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

<style scoped>
.libraryFilterMenu {
  max-height: calc(100vh - 125px);
}
</style>