<template>
  <div class="w-full py-6">
    <div class="flex items-center mb-4">
      <p class="text-lg mb-0 font-semibold">Episodes</p>
      <div class="flex-grow" />
      <template v-if="isSelectionMode">
        <ui-btn color="error" small @click="removeSelectedEpisodes">Remove {{ selectedEpisodes.length }} episode{{ selectedEpisodes.length > 1 ? 's' : '' }}</ui-btn>
        <ui-btn small class="ml-2" @click="clearSelected">Cancel</ui-btn>
      </template>
      <controls-episode-sort-select v-else v-model="sortKey" :descending.sync="sortDesc" class="w-36 sm:w-44 md:w-48 h-9 ml-1 sm:ml-4" />
    </div>
    <p v-if="!episodes.length" class="py-4 text-center text-lg">No Episodes</p>
    <template v-for="episode in episodesSorted">
      <tables-podcast-episode-table-row ref="episodeRow" :key="episode.id" :episode="episode" :library-item-id="libraryItem.id" :selection-mode="isSelectionMode" class="item" @play="playEpisode" @remove="removeEpisode" @edit="editEpisode" @view="viewEpisode" @selected="episodeSelected" />
    </template>

    <modals-podcast-remove-episode v-model="showPodcastRemoveModal" @input="removeEpisodeModalToggled" :library-item="libraryItem" :episodes="episodesToRemove" @clearSelected="clearSelected" />
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      episodesCopy: [],
      sortKey: 'publishedAt',
      sortDesc: true,
      selectedEpisode: null,
      showPodcastRemoveModal: false,
      selectedEpisodes: [],
      episodesToRemove: []
    }
  },
  watch: {
    libraryItem() {
      this.init()
    }
  },
  computed: {
    isSelectionMode() {
      return this.selectedEpisodes.length > 0
    },
    userCanUpdate() {
      return this.$store.getters['user/getUserCanUpdate']
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    episodes() {
      return this.media.episodes || []
    },
    episodesSorted() {
      return this.episodesCopy.sort((a, b) => {
        if (this.sortDesc) {
          return String(b[this.sortKey]).localeCompare(String(a[this.sortKey]), undefined, { numeric: true, sensitivity: 'base' })
        }
        return String(a[this.sortKey]).localeCompare(String(b[this.sortKey]), undefined, { numeric: true, sensitivity: 'base' })
      })
    }
  },
  methods: {
    removeEpisodeModalToggled(val) {
      if (!val) this.episodesToRemove = []
    },
    clearSelected() {
      const episodeRows = this.$refs.episodeRow
      if (episodeRows && episodeRows.length) {
        for (const epRow of episodeRows) {
          if (epRow) epRow.isSelected = false
        }
      }
      this.selectedEpisodes = []
    },
    removeSelectedEpisodes() {
      this.episodesToRemove = this.selectedEpisodes
      this.showPodcastRemoveModal = true
    },
    episodeSelected({ isSelected, episode }) {
      if (isSelected) {
        this.selectedEpisodes.push(episode)
      } else {
        this.selectedEpisodes = this.selectedEpisodes.filter((ep) => ep.id !== episode.id)
      }
    },
    playEpisode(episode) {
      const queueItems = []
      const episodeIndex = this.episodes.findIndex((e) => e.id === episode.id)
      for (let i = episodeIndex; i < this.episodes.length; i++) {
        const episode = this.episodes[i]
        const audioFile = episode.audioFile
        queueItems.push({
          libraryItemId: this.libraryItem.id,
          episodeId: episode.id,
          title: episode.title,
          subtitle: this.mediaMetadata.title,
          duration: audioFile.duration || null,
          coverPath: this.media.coverPath || null
        })
      }

      this.$eventBus.$emit('play-item', {
        libraryItemId: this.libraryItem.id,
        episodeId: episode.id,
        queueItems
      })
    },
    removeEpisode(episode) {
      this.episodesToRemove = [episode]
      this.showPodcastRemoveModal = true
    },
    editEpisode(episode) {
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
    },
    viewEpisode(episode) {
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowViewPodcastEpisodeModal', true)
    },
    init() {
      this.episodesCopy = this.episodes.map((ep) => ({ ...ep }))
    }
  },
  mounted() {
    this.init()
  }
}
</script>

<style>
.episode-item {
  transition: all 0.4s ease;
}

.episode-enter-from,
.episode-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.episode-leave-active {
  position: absolute;
}
</style>