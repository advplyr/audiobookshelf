<template>
  <modals-modal v-model="show" :width="800" :height="height" :processing="processing" :content-margin-top="75">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="absolute -top-10 left-0 w-full flex">
      <template v-for="tab in availableTabs">
        <div :key="tab.id" class="w-28 rounded-t-lg flex items-center justify-center mr-1 cursor-pointer hover:bg-bg font-book border-t border-l border-r border-black-300 tab" :class="selectedTab === tab.id ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab(tab.id)">{{ tab.title }}</div>
      </template>
    </div>
    <div class="w-full h-full text-sm rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300">
      <keep-alive>
        <component v-if="audiobook" :is="tabName" :audiobook="audiobook" :processing.sync="processing" @close="show = false" />
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
        // {
        //   id: 'match',
        //   title: 'Match',
        //   component: 'modals-edit-tabs-match'
        // },
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
          id: 'download',
          title: 'Download',
          component: 'modals-edit-tabs-download'
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
    availableTabs() {
      if (!this.userCanUpdate && !this.userCanDownload) return []
      return this.tabs.filter((tab) => {
        if (tab.id === 'download' && this.isMissing) return false
        if ((tab.id === 'download' || tab.id === 'tracks') && this.userCanDownload) return true
        if (tab.id !== 'download' && tab.id !== 'tracks' && this.userCanUpdate) return true
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
    }
  },
  methods: {
    selectTab(tab) {
      this.selectedTab = tab
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
        this.audiobook = await this.$axios.$get(`/api/audiobook/${this.selectedAudiobookId}`)
      } catch (error) {
        console.error('Failed to fetch audiobook', this.selectedAudiobookId, error)
        this.show = false
      }
    }
  },
  mounted() {}
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