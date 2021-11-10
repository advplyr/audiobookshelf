<template>
  <modals-modal v-model="show" name="edit-book" :width="800" :height="height" :processing="processing" :content-margin-top="75">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="absolute -top-10 left-0 w-full flex">
      <template v-for="tab in availableTabs">
        <div :key="tab.id" class="w-28 rounded-t-lg flex items-center justify-center mr-1 cursor-pointer hover:bg-bg font-book border-t border-l border-r border-black-300 tab text-xs sm:text-base" :class="selectedTab === tab.id ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab(tab.id)">{{ tab.title }}</div>
      </template>
    </div>

    <div v-show="canGoPrev" class="absolute -left-24 top-0 bottom-0 h-full pointer-events-none flex items-center px-6">
      <div class="material-icons text-5xl text-white text-opacity-50 hover:text-opacity-90 cursor-pointer pointer-events-auto" @click.stop.prevent="goPrevBook" @mousedown.prevent>arrow_back_ios</div>
    </div>
    <div v-show="canGoNext" class="absolute -right-24 top-0 bottom-0 h-full pointer-events-none flex items-center px-6">
      <div class="material-icons text-5xl text-white text-opacity-50 hover:text-opacity-90 cursor-pointer pointer-events-auto" @click.stop.prevent="goNextBook" @mousedown.prevent>arrow_forward_ios</div>
    </div>

    <div class="w-full h-full text-sm rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300">
      <keep-alive>
        <component v-if="audiobook" :is="tabName" :audiobook="audiobook" :processing.sync="processing" @close="show = false" @selectTab="selectTab" />
      </keep-alive>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      audiobook: null,
      fetchOnShow: false,
      tabs: [
        {
          id: 'details',
          title: 'Details',
          component: 'modals-edit-tabs-details'
        },
        {
          id: 'cover',
          title: 'Cover',
          component: 'modals-edit-tabs-cover'
        },
        {
          id: 'tracks',
          title: 'Tracks',
          component: 'modals-edit-tabs-tracks'
        },
        {
          id: 'chapters',
          title: 'Chapters',
          component: 'modals-edit-tabs-chapters'
        },
        {
          id: 'files',
          title: 'Files',
          component: 'modals-edit-tabs-files'
        },
        {
          id: 'download',
          title: 'Download',
          component: 'modals-edit-tabs-download'
        },
        {
          id: 'match',
          title: 'Match',
          component: 'modals-edit-tabs-match'
        }
      ]
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          var availableTabIds = this.availableTabs.map((tab) => tab.id)
          if (!availableTabIds.length) {
            this.show = false
            return
          }

          if (!availableTabIds.includes(this.selectedTab)) {
            this.selectedTab = availableTabIds[0]
          }

          if (this.audiobook && this.audiobook.id === this.selectedAudiobookId) {
            if (this.fetchOnShow) this.fetchFull()
            return
          }
          this.fetchOnShow = false
          this.audiobook = null
          this.init()
          this.registerListeners()
        } else {
          this.unregisterListeners()
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.showEditModal
      },
      set(val) {
        this.$store.commit('setShowEditModal', val)
      }
    },
    selectedTab: {
      get() {
        return this.$store.state.editModalTab
      },
      set(val) {
        this.$store.commit('setEditModalTab', val)
      }
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    availableTabs() {
      if (!this.userCanUpdate && !this.userCanDownload) return []
      return this.tabs.filter((tab) => {
        if (tab.id === 'download' && this.isMissing) return false
        if ((tab.id === 'download' || tab.id === 'tracks') && this.userCanDownload) return true
        if (tab.id !== 'download' && tab.id !== 'tracks' && this.userCanUpdate) return true
        if (tab.id === 'match' && this.userCanUpdate && this.showExperimentalFeatures) return true
        return false
      })
    },
    height() {
      var maxHeightAllowed = window.innerHeight - 150
      return Math.min(maxHeightAllowed, 650)
    },
    tabName() {
      var _tab = this.tabs.find((t) => t.id === this.selectedTab)
      return _tab ? _tab.component : ''
    },
    isMissing() {
      return this.selectedAudiobook.isMissing
    },
    selectedAudiobook() {
      return this.$store.state.selectedAudiobook || {}
    },
    selectedAudiobookId() {
      return this.selectedAudiobook.id
    },
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    },
    title() {
      return this.book.title || 'No Title'
    },
    bookshelfBookIds() {
      return this.$store.state.bookshelfBookIds || []
    },
    currentBookshelfIndex() {
      if (!this.bookshelfBookIds.length) return 0
      return this.bookshelfBookIds.findIndex((bid) => bid === this.selectedAudiobookId)
    },
    canGoPrev() {
      return this.bookshelfBookIds.length && this.currentBookshelfIndex > 0
    },
    canGoNext() {
      return this.bookshelfBookIds.length && this.currentBookshelfIndex < this.bookshelfBookIds.length - 1
    }
  },
  methods: {
    goPrevBook() {
      if (this.currentBookshelfIndex - 1 < 0) return
      var prevBookId = this.bookshelfBookIds[this.currentBookshelfIndex - 1]
      var prevBook = this.$store.getters['audiobooks/getAudiobook'](prevBookId)
      if (prevBook) {
        this.$store.commit('showEditModalOnTab', { audiobook: prevBook, tab: this.selectedTab })
        this.$nextTick(this.init)
      } else {
        console.error('Book not found', prevBookId)
      }
    },
    goNextBook() {
      if (this.currentBookshelfIndex >= this.bookshelfBookIds.length - 1) return

      var nextBookId = this.bookshelfBookIds[this.currentBookshelfIndex + 1]
      var nextBook = this.$store.getters['audiobooks/getAudiobook'](nextBookId)
      if (nextBook) {
        this.$store.commit('showEditModalOnTab', { audiobook: nextBook, tab: this.selectedTab })
        this.$nextTick(this.init)
      } else {
        console.error('Book not found', nextBookId)
      }
    },
    selectTab(tab) {
      if (this.availableTabs.find((t) => t.id === tab)) {
        this.selectedTab = tab
      }
    },
    audiobookUpdated() {
      if (!this.show) this.fetchOnShow = true
      else {
        this.fetchFull()
      }
    },
    init() {
      this.$store.commit('audiobooks/addListener', { meth: this.audiobookUpdated, id: 'edit-modal', audiobookId: this.selectedAudiobookId })
      this.fetchFull()
    },
    async fetchFull() {
      try {
        this.processing = true
        this.audiobook = await this.$axios.$get(`/api/audiobook/${this.selectedAudiobookId}`)
        this.processing = false
      } catch (error) {
        console.error('Failed to fetch audiobook', this.selectedAudiobookId, error)
        this.processing = false
        this.show = false
      }
    },
    hotkey(action) {
      if (action === this.$hotkeys.Modal.NEXT_PAGE) {
        this.goNextBook()
      } else if (action === this.$hotkeys.Modal.PREV_PAGE) {
        this.goPrevBook()
      }
    },
    registerListeners() {
      this.$eventBus.$on('modal-hotkey', this.hotkey)
    },
    unregisterListeners() {
      this.$eventBus.$off('modal-hotkey', this.hotkey)
    }
  },
  mounted() {},
  beforeDestroy() {
    this.unregisterListeners()
  }
}
</script>

<style>
.tab {
  height: 40px;
}
.tab.tab-selected {
  height: 41px;
}
</style>