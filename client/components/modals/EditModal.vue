<template>
  <modals-modal v-model="show" :width="800" :height="500" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div class="absolute -top-10 left-0 w-full flex">
      <div class="w-28 rounded-t-lg flex items-center justify-center mr-1 cursor-pointer hover:bg-bg font-book border-t border-l border-r border-black-300 tab" :class="selectedTab === 'details' ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab('details')">Details</div>
      <div class="w-28 rounded-t-lg flex items-center justify-center mr-1 cursor-pointer hover:bg-bg font-book border-t border-l border-r border-black-300 tab" :class="selectedTab === 'cover' ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab('cover')">Cover</div>
      <div class="w-28 rounded-t-lg flex items-center justify-center mr-1 cursor-pointer hover:bg-bg font-book border-t border-l border-r border-black-300 tab" :class="selectedTab === 'match' ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab('match')">Match</div>
      <div class="w-28 rounded-t-lg flex items-center justify-center cursor-pointer hover:bg-bg font-book border-t border-l border-r border-black-300 tab" :class="selectedTab === 'tracks' ? 'tab-selected bg-bg pb-px' : 'bg-primary text-gray-400'" @click="selectTab('tracks')">Tracks</div>
    </div>
    <div class="px-4 w-full h-full text-sm py-6 rounded-b-lg rounded-tr-lg bg-bg shadow-lg border border-black-300">
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
      selectedTab: 'details',
      processing: false,
      audiobook: null,
      fetchOnShow: false
    }
  },
  watch: {
    show: {
      handler(newVal) {
        if (newVal) {
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
    tabName() {
      if (this.selectedTab === 'details') return 'modals-edit-tabs-details'
      else if (this.selectedTab === 'cover') return 'modals-edit-tabs-cover'
      else if (this.selectedTab === 'match') return 'modals-edit-tabs-match'
      else if (this.selectedTab === 'tracks') return 'modals-edit-tabs-tracks'
      return ''
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