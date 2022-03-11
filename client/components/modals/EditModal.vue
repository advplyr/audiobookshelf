<template>
  <modals-modal v-model="show" name="edit-book" :width="800" :height="height" :processing="processing" :content-margin-top="75">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden pointer-events-none">
        <p class="font-book text-3xl text-white truncate pointer-events-none">{{ title }}</p>
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
      <component v-if="libraryItem && show" :is="tabName" :library-item="libraryItem" :processing.sync="processing" @close="show = false" @selectTab="selectTab" />
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      libraryItem: null,
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
        // {
        //   id: 'authors',
        //   title: 'Authors',
        //   component: 'modals-edit-tabs-authors'
        // }
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

          if (this.libraryItem && this.libraryItem.id === this.selectedLibraryItemId) {
            if (this.fetchOnShow) this.fetchFull()
            return
          }
          this.fetchOnShow = false
          this.libraryItem = null
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
        if ((tab.id === 'download' || tab.id === 'files' || tab.id === 'authors') && this.userCanDownload) return true
        if (tab.id !== 'download' && tab.id !== 'files' && tab.id !== 'authors' && this.userCanUpdate) return true
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
      return this.selectedLibraryItem.isMissing
    },
    selectedLibraryItem() {
      return this.$store.state.selectedLibraryItem || {}
    },
    selectedLibraryItemId() {
      return this.selectedLibraryItem.id
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    title() {
      return this.mediaMetadata.title || 'No Title'
    },
    bookshelfBookIds() {
      return this.$store.state.bookshelfBookIds || []
    },
    currentBookshelfIndex() {
      if (!this.bookshelfBookIds.length) return 0
      return this.bookshelfBookIds.findIndex((bid) => bid === this.selectedLibraryItemId)
    },
    canGoPrev() {
      return this.bookshelfBookIds.length && this.currentBookshelfIndex > 0
    },
    canGoNext() {
      return this.bookshelfBookIds.length && this.currentBookshelfIndex < this.bookshelfBookIds.length - 1
    }
  },
  methods: {
    async goPrevBook() {
      if (this.currentBookshelfIndex - 1 < 0) return
      var prevBookId = this.bookshelfBookIds[this.currentBookshelfIndex - 1]
      this.processing = true
      var prevBook = await this.$axios.$get(`/api/books/${prevBookId}`).catch((error) => {
        var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to fetch book'
        this.$toast.error(errorMsg)
        return null
      })
      this.processing = false
      if (prevBook) {
        this.$store.commit('showEditModalOnTab', { libraryItem: prevBook, tab: this.selectedTab })
        this.$nextTick(this.init)
      } else {
        console.error('Book not found', prevBookId)
      }
    },
    async goNextBook() {
      if (this.currentBookshelfIndex >= this.bookshelfBookIds.length - 1) return
      this.processing = true
      var nextBookId = this.bookshelfBookIds[this.currentBookshelfIndex + 1]
      var nextBook = await this.$axios.$get(`/api/books/${nextBookId}`).catch((error) => {
        var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to fetch book'
        this.$toast.error(errorMsg)
        return null
      })
      this.processing = false
      if (nextBook) {
        this.$store.commit('showEditModalOnTab', { libraryItem: nextBook, tab: this.selectedTab })
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
      this.$store.commit('audiobooks/addListener', { meth: this.audiobookUpdated, id: 'edit-modal', audiobookId: this.selectedLibraryItemId })
      this.fetchFull()
    },
    async fetchFull() {
      try {
        this.processing = true
        this.libraryItem = await this.$axios.$get(`/api/items/${this.selectedLibraryItemId}?expanded=1`)
        this.processing = false
      } catch (error) {
        console.error('Failed to fetch audiobook', this.selectedLibraryItemId, error)
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