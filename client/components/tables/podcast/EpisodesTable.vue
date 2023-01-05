<template>
  <div class="w-full py-6">
    <p class="text-lg mb-2 font-semibold md:hidden">{{ $strings.HeaderEpisodes }}</p>
    <div class="flex items-center mb-4">
      <p class="text-lg mb-0 font-semibold hidden md:block">{{ $strings.HeaderEpisodes }}</p>
      <div class="flex-grow hidden md:block" />
      <template v-if="isSelectionMode">
        <ui-tooltip :text="selectedIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="bottom">
          <ui-read-icon-btn :disabled="processing" :is-read="selectedIsFinished" @click="toggleBatchFinished" class="mx-1.5" />
        </ui-tooltip>
        <ui-btn color="error" :disabled="processing" small class="h-9" @click="removeSelectedEpisodes">{{ $getString('MessageRemoveEpisodes', [selectedEpisodes.length]) }}</ui-btn>
        <ui-btn :disabled="processing" small class="ml-2 h-9" @click="clearSelected">{{ $strings.ButtonCancel }}</ui-btn>
      </template>
      <template v-else>
        <controls-filter-select v-model="filterKey" :items="filterItems" class="w-36 h-9 sm:ml-4" />
        <controls-sort-select v-model="sortKey" :descending.sync="sortDesc" :items="sortItems" class="w-44 md:w-48 h-9 ml-1 sm:ml-4" />
        <div class="flex-grow md:hidden" />
        <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" class="ml-1" @action="contextMenuAction" />
      </template>
    </div>
    <p v-if="!episodes.length" class="py-4 text-center text-lg">{{ $strings.MessageNoEpisodes }}</p>
    <template v-for="episode in episodesSorted">
      <tables-podcast-episode-table-row ref="episodeRow" :key="episode.id" :episode="episode" :library-item-id="libraryItem.id" :selection-mode="isSelectionMode" class="item" @play="playEpisode" @remove="removeEpisode" @edit="editEpisode" @view="viewEpisode" @selected="episodeSelected" @addToQueue="addEpisodeToQueue" @addToPlaylist="addToPlaylist" />
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
      filterKey: 'incomplete',
      sortKey: 'publishedAt',
      sortDesc: true,
      selectedEpisode: null,
      showPodcastRemoveModal: false,
      selectedEpisodes: [],
      episodesToRemove: [],
      processing: false,
      quickMatchingEpisodes: false
    }
  },
  watch: {
    libraryItem: {
      handler() {
        this.init()
      }
    }
  },
  computed: {
    contextMenuItems() {
      if (!this.userIsAdminOrUp) return []
      return [
        {
          text: 'Quick match all episodes',
          action: 'quick-match-episodes'
        }
      ]
    },
    sortItems() {
      return [
        {
          text: this.$strings.LabelPubDate,
          value: 'publishedAt'
        },
        {
          text: this.$strings.LabelTitle,
          value: 'title'
        },
        {
          text: this.$strings.LabelSeason,
          value: 'season'
        },
        {
          text: this.$strings.LabelEpisode,
          value: 'episode'
        }
      ]
    },
    filterItems() {
      return [
        {
          value: 'all',
          text: this.$strings.LabelShowAll
        },
        {
          value: 'incomplete',
          text: this.$strings.LabelIncomplete
        },
        {
          value: 'complete',
          text: this.$strings.LabelComplete
        },
        {
          value: 'in_progress',
          text: this.$strings.LabelInProgress
        }
      ]
    },
    isSelectionMode() {
      return this.selectedEpisodes.length > 0
    },
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
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
      return this.episodesCopy
        .filter((ep) => {
          if (this.filterKey === 'all') return true
          const episodeProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id, ep.id)
          if (this.filterKey === 'incomplete') return !episodeProgress || !episodeProgress.isFinished
          if (this.filterKey === 'complete') return episodeProgress && episodeProgress.isFinished
          return episodeProgress && !episodeProgress.isFinished
        })
        .sort((a, b) => {
          if (this.sortDesc) {
            return String(b[this.sortKey]).localeCompare(String(a[this.sortKey]), undefined, { numeric: true, sensitivity: 'base' })
          }
          return String(a[this.sortKey]).localeCompare(String(b[this.sortKey]), undefined, { numeric: true, sensitivity: 'base' })
        })
    },
    selectedIsFinished() {
      // Find an item that is not finished, if none then all items finished
      return !this.selectedEpisodes.find((episode) => {
        var itemProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id, episode.id)
        return !itemProgress || !itemProgress.isFinished
      })
    }
  },
  methods: {
    contextMenuAction(action) {
      if (action === 'quick-match-episodes') {
        if (this.quickMatchingEpisodes) return

        this.quickMatchAllEpisodes()
      }
    },
    quickMatchAllEpisodes() {
      if (!this.mediaMetadata.feedUrl) {
        this.$toast.error(this.$strings.MessagePodcastHasNoRSSFeedForMatching)
        return
      }
      this.quickMatchingEpisodes = true

      const payload = {
        message: 'Quick matching episodes will overwrite details if a match is found. Only unmatched episodes will be updated. Are you sure?',
        callback: (confirmed) => {
          if (confirmed) {
            this.$axios
              .$post(`/api/podcasts/${this.libraryItem.id}/match-episodes?override=1`)
              .then((data) => {
                if (data.numEpisodesUpdated) {
                  this.$toast.success(`${data.numEpisodesUpdated} episodes updated`)
                } else {
                  this.$toast.info('No changes were made')
                }
              })
              .catch((error) => {
                console.error('Failed to request match episodes', error)
                this.$toast.error('Failed to match episodes')
              })
          }
          this.quickMatchingEpisodes = false
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    addToPlaylist(episode) {
      this.$store.commit('globals/setSelectedPlaylistItems', [{ libraryItem: this.libraryItem, episode }])
      this.$store.commit('globals/setShowPlaylistsModal', true)
    },
    addEpisodeToQueue(episode) {
      const queueItem = {
        libraryItemId: this.libraryItem.id,
        libraryId: this.libraryItem.libraryId,
        episodeId: episode.id,
        title: episode.title,
        subtitle: this.mediaMetadata.title,
        caption: episode.publishedAt ? `Published ${this.$formatDate(episode.publishedAt, 'MMM do, yyyy')}` : 'Unknown publish date',
        duration: episode.audioFile.duration || null,
        coverPath: this.media.coverPath || null
      }
      this.$store.commit('addItemToQueue', queueItem)
    },
    toggleBatchFinished() {
      this.processing = true
      var newIsFinished = !this.selectedIsFinished
      var updateProgressPayloads = this.selectedEpisodes.map((episode) => {
        return {
          libraryItemId: this.libraryItem.id,
          episodeId: episode.id,
          isFinished: newIsFinished
        }
      })

      this.$axios
        .patch(`/api/me/progress/batch/update`, updateProgressPayloads)
        .then(() => {
          this.$toast.success(this.$strings.ToastBatchUpdateSuccess)
          this.processing = false
          this.clearSelected()
        })
        .catch((error) => {
          this.$toast.error(this.$strings.ToastBatchUpdateFailed)
          console.error('Failed to batch update read/not read', error)
          this.processing = false
        })
    },
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

      const episodesInListeningOrder = this.episodesCopy.map((ep) => ({ ...ep })).sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt), undefined, { numeric: true, sensitivity: 'base' }))
      const episodeIndex = episodesInListeningOrder.findIndex((e) => e.id === episode.id)
      for (let i = episodeIndex; i < episodesInListeningOrder.length; i++) {
        const episode = episodesInListeningOrder[i]
        const podcastProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id, episode.id)
        if (!podcastProgress || !podcastProgress.isFinished) {
          queueItems.push({
            libraryItemId: this.libraryItem.id,
            libraryId: this.libraryItem.libraryId,
            episodeId: episode.id,
            title: episode.title,
            subtitle: this.mediaMetadata.title,
            caption: episode.publishedAt ? `Published ${this.$formatDate(episode.publishedAt, 'MMM do, yyyy')}` : 'Unknown publish date',
            duration: episode.audioFile.duration || null,
            coverPath: this.media.coverPath || null
          })
        }
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