<template>
  <modals-modal v-model="show" name="podcast-episode-edit-modal" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="absolute -top-10 left-0 z-10 w-full flex">
      <template v-for="tab in tabs">
        <div :key="tab.id" class="w-28 rounded-t-lg flex items-center justify-center mr-0.5 sm:mr-1 cursor-pointer hover:bg-bg border-t border-l border-r border-black-300 tab text-xs sm:text-base" :class="selectedTab === tab.id ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab(tab.id)">{{ tab.title }}</div>
      </template>
    </div>

    <div v-show="canGoPrev" class="absolute -left-24 top-0 bottom-0 h-full pointer-events-none flex items-center px-6">
      <div class="material-symbols text-5xl text-white text-opacity-50 hover:text-opacity-90 cursor-pointer pointer-events-auto" @click.stop.prevent="goPrevEpisode" @mousedown.prevent>arrow_back_ios</div>
    </div>
    <div v-show="canGoNext" class="absolute -right-24 top-0 bottom-0 h-full pointer-events-none flex items-center px-6">
      <div class="material-symbols text-5xl text-white text-opacity-50 hover:text-opacity-90 cursor-pointer pointer-events-auto" @click.stop.prevent="goNextEpisode" @mousedown.prevent>arrow_forward_ios</div>
    </div>

    <div ref="wrapper" class="p-4 w-full text-sm rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300 relative overflow-y-auto" style="max-height: 80vh">
      <component v-if="libraryItem && show" :is="tabComponentName" :library-item="libraryItem" :episode="episodeItem" :processing.sync="processing" @close="show = false" @selectTab="selectTab" />
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      episodeItem: null,
      processing: false,
      tabs: [
        {
          id: 'details',
          title: this.$strings.HeaderDetails,
          component: 'modals-podcast-tabs-episode-details'
        },
        {
          id: 'match',
          title: this.$strings.HeaderMatch,
          component: 'modals-podcast-tabs-episode-match'
        }
      ]
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
          const availableTabIds = this.tabs.map((tab) => tab.id)
          if (!availableTabIds.length) {
            this.show = false
            return
          }

          if (!availableTabIds.includes(this.selectedTab)) {
            this.selectedTab = availableTabIds[0]
          }

          this.episodeItem = null
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
        return this.$store.state.globals.showEditPodcastEpisode
      },
      set(val) {
        this.$store.commit('globals/setShowEditPodcastEpisodeModal', val)
      }
    },
    selectedTab: {
      get() {
        return this.$store.state.editPodcastModalTab
      },
      set(val) {
        this.$store.commit('setEditPodcastModalTab', val)
      }
    },
    libraryItem() {
      return this.$store.state.selectedLibraryItem
    },
    episode() {
      return this.$store.state.globals.selectedEpisode
    },
    selectedEpisodeId() {
      return this.episode.id
    },
    title() {
      return this.libraryItem?.media.metadata.title || 'Unknown'
    },
    tabComponentName() {
      const _tab = this.tabs.find((t) => t.id === this.selectedTab)
      return _tab ? _tab.component : ''
    },
    episodeTableEpisodeIds() {
      return this.$store.state.episodeTableEpisodeIds || []
    },
    currentEpisodeIndex() {
      if (!this.episodeTableEpisodeIds.length) return 0
      return this.episodeTableEpisodeIds.findIndex((bid) => bid === this.selectedEpisodeId)
    },
    canGoPrev() {
      return this.episodeTableEpisodeIds.length && this.currentEpisodeIndex > 0
    },
    canGoNext() {
      return this.episodeTableEpisodeIds.length && this.currentEpisodeIndex < this.episodeTableEpisodeIds.length - 1
    }
  },
  methods: {
    async goPrevEpisode() {
      if (this.currentEpisodeIndex - 1 < 0) return
      const prevEpisodeId = this.episodeTableEpisodeIds[this.currentEpisodeIndex - 1]
      this.processing = true
      const prevEpisode = await this.$axios.$get(`/api/podcasts/${this.libraryItem.id}/episode/${prevEpisodeId}`).catch((error) => {
        const errorMsg = error.response && error.response.data ? error.response.data : 'Failed to fetch episode'
        this.$toast.error(errorMsg)
        return null
      })
      this.processing = false
      if (prevEpisode) {
        this.episodeItem = prevEpisode
        this.$store.commit('globals/setSelectedEpisode', prevEpisode)
      } else {
        console.error('Episode not found', prevEpisodeId)
      }
    },
    async goNextEpisode() {
      if (this.currentEpisodeIndex >= this.episodeTableEpisodeIds.length - 1) return
      this.processing = true
      const nextEpisodeId = this.episodeTableEpisodeIds[this.currentEpisodeIndex + 1]
      const nextEpisode = await this.$axios.$get(`/api/podcasts/${this.libraryItem.id}/episode/${nextEpisodeId}`).catch((error) => {
        const errorMsg = error.response && error.response.data ? error.response.data : 'Failed to fetch book'
        this.$toast.error(errorMsg)
        return null
      })
      this.processing = false
      if (nextEpisode) {
        this.episodeItem = nextEpisode
        this.$store.commit('globals/setSelectedEpisode', nextEpisode)
      } else {
        console.error('Episode not found', nextEpisodeId)
      }
    },
    selectTab(tab) {
      if (this.selectedTab === tab) return
      if (this.tabs.find((t) => t.id === tab)) {
        this.selectedTab = tab
        this.processing = false
      }
    },
    init() {
      this.fetchFull()
    },
    async fetchFull() {
      try {
        this.processing = true
        this.episodeItem = await this.$axios.$get(`/api/podcasts/${this.libraryItem.id}/episode/${this.selectedEpisodeId}`)
        this.processing = false
      } catch (error) {
        console.error('Failed to fetch episode', this.selectedEpisodeId, error)
        this.processing = false
        this.show = false
      }
    },
    hotkey(action) {
      if (action === this.$hotkeys.Modal.NEXT_PAGE) {
        this.goNextEpisode()
      } else if (action === this.$hotkeys.Modal.PREV_PAGE) {
        this.goPrevEpisode()
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

<style scoped>
.tab {
  height: 40px;
}
.tab.tab-selected {
  height: 41px;
}
</style>
