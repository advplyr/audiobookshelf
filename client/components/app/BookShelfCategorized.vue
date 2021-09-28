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
    <div v-else id="bookshelf" class="w-full flex flex-col items-center">
      <template v-for="(shelf, index) in shelves">
        <div :key="index" class="relative">
          <div class="w-full bookshelfRowCategorized relative overflow-x-scroll overflow-y-hidden z-10" :style="{ paddingLeft: 4 * sizeMultiplier + 'rem' }">
            <div class="w-full h-full" :style="{ marginTop: sizeMultiplier + 'rem' }">
              <div class="flex items-center -mb-2">
                <template v-for="entity in shelf.books">
                  <cards-book-card :key="entity.id" :width="bookCoverWidth" :user-progress="userAudiobooks[entity.id]" :audiobook="entity" />
                </template>
              </div>
            </div>
          </div>
          <!-- <div class="absolute text-center box-shadow-book categoryPlacard font-book transform z-30" :style="{ top: sizeMultiplier + 'rem', left: 1.5 * signSizeMultiplier + 'rem', height: 2 * signSizeMultiplier + 'rem', width: 9 * signSizeMultiplier + 'rem', padding: 0.25 * signSizeMultiplier + 'rem', borderRadius: 0.375 * signSizeMultiplier + 'rem' }">
            <div class="w-px bg-white shadow-sm bg-opacity-60 absolute transform skew-x-6" :style="{ height: sizeMultiplier + 'rem', top: -sizeMultiplier + 'rem', left: 1.25 * signSizeMultiplier + 'rem' }" />
            <div class="w-px bg-white shadow-sm bg-opacity-60 absolute transform -skew-x-6" :style="{ height: sizeMultiplier + 'rem', top: -sizeMultiplier + 'rem', right: 1.25 * signSizeMultiplier + 'rem' }" />
            <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm" :style="{ borderWidth: 0.125 * signSizeMultiplier + 'rem' }">
              <p class="transform" :style="{ fontSize: 0.875 * signSizeMultiplier + 'rem' }">{{ shelf.label }}</p>
            </div>
          </div> -->

          <!-- <div class="absolute text-center box-shadow-side categoryPlacard font-book transform z-30 bottom-4" :style="{ left: 0.5 * signSizeMultiplier + 'rem', height: 2 * signSizeMultiplier + 'rem', width: 9 * signSizeMultiplier + 'rem', padding: 0.25 * signSizeMultiplier + 'rem', borderRadius: 0.375 * signSizeMultiplier + 'rem' }">
            <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm" :style="{ borderWidth: 0.125 * signSizeMultiplier + 'rem' }">
              <p class="transform" :style="{ fontSize: 0.875 * signSizeMultiplier + 'rem' }">{{ shelf.label }}</p>
            </div>
          </div> -->

          <div class="absolute text-center categoryPlacard font-book transform z-30 bottom-0.5 left-8 w-36 rounded-md" style="height: 22px">
            <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm border">
              <p class="transform text-sm">{{ shelf.label }}</p>
            </div>
          </div>

          <!-- <div class="absolute text-center box-shadow-book categoryPlacard font-book transform z-30 -rotate-45 origin-bottom-right" :style="{ top: -1 * sizeMultiplier + 'rem', left: -1 * signSizeMultiplier + 'rem', height: 2 * signSizeMultiplier + 'rem', width: 9 * signSizeMultiplier + 'rem', padding: 0.25 * signSizeMultiplier + 'rem', borderRadius: 0.375 * signSizeMultiplier + 'rem' }">
            <div class="w-full h-full shinyBlack flex items-center justify-center rounded-sm" :style="{ borderWidth: 0.125 * signSizeMultiplier + 'rem' }">
              <p class="transform" :style="{ fontSize: 0.875 * signSizeMultiplier + 'rem' }">{{ shelf.label }}</p>
            </div>
          </div> -->
          <div class="bookshelfDividerCategorized h-6 w-full absolute bottom-0 left-0 right-0 z-20"></div>
        </div>
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
      wrapperClientWidth: 0
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
    signSizeMultiplier() {
      return (1 - this.sizeMultiplier) / 2 + this.sizeMultiplier
    },
    paddingX() {
      return 16 * this.sizeMultiplier
    },
    bookWidth() {
      return this.bookCoverWidth + this.paddingX * 2
    },
    mostRecentPlayed() {
      var audiobooks = this.audiobooks.filter((ab) => this.userAudiobooks[ab.id] && this.userAudiobooks[ab.id].lastUpdate > 0).map((ab) => ({ ...ab }))
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
      var shelves = [
        { books: this.mostRecentPlayed, label: 'Continue Reading' },
        { books: this.mostRecentAdded, label: 'Recently Added' }
      ]
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
.bookshelfRowCategorized {
  width: calc(100vw - 80px);
  background-image: url(/wood_panels.jpg);
}
.bookshelfDividerCategorized {
  background: rgb(149, 119, 90);
  /* background: linear-gradient(180deg, rgba(149, 119, 90, 1) 0%, rgba(103, 70, 37, 1) 17%, rgba(103, 70, 37, 1) 88%, rgba(71, 48, 25, 1) 100%); */
  background: linear-gradient(180deg, rgb(122, 94, 68) 0%, rgb(92, 62, 31) 17%, rgb(82, 54, 26) 88%, rgba(71, 48, 25, 1) 100%);
  /* background: linear-gradient(180deg, rgb(114, 85, 59) 0%, rgb(73, 48, 22) 17%, rgb(71, 43, 15) 88%, rgb(61, 41, 20) 100%); */
  box-shadow: 2px 14px 8px #111111aa;
}

.categoryPlacard {
  background-image: url(https://image.freepik.com/free-photo/brown-wooden-textured-flooring-background_53876-128537.jpg);
  letter-spacing: 1px;
}

.shinyBlack {
  background-color: #2d3436;
  background-image: linear-gradient(315deg, #19191a 0%, rgb(15, 15, 15) 74%);

  /* border-color: #daa520; */
  /* border-color: #ebc463af; */
  border-color: rgba(255, 244, 182, 0.6);
  border-style: solid;
  /* color: rgba(255, 244, 182, 1); */
  color: #fce3a6;
}

.shinyWhite {
  background-color: #ffffff;
  background-image: linear-gradient(315deg, #ffffff 0%, #ebebeb 74%);

  /* border-color: #cc9917aa; */
  border-style: solid;
  color: rgba(19, 19, 19, 1);

  font-weight: 600;
}
</style>