<template>
  <div class="w-full py-6">
    <div class="flex items-center mb-4">
      <p class="text-lg mb-0 font-semibold">Episodes</p>
      <div class="flex-grow" />
      <controls-episode-sort-select v-model="sortKey" :descending.sync="sortDesc" class="w-36 sm:w-44 md:w-48 h-9 ml-1 sm:ml-4" />
    </div>
    <p v-if="!episodes.length" class="py-4 text-center text-lg">No Episodes</p>
    <template v-for="episode in episodesSorted">
      <tables-podcast-episode-table-row :key="episode.id" :episode="episode" :library-item-id="libraryItem.id" class="item" @remove="removeEpisode" @edit="editEpisode" />
    </template>

    <modals-podcast-remove-episode v-model="showPodcastRemoveModal" :library-item="libraryItem" :episode="selectedEpisode" />
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
      showPodcastRemoveModal: false
    }
  },
  watch: {
    libraryItem() {
      this.init()
    }
  },
  computed: {
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
    removeEpisode(episode) {
      this.selectedEpisode = episode
      this.showPodcastRemoveModal = true
    },
    editEpisode(episode) {
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
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