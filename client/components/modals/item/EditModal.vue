<template>
  <modals-modal v-model="show" name="edit-book" :width="800" :height="height" :processing="processing" :content-margin-top="marginTop">
    <template #outer>
      <div class="absolute top-0 left-0 p-4 landscape:px-4 landscape:py-2 md:portrait:p-5 lg:p-5 w-2/3 overflow-hidden pointer-events-none">
        <h1 class="text-xl md:portrait:text-3xl md:landscape:text-lg lg:text-3xl text-white truncate pointer-events-none">{{ title }}</h1>
      </div>
    </template>
    <div role="tablist" class="absolute -top-10 left-0 z-10 w-full flex">
      <template v-for="tab in availableTabs">
        <button :key="tab.id" role="tab" class="w-28 rounded-t-lg flex items-center justify-center mr-0.5 sm:mr-1 cursor-pointer hover:bg-bg border-t border-l border-r border-black-300 tab text-xs sm:text-base" :class="selectedTab === tab.id ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab(tab.id)">{{ tab.title }}</button>
      </template>
    </div>

    <div role="tabpanel" class="w-full h-full max-h-full text-sm rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300 relative">
      <component v-if="libraryItem && show" :is="tabName" :library-item="libraryItem" :processing.sync="processing" @close="show = false" @selectTab="selectTab" />
    </div>

    <div v-show="canGoPrev" class="absolute -left-24 top-0 bottom-0 h-full pointer-events-none flex items-center px-6">
      <button class="material-symbols text-5xl text-white/50 hover:text-white/90 cursor-pointer pointer-events-auto" :aria-label="$strings.ButtonNext" @click.stop.prevent="goPrevBook" @mousedown.prevent>arrow_back_ios</button>
    </div>
    <div v-show="canGoNext" class="absolute -right-24 top-0 bottom-0 h-full pointer-events-none flex items-center px-6">
      <button class="material-symbols text-5xl text-white/50 hover:text-white/90 cursor-pointer pointer-events-auto" :aria-label="$strings.ButtonPrevious" @click.stop.prevent="goNextBook" @mousedown.prevent>arrow_forward_ios</button>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      libraryItem: null,
      availableHeight: 0,
      marginTop: 0
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
    height() {
      return Math.min(this.availableHeight, 650)
    },
    tabs() {
      return [
        {
          id: 'details',
          title: this.$strings.HeaderDetails,
          component: 'modals-item-tabs-details'
        },
        {
          id: 'cover',
          title: this.$strings.HeaderCover,
          component: 'modals-item-tabs-cover'
        },
        {
          id: 'chapters',
          title: this.$strings.HeaderChapters,
          component: 'modals-item-tabs-chapters',
          mediaType: 'book'
        },
        {
          id: 'episodes',
          title: this.$strings.HeaderEpisodes,
          component: 'modals-item-tabs-episodes',
          mediaType: 'podcast'
        },
        {
          id: 'files',
          title: this.$strings.HeaderFiles,
          component: 'modals-item-tabs-files'
        },
        {
          id: 'match',
          title: this.$strings.HeaderMatch,
          component: 'modals-item-tabs-match'
        },
        {
          id: 'tools',
          title: this.$strings.HeaderTools,
          component: 'modals-item-tabs-tools',
          mediaType: 'book',
          admin: true
        },
        {
          id: 'schedule',
          title: this.$strings.HeaderSchedule,
          component: 'modals-item-tabs-schedule',
          mediaType: 'podcast',
          admin: true
        }
      ]
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    userCanDownload() {
      return this.$store.getters['user/getUserCanDownload']
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    selectedLibraryItem() {
      return this.$store.state.selectedLibraryItem || {}
    },
    selectedLibraryItemId() {
      return this.selectedLibraryItem.id
    },
    media() {
      return this.libraryItem?.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    availableTabs() {
      if (!this.userCanUpdate && !this.userCanDownload) return []
      return this.tabs.filter((tab) => {
        if (tab.mediaType && this.mediaType !== tab.mediaType) return false
        if (tab.admin && !this.userIsAdminOrUp) return false

        if (tab.id === 'tools' && this.isMissing) return false
        if (tab.id === 'chapters' && this.isEBookOnly) return false

        if ((tab.id === 'tools' || tab.id === 'files') && this.userCanDownload) return true
        if (tab.id !== 'tools' && tab.id !== 'files' && this.userCanUpdate) return true
        if (tab.id === 'match' && this.userCanUpdate) return true
        return false
      })
    },
    tabName() {
      var _tab = this.tabs.find((t) => t.id === this.selectedTab)
      return _tab ? _tab.component : ''
    },
    isMissing() {
      return this.selectedLibraryItem.isMissing
    },
    isEBookOnly() {
      return this.media.ebookFile && !this.media.tracks?.length
    },
    mediaType() {
      return this.libraryItem?.mediaType || null
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
      // Remove focus from active input
      document.activeElement?.blur?.()

      var prevBookId = this.bookshelfBookIds[this.currentBookshelfIndex - 1]
      this.processing = true
      var prevBook = await this.$axios.$get(`/api/items/${prevBookId}?expanded=1`).catch((error) => {
        var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to fetch book'
        this.$toast.error(errorMsg)
        return null
      })
      this.processing = false
      if (prevBook) {
        this.unregisterListeners()
        this.libraryItem = prevBook
        this.$store.commit('setSelectedLibraryItem', prevBook)
        this.$nextTick(this.registerListeners)
      } else {
        console.error('Book not found', prevBookId)
      }
    },
    async goNextBook() {
      if (this.currentBookshelfIndex >= this.bookshelfBookIds.length - 1) return
      // Remove focus from active input
      document.activeElement?.blur?.()

      this.processing = true
      var nextBookId = this.bookshelfBookIds[this.currentBookshelfIndex + 1]
      var nextBook = await this.$axios.$get(`/api/items/${nextBookId}?expanded=1`).catch((error) => {
        var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to fetch book'
        this.$toast.error(errorMsg)
        return null
      })
      this.processing = false
      if (nextBook) {
        this.unregisterListeners()
        this.libraryItem = nextBook
        this.$store.commit('setSelectedLibraryItem', nextBook)
        this.$nextTick(this.registerListeners)
      } else {
        console.error('Book not found', nextBookId)
      }
    },
    selectTab(tab) {
      if (this.selectedTab === tab) return
      if (this.availableTabs.find((t) => t.id === tab)) {
        this.selectedTab = tab
        this.processing = false
      }
    },
    libraryItemUpdated(expandedLibraryItem) {
      this.libraryItem = expandedLibraryItem
    },
    init() {
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
      window.addEventListener('orientationchange', this.orientationChange)
      this.$eventBus.$on('modal-hotkey', this.hotkey)
      this.$eventBus.$on(`${this.selectedLibraryItemId}_updated`, this.libraryItemUpdated)
    },
    unregisterListeners() {
      window.removeEventListener('orientationchange', this.orientationChange)
      this.$eventBus.$off('modal-hotkey', this.hotkey)
      this.$eventBus.$off(`${this.selectedLibraryItemId}_updated`, this.libraryItemUpdated)
    },
    orientationChange() {
      setTimeout(this.setHeight, 50)
    },
    setHeight() {
      const smAndBelow = window.innerWidth < 1024 && window.innerWidth > window.innerHeight

      this.marginTop = smAndBelow ? 90 : 75
      const heightModifier = smAndBelow ? 95 : 150
      this.availableHeight = window.innerHeight - heightModifier
    }
  },
  mounted() {
    this.setHeight()
  },
  beforeDestroy() {
    this.unregisterListeners()
  }
}
</script>

<style scoped>
.tab {
  height: 40px;
}
.tab.tab-selected {
  height: 41px;
}
</style>
