<template>
  <div id="bookshelf" ref="wrapper" class="w-full h-full overflow-y-scroll relative">
    <!-- Cover size widget -->
    <div class="fixed bottom-2 right-4 z-40">
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
    <div v-else class="w-full flex flex-col items-center">
      <template v-for="(shelf, index) in shelves">
        <app-book-shelf-row :key="index" :index="index" :shelf="shelf" :size-multiplier="sizeMultiplier" :book-cover-width="bookCoverWidth" />
      </template>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      availableSizes: [60, 80, 100, 120, 140, 160, 180, 200, 220],
      selectedSizeIndex: 3,
      rowPaddingX: 40,
      keywordFilterTimeout: null,
      scannerParseSubtitle: false,
      wrapperClientWidth: 0,
      overflowingShelvesRight: {},
      overflowingShelvesLeft: {}
    }
  },
  computed: {
    userAudiobooks() {
      return this.$store.state.user.user ? this.$store.state.user.user.audiobooks || {} : {}
    },
    audiobooks() {
      return this.$store.state.audiobooks.audiobooks
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
    mostRecentPlayed() {
      var audiobooks = this.audiobooks.filter((ab) => this.userAudiobooks[ab.id] && this.userAudiobooks[ab.id].lastUpdate > 0 && this.userAudiobooks[ab.id].progress > 0 && !this.userAudiobooks[ab.id].isRead).map((ab) => ({ ...ab }))
      audiobooks.sort((a, b) => {
        return this.userAudiobooks[b.id].lastUpdate - this.userAudiobooks[a.id].lastUpdate
      })
      return audiobooks.slice(0, 10)
    },
    mostRecentAdded() {
      var audiobooks = this.audiobooks.map((ab) => ({ ...ab })).sort((a, b) => b.addedAt - a.addedAt)
      return audiobooks.slice(0, 10)
    },
    seriesGroups() {
      return this.$store.getters['audiobooks/getSeriesGroups']()
    },
    recentlyUpdatedSeries() {
      var mostRecentTime = 0
      var mostRecentSeries = null
      this.seriesGroups.forEach((series) => {
        if ((series.books.length && mostRecentSeries === null) || series.lastUpdate > mostRecentTime) {
          mostRecentTime = series.lastUpdate
          mostRecentSeries = series
        }
      })
      if (!mostRecentSeries) return null
      return mostRecentSeries.books
    },
    booksRecentlyRead() {
      var audiobooks = this.audiobooks.filter((ab) => this.userAudiobooks[ab.id] && this.userAudiobooks[ab.id].isRead).map((ab) => ({ ...ab }))
      audiobooks.sort((a, b) => {
        return this.userAudiobooks[b.id].finishedAt - this.userAudiobooks[a.id].finishedAt
      })
      return audiobooks.slice(0, 10)
    },
    shelves() {
      var shelves = []
      if (this.mostRecentPlayed.length) {
        shelves.push({ books: this.mostRecentPlayed, label: 'Continue Reading' })
      }

      shelves.push({ books: this.mostRecentAdded, label: 'Recently Added' })

      if (this.recentlyUpdatedSeries) {
        shelves.push({ books: this.recentlyUpdatedSeries, label: 'Newest Series' })
      }

      if (this.booksRecentlyRead.length) {
        shelves.push({ books: this.booksRecentlyRead, label: 'Read Again' })
      }
      return shelves
    }
  },
  methods: {
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
    async init() {
      this.wrapperClientWidth = this.$refs.wrapper ? this.$refs.wrapper.clientWidth : 0

      var bookshelfCoverSize = this.$store.getters['user/getUserSetting']('bookshelfCoverSize')
      var sizeIndex = this.availableSizes.findIndex((s) => s === bookshelfCoverSize)
      if (!isNaN(sizeIndex)) this.selectedSizeIndex = sizeIndex

      await this.$store.dispatch('audiobooks/load')
    },
    resize() {},
    audiobooksUpdated() {},
    settingsUpdated(settings) {
      if (settings.bookshelfCoverSize !== this.bookCoverWidth && settings.bookshelfCoverSize !== undefined) {
        var index = this.availableSizes.indexOf(settings.bookshelfCoverSize)
        if (index >= 0) {
          this.selectedSizeIndex = index
          this.resize()
        }
      }
    },
    scan() {
      this.$root.socket.emit('scan', this.$store.state.libraries.currentLibraryId)
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
