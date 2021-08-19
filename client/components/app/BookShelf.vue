<template>
  <div id="bookshelf" ref="wrapper" class="w-full h-full overflow-y-auto">
    <div v-if="!audiobooks.length" class="w-full flex flex-col items-center justify-center py-12">
      <p class="text-center text-2xl font-book mb-4">Your Audiobookshelf is empty!</p>
      <ui-btn color="success" @click="scan">Scan your Audiobooks</ui-btn>
    </div>
    <div class="w-full flex flex-col items-center">
      <template v-for="(shelf, index) in groupedBooks">
        <div :key="index" class="w-full bookshelfRow relative">
          <div class="flex justify-center items-center">
            <template v-for="audiobook in shelf">
              <cards-book-card :ref="`audiobookCard-${audiobook.id}`" :key="audiobook.id" :user-progress="userAudiobooks[audiobook.id]" :audiobook="audiobook" />
            </template>
          </div>
          <div class="bookshelfDivider h-4 w-full absolute bottom-0 left-0 right-0 z-10" />
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      width: 0,
      bookWidth: 176,
      booksPerRow: 0,
      groupedBooks: [],
      currFilterOrderKey: null
    }
  },
  computed: {
    userAudiobooks() {
      return this.$store.state.user ? this.$store.state.user.audiobooks || {} : {}
    },
    audiobooks() {
      return this.$store.state.audiobooks.audiobooks
    },
    filterOrderKey() {
      return this.$store.getters['settings/getFilterOrderKey']
    }
  },
  methods: {
    setGroupedBooks() {
      var groups = []
      var currentRow = 0
      var currentGroup = []

      var audiobooksSorted = this.$store.getters['audiobooks/getFilteredAndSorted']()
      this.currFilterOrderKey = this.filterOrderKey

      for (let i = 0; i < audiobooksSorted.length; i++) {
        var row = Math.floor(i / this.booksPerRow)
        if (row > currentRow) {
          groups.push([...currentGroup])
          currentRow = row
          currentGroup = []
        }
        currentGroup.push(audiobooksSorted[i])
      }
      if (currentGroup.length) {
        groups.push([...currentGroup])
      }
      this.groupedBooks = groups
    },
    calculateBookshelf() {
      this.width = this.$refs.wrapper.clientWidth
      var booksPerRow = Math.floor(this.width / this.bookWidth)
      this.booksPerRow = booksPerRow
    },
    getAudiobookCard(id) {
      if (this.$refs[`audiobookCard-${id}`] && this.$refs[`audiobookCard-${id}`].length) {
        return this.$refs[`audiobookCard-${id}`][0]
      }
      return null
    },
    init() {
      this.calculateBookshelf()
    },
    resize() {
      this.$nextTick(() => {
        this.calculateBookshelf()
        this.setGroupedBooks()
      })
    },
    audiobooksUpdated() {
      console.log('[AudioBookshelf] Audiobooks Updated')
      this.setGroupedBooks()
    },
    settingsUpdated() {
      // var newSortKey = `${this.orderBy}-${this.orderDesc}`
      if (this.currFilterOrderKey !== this.filterOrderKey) {
        this.setGroupedBooks()
      }
    },
    scan() {
      this.$root.socket.emit('scan')
    }
  },
  mounted() {
    this.$store.commit('audiobooks/addListener', { id: 'bookshelf', meth: this.audiobooksUpdated })
    this.$store.commit('settings/addListener', { id: 'bookshelf', meth: this.settingsUpdated })

    this.$store.dispatch('audiobooks/load')
    this.init()
    window.addEventListener('resize', this.resize)
  },
  beforeDestroy() {
    this.$store.commit('audiobooks/removeListener', 'bookshelf')
    this.$store.commit('settings/removeListener', 'bookshelf')
    window.removeEventListener('resize', this.resize)
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