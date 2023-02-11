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

    <div ref="wrapper" class="p-4 w-full text-sm rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300 relative overflow-y-auto" style="max-height: 80vh">
      <component v-if="libraryItem && show" :is="tabComponentName" :library-item="libraryItem" :episode="episode" :processing.sync="processing" @close="show = false" @selectTab="selectTab" />
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false,
      selectedTab: 'details',
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
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showEditPodcastEpisode
      },
      set(val) {
        this.$store.commit('globals/setShowEditPodcastEpisodeModal', val)
      }
    },
    libraryItem() {
      return this.$store.state.selectedLibraryItem
    },
    episode() {
      return this.$store.state.globals.selectedEpisode
    },
    title() {
      if (!this.libraryItem) return ''
      return this.libraryItem.media.metadata.title || 'Unknown'
    },
    tabComponentName() {
      var _tab = this.tabs.find((t) => t.id === this.selectedTab)
      return _tab ? _tab.component : ''
    }
  },
  methods: {
    selectTab(tab) {
      this.selectedTab = tab
    }
  },
  mounted() {}
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