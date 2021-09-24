<template>
  <div id="bookshelf" ref="wrapper" class="w-full h-full overflow-y-auto relative">
    <!-- Cover size widget -->
    <div v-show="!isSelectionMode" class="fixed bottom-2 right-4 z-20">
      <div class="rounded-full py-1 bg-primary px-2 border border-black-100 text-center flex items-center box-shadow-md" @mousedown.prevent @mouseup.prevent>
        <span class="material-icons" :class="selectedSizeIndex === 0 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="decreaseSize">remove</span>
        <p class="px-2 font-mono">{{ bookCoverWidth }}</p>
        <span class="material-icons" :class="selectedSizeIndex === availableSizes.length - 1 ? 'text-gray-400' : 'hover:text-yellow-300 cursor-pointer'" style="font-size: 0.9rem" @mousedown.prevent @click="increaseSize">add</span>
      </div>
    </div>

    <div v-if="!audiobooks.length" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl font-book mb-4 py-4">Your Audiobookshelf is empty!</p>
      <div class="flex">
        <ui-btn to="/config" color="primary" class="w-52 mr-2" @click="scan">Configure Scanner</ui-btn>
        <ui-btn color="success" class="w-52" @click="scan">Scan Audiobooks</ui-btn>
      </div>
    </div>
    <div v-else id="bookshelf" class="w-full flex flex-col items-center">
      <template v-for="(shelf, index) in shelves">
        <div :key="index" class="w-full bookshelfRow relative">
          <div class="flex justify-center items-center">
            <template v-for="entity in shelf">
              <cards-group-card v-if="showGroups" :key="entity.id" :width="bookCoverWidth" :group="entity" @click="clickGroup" />
              <!-- <cards-book-3d :key="entity.id" v-else :width="100" :src="$store.getters['audiobooks/getBookCoverSrc'](entity.book)" /> -->
              <cards-book-card v-else :key="entity.id" :width="bookCoverWidth" :user-progress="userAudiobooks[entity.id]" :audiobook="entity" />
            </template>
          </div>
          <div class="bookshelfDivider h-4 w-full absolute bottom-0 left-0 right-0 z-10" />
        </div>
      </template>
      <div v-show="!shelves.length" class="w-full py-16 text-center text-xl">
        <div class="py-4">No {{ showGroups ? 'Series' : 'Audiobooks' }}</div>
        <ui-btn v-if="!showGroups && (filterBy !== 'all' || keywordFilter)" @click="clearFilter">Clear Filter</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    page: String,
    selectedSeries: String
  },
  data() {
    return {
      shelves: [],
      currFilterOrderKey: null,
      availableSizes: [60, 80, 100, 120, 140, 160, 180, 200, 220],
      selectedSizeIndex: 3,
      rowPaddingX: 40,
      keywordFilterTimeout: null,
      scannerParseSubtitle: false
    }
  },
  watch: {
    keywordFilter() {
      this.checkKeywordFilter()
    },
    selectedSeries() {
      this.$nextTick(() => {
        this.setBookshelfEntities()
      })
    }
  },
  computed: {
    keywordFilter() {
      return this.$store.state.audiobooks.keywordFilter
    },
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    },
    audiobooks() {
      return this.$store.state.audiobooks.audiobooks
    },
    filterOrderKey() {
      return this.$store.getters['user/getFilterOrderKey']
    },
    bookCoverWidth() {
      return this.availableSizes[this.selectedSizeIndex]
    },
    sizeMultiplier() {
      return this.bookCoverWidth / 120
    },
    paddingX() {
      return 16 * this.sizeMultiplier
    },
    bookWidth() {
      return this.bookCoverWidth + this.paddingX * 2
    },
    isSelectionMode() {
      return this.$store.getters['getNumAudiobooksSelected']
    },
    filterBy() {
      return this.$store.getters['user/getUserSetting']('filterBy')
    },
    showGroups() {
      return this.page !== '' && !this.selectedSeries
    },
    entities() {
      if (this.page === '') {
        return this.$store.getters['audiobooks/getFilteredAndSorted']()
      } else {
        var seriesGroups = this.$store.getters['audiobooks/getSeriesGroups']()
        if (this.selectedSeries) {
          var group = seriesGroups.find((group) => group.name === this.selectedSeries)
          return group.books
        }
        return seriesGroups
      }
    }
  },
  methods: {
    clickGroup(group) {
      this.$emit('update:selectedSeries', group.name)
    },
    changeRotation() {
      this.rotation = 'show-right'
    },
    clearFilter() {
      this.$store.commit('audiobooks/setKeywordFilter', null)
      if (this.filterBy !== 'all') {
        this.$store.dispatch('user/updateUserSettings', {
          filterBy: 'all'
        })
      } else {
        this.setBookshelfEntities()
      }
    },
    checkKeywordFilter() {
      clearTimeout(this.keywordFilterTimeout)
      this.keywordFilterTimeout = setTimeout(() => {
        this.setBookshelfEntities()
      }, 500)
    },
    increaseSize() {
      this.selectedSizeIndex = Math.min(this.availableSizes.length - 1, this.selectedSizeIndex + 1)
      this.resize()
      this.$store.dispatch('user/updateUserSettings', { bookshelfCoverSize: this.bookCoverWidth })
    },
    decreaseSize() {
      this.selectedSizeIndex = Math.max(0, this.selectedSizeIndex - 1)
      this.resize()
      this.$store.dispatch('user/updateUserSettings', { bookshelfCoverSize: this.bookCoverWidth })
    },
    setBookshelfEntities() {
      var width = Math.max(0, this.$refs.wrapper.clientWidth - this.rowPaddingX * 2)
      var booksPerRow = Math.floor(width / this.bookWidth)

      var entities = this.entities
      var groups = []
      var currentRow = 0
      var currentGroup = []

      for (let i = 0; i < entities.length; i++) {
        var row = Math.floor(i / booksPerRow)
        if (row > currentRow) {
          groups.push([...currentGroup])
          currentRow = row
          currentGroup = []
        }
        currentGroup.push(entities[i])
      }
      if (currentGroup.length) {
        groups.push([...currentGroup])
      }
      this.shelves = groups
    },
    async init() {
      var bookshelfCoverSize = this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
      var sizeIndex = this.availableSizes.findIndex((s) => s === bookshelfCoverSize)
      if (!isNaN(sizeIndex)) this.selectedSizeIndex = sizeIndex

      var isLoading = await this.$store.dispatch('audiobooks/load')
      if (!isLoading) {
        this.setBookshelfEntities()
      }
    },
    resize() {
      this.$nextTick(() => {
        this.setBookshelfEntities()
      })
    },
    audiobooksUpdated() {
      console.log('[AudioBookshelf] Audiobooks Updated')
      this.setBookshelfEntities()
    },
    settingsUpdated(settings) {
      if (this.currFilterOrderKey !== this.filterOrderKey) {
        this.setBookshelfEntities()
      }
      if (settings.bookshelfCoverSize !== this.bookCoverWidth && settings.bookshelfCoverSize !== undefined) {
        var index = this.availableSizes.indexOf(settings.bookshelfCoverSize)
        if (index >= 0) {
          this.selectedSizeIndex = index
          this.resize()
        }
      }
    },
    scan() {
      this.$root.socket.emit('scan')
    }
  },
  mounted() {
    window.addEventListener('resize', this.resize)
    this.$store.commit('audiobooks/addListener', { id: 'bookshelf', meth: this.audiobooksUpdated })
    this.$store.commit('user/addSettingsListener', { id: 'bookshelf', meth: this.settingsUpdated })
    this.init()
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.resize)
    this.$store.commit('audiobooks/removeListener', 'bookshelf')
    this.$store.commit('user/removeSettingsListener', 'bookshelf')
  }
}
</script>

<style>
#bookshelf {
  height: calc(100% - 40px);
}
.bookshelfRow {
  background-image: url(/wood_panels.jpg);
}
.bookshelfDivider {
  background: rgb(149, 119, 90);
  background: linear-gradient(180deg, rgba(149, 119, 90, 1) 0%, rgba(103, 70, 37, 1) 17%, rgba(103, 70, 37, 1) 88%, rgba(71, 48, 25, 1) 100%);
  box-shadow: 2px 14px 8px #111111aa;
}
</style>