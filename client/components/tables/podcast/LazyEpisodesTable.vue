<template>
  <div id="lazy-episodes-table" class="w-full py-6">
    <div class="flex flex-wrap flex-col md:flex-row md:items-center mb-4">
      <div class="flex items-center flex-nowrap whitespace-nowrap mb-2 md:mb-0">
        <p class="text-lg mb-0 font-semibold">{{ $strings.HeaderEpisodes }}</p>
        <div class="inline-flex bg-white/5 px-1 mx-2 rounded-md text-sm text-gray-100">
          <p v-if="episodesList.length === episodes.length">{{ episodes.length }}</p>
          <p v-else>{{ episodesList.length }} / {{ episodes.length }}</p>
        </div>
      </div>
      <div class="flex-grow hidden md:block" />
      <div class="flex items-center">
        <template v-if="isSelectionMode">
          <ui-tooltip :text="selectedIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="bottom">
            <ui-read-icon-btn :disabled="processing" :is-read="selectedIsFinished" @click="toggleBatchFinished" class="mx-1.5" />
          </ui-tooltip>
          <ui-btn color="error" :disabled="processing" small class="h-9" @click="removeSelectedEpisodes">{{ $getString('MessageRemoveEpisodes', [selectedEpisodes.length]) }}</ui-btn>
          <ui-btn :disabled="processing" small class="ml-2 h-9" @click="clearSelected">{{ $strings.ButtonCancel }}</ui-btn>
        </template>
        <template v-else>
          <controls-filter-select v-model="filterKey" :items="filterItems" class="w-36 h-9 md:ml-4" @change="filterSortChanged" />
          <controls-sort-select v-model="sortKey" :descending.sync="sortDesc" :items="sortItems" class="w-44 md:w-48 h-9 ml-1 sm:ml-4" @change="filterSortChanged" />
          <div class="flex-grow md:hidden" />
          <ui-context-menu-dropdown v-if="contextMenuItems.length" :items="contextMenuItems" class="ml-1" @action="contextMenuAction" />
        </template>
      </div>
    </div>
    <div v-if="episodes.length" class="w-full py-3 mx-auto flex">
      <form @submit.prevent="submit" class="flex flex-grow">
        <ui-text-input v-model="search" @input="inputUpdate" type="search" :placeholder="$strings.PlaceholderSearchEpisode" class="flex-grow mr-2 text-sm md:text-base" />
      </form>
    </div>
    <div class="relative min-h-[176px]">
      <template v-for="episode in totalEpisodes">
        <div :key="episode" :id="`episode-${episode - 1}`" class="w-full h-44 px-2 py-3 overflow-hidden relative border-b border-white/10">
          <!-- episode is mounted here -->
        </div>
      </template>
      <div v-if="isSearching" class="w-full h-full absolute inset-0 flex justify-center py-12" :class="{ 'bg-black/50': totalEpisodes }">
        <ui-loading-indicator />
      </div>
      <div v-else-if="!totalEpisodes" class="h-44 flex items-center justify-center">
        <p class="text-lg">{{ $strings.MessageNoEpisodes }}</p>
      </div>
    </div>

    <modals-podcast-remove-episode v-model="showPodcastRemoveModal" @input="removeEpisodeModalToggled" :library-item="libraryItem" :episodes="episodesToRemove" @clearSelected="clearSelected" />
  </div>
</template>

<script>
import Vue from 'vue'
import LazyEpisodeRow from './LazyEpisodeRow.vue'

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
      search: null,
      searchTimeout: null,
      searchText: null,
      isSearching: false,
      totalEpisodes: 0,
      episodesPerPage: null,
      episodeIndexesMounted: [],
      episodeComponentRefs: {},
      windowHeight: 0,
      episodesTableOffsetTop: 0,
      episodeRowHeight: 176
    }
  },
  watch: {
    libraryItem: {
      handler() {
        this.refresh()
      }
    }
  },
  computed: {
    contextMenuItems() {
      const menuItems = []
      if (this.userIsAdminOrUp) {
        menuItems.push({
          text: this.$strings.MessageQuickMatchAllEpisodes,
          action: 'quick-match-episodes'
        })
      }
      menuItems.push({
        text: this.allEpisodesFinished ? this.$strings.MessageMarkAllEpisodesNotFinished : this.$strings.MessageMarkAllEpisodesFinished,
        action: 'batch-mark-as-finished'
      })
      return menuItems
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
          let aValue = a[this.sortKey]
          let bValue = b[this.sortKey]

          // Sort episodes with no pub date as the oldest
          if (this.sortKey === 'publishedAt') {
            if (!aValue) aValue = Number.MAX_VALUE
            if (!bValue) bValue = Number.MAX_VALUE
          }

          if (this.sortDesc) {
            return String(bValue).localeCompare(String(aValue), undefined, { numeric: true, sensitivity: 'base' })
          }
          return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' })
        })
    },
    episodesList() {
      return this.episodesSorted.filter((episode) => {
        if (!this.searchText) return true
        return episode.title?.toLowerCase().includes(this.searchText) || episode.subtitle?.toLowerCase().includes(this.searchText)
      })
    },
    selectedIsFinished() {
      // Find an item that is not finished, if none then all items finished
      return !this.selectedEpisodes.some((episode) => {
        const itemProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id, episode.id)
        return !itemProgress?.isFinished
      })
    },
    allEpisodesFinished() {
      return !this.episodesSorted.some((episode) => {
        const itemProgress = this.$store.getters['user/getUserMediaProgress'](this.libraryItem.id, episode.id)
        return !itemProgress?.isFinished
      })
    },
    dateFormat() {
      return this.$store.state.serverSettings.dateFormat
    },
    timeFormat() {
      return this.$store.state.serverSettings.timeFormat
    }
  },
  methods: {
    submit() {},
    inputUpdate() {
      clearTimeout(this.searchTimeout)
      this.isSearching = true
      let searchStart = this.searchText
      this.searchTimeout = setTimeout(() => {
        this.isSearching = false
        if (!this.search?.trim()) {
          this.searchText = ''
        } else {
          this.searchText = this.search.toLowerCase().trim()
        }
        if (searchStart !== this.searchText) {
          this.init()
        }
      }, 750)
    },
    contextMenuAction({ action }) {
      if (action === 'quick-match-episodes') {
        if (this.processing) return

        this.quickMatchAllEpisodes()
      } else if (action === 'batch-mark-as-finished') {
        if (this.processing) return

        this.markAllEpisodesFinished()
      }
    },
    markAllEpisodesFinished() {
      const newIsFinished = !this.allEpisodesFinished
      const payload = {
        message: newIsFinished ? this.$strings.MessageConfirmMarkAllEpisodesFinished : this.$strings.MessageConfirmMarkAllEpisodesNotFinished,
        callback: (confirmed) => {
          if (confirmed) {
            this.batchUpdateEpisodesFinished(this.episodesCopy, newIsFinished)
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    quickMatchAllEpisodes() {
      if (!this.mediaMetadata.feedUrl) {
        this.$toast.error(this.$strings.MessagePodcastHasNoRSSFeedForMatching)
        return
      }
      this.processing = true

      const payload = {
        message: this.$strings.MessageConfirmQuickMatchEpisodes,
        callback: (confirmed) => {
          if (confirmed) {
            this.$axios
              .$post(`/api/podcasts/${this.libraryItem.id}/match-episodes?override=1`)
              .then((data) => {
                if (data.numEpisodesUpdated) {
                  this.$toast.success(this.$getString('ToastEpisodeUpdateSuccess', [data.numEpisodesUpdated]))
                } else {
                  this.$toast.info(this.$strings.ToastNoUpdatesNecessary)
                }
              })
              .catch((error) => {
                console.error('Failed to request match episodes', error)
                this.$toast.error(this.$strings.ToastFailedToMatch)
              })
          }
          this.processing = false
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
        caption: episode.publishedAt ? this.$getString('LabelPublishedDate', [this.$formatDate(episode.publishedAt, this.dateFormat)]) : this.$strings.LabelUnknownPublishDate,
        duration: episode.audioFile.duration || null,
        coverPath: this.media.coverPath || null
      }
      this.$store.commit('addItemToQueue', queueItem)
    },
    toggleBatchFinished() {
      this.batchUpdateEpisodesFinished(this.selectedEpisodes, !this.selectedIsFinished)
    },
    batchUpdateEpisodesFinished(episodes, newIsFinished) {
      if (!episodes.length) return
      this.processing = true

      const updateProgressPayloads = episodes.map((episode) => {
        return {
          libraryItemId: this.libraryItem.id,
          episodeId: episode.id,
          isFinished: newIsFinished
        }
      })
      return this.$axios
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
      this.selectedEpisodes = []
      this.setSelectionModeForEpisodes()
    },
    removeSelectedEpisodes() {
      this.episodesToRemove = this.selectedEpisodes
      this.showPodcastRemoveModal = true
    },
    episodeSelected({ isSelected, episode }) {
      let isSelectionModeBefore = this.isSelectionMode
      if (isSelected) {
        this.selectedEpisodes.push(episode)
      } else {
        this.selectedEpisodes = this.selectedEpisodes.filter((ep) => ep.id !== episode.id)
      }
      if (this.isSelectionMode !== isSelectionModeBefore) {
        this.setSelectionModeForEpisodes()
      }
    },
    setSelectionModeForEpisodes() {
      for (const key in this.episodeComponentRefs) {
        if (this.episodeComponentRefs[key]?.setSelectionMode) {
          this.episodeComponentRefs[key].setSelectionMode(this.isSelectionMode)
        }
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
            caption: episode.publishedAt ? this.$getString('LabelPublishedDate', [this.$formatDate(episode.publishedAt, this.dateFormat)]) : this.$strings.LabelUnknownPublishDate,
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
      const episodeIds = this.episodesSorted.map((e) => e.id)
      this.$store.commit('setEpisodeTableEpisodeIds', episodeIds)
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowEditPodcastEpisodeModal', true)
    },
    viewEpisode(episode) {
      this.$store.commit('setSelectedLibraryItem', this.libraryItem)
      this.$store.commit('globals/setSelectedEpisode', episode)
      this.$store.commit('globals/setShowViewPodcastEpisodeModal', true)
    },
    destroyEpisodeComponents() {
      for (const key in this.episodeComponentRefs) {
        if (this.episodeComponentRefs[key]?.destroy) {
          this.episodeComponentRefs[key].destroy()
        }
      }
      this.episodeComponentRefs = {}
      this.episodeIndexesMounted = []
    },
    mountEpisode(index) {
      const episodeEl = document.getElementById(`episode-${index}`)
      if (!episodeEl) {
        console.warn('Episode row el not found at ' + index)
        return
      }

      this.episodeIndexesMounted.push(index)

      if (this.episodeComponentRefs[index]) {
        const episodeComponent = this.episodeComponentRefs[index]
        episodeEl.appendChild(episodeComponent.$el)
        if (this.isSelectionMode) {
          episodeComponent.setSelectionMode(true)
          if (this.selectedEpisodes.some((i) => i.id === episodeComponent.episodeId)) {
            episodeComponent.isSelected = true
          } else {
            episodeComponent.isSelected = false
          }
        } else {
          episodeComponent.setSelectionMode(false)
        }
      } else {
        const _this = this
        const ComponentClass = Vue.extend(LazyEpisodeRow)
        const instance = new ComponentClass({
          propsData: {
            index,
            libraryItemId: this.libraryItem.id,
            episode: this.episodesList[index]
          },
          created() {
            this.$on('selected', (payload) => {
              _this.episodeSelected(payload)
            })
            this.$on('view', (payload) => {
              _this.viewEpisode(payload)
            })
            this.$on('play', (payload) => {
              _this.playEpisode(payload)
            })
            this.$on('addToQueue', (payload) => {
              _this.addEpisodeToQueue(payload)
            })
            this.$on('remove', (payload) => {
              _this.removeEpisode(payload)
            })
            this.$on('edit', (payload) => {
              _this.editEpisode(payload)
            })
            this.$on('addToPlaylist', (payload) => {
              _this.addToPlaylist(payload)
            })
          }
        })
        this.episodeComponentRefs[index] = instance
        instance.$mount()
        episodeEl.appendChild(instance.$el)

        if (this.isSelectionMode) {
          instance.setSelectionMode(true)
          if (this.selectedEpisodes.some((i) => i.id === this.episodesList[index].id)) {
            instance.isSelected = true
          }
        }
      }
    },
    mountEpisodes(startIndex, endIndex) {
      for (let i = startIndex; i < endIndex; i++) {
        if (!this.episodeIndexesMounted.includes(i)) {
          this.mountEpisode(i)
        }
      }
    },
    scroll(evt) {
      if (!evt?.target?.scrollTop) return
      const scrollTop = Math.max(evt.target.scrollTop - this.episodesTableOffsetTop, 0)
      let firstEpisodeIndex = Math.floor(scrollTop / this.episodeRowHeight)
      let lastEpisodeIndex = Math.ceil((scrollTop + this.windowHeight) / this.episodeRowHeight)
      lastEpisodeIndex = Math.min(this.totalEpisodes - 1, lastEpisodeIndex)

      this.episodeIndexesMounted = this.episodeIndexesMounted.filter((_index) => {
        if (_index < firstEpisodeIndex || _index >= lastEpisodeIndex) {
          const el = document.getElementById(`lazy-episode-${_index}`)
          if (el) el.remove()
          return false
        }
        return true
      })
      this.mountEpisodes(firstEpisodeIndex, lastEpisodeIndex + 1)
    },
    initListeners() {
      const itemPageWrapper = document.getElementById('item-page-wrapper')
      if (itemPageWrapper) {
        itemPageWrapper.addEventListener('scroll', this.scroll)
      }
    },
    removeListeners() {
      const itemPageWrapper = document.getElementById('item-page-wrapper')
      if (itemPageWrapper) {
        itemPageWrapper.removeEventListener('scroll', this.scroll)
      }
    },
    filterSortChanged() {
      // Save filterKey and sortKey to local storage
      localStorage.setItem('podcastEpisodesFilter', this.filterKey)
      localStorage.setItem('podcastEpisodesSortBy', this.sortKey + (this.sortDesc ? '-desc' : ''))

      this.init()
    },
    refresh() {
      this.episodesCopy = this.episodes.map((ep) => ({ ...ep }))
      this.init()
    },
    init() {
      this.destroyEpisodeComponents()
      this.totalEpisodes = this.episodesList.length

      const lazyEpisodesTableEl = document.getElementById('lazy-episodes-table')
      this.episodesTableOffsetTop = (lazyEpisodesTableEl?.offsetTop || 0) + 64

      this.windowHeight = window.innerHeight
      this.episodesPerPage = Math.ceil(this.windowHeight / this.episodeRowHeight)

      this.$nextTick(() => {
        this.mountEpisodes(0, Math.min(this.episodesPerPage, this.totalEpisodes))
      })
    }
  },
  mounted() {
    this.filterKey = localStorage.getItem('podcastEpisodesFilter') || 'incomplete'
    const sortBy = localStorage.getItem('podcastEpisodesSortBy') || 'publishedAt-desc'
    this.sortKey = sortBy.split('-')[0]
    this.sortDesc = sortBy.split('-')[1] === 'desc'

    this.episodesCopy = this.episodes.map((ep) => ({ ...ep }))
    this.initListeners()
    this.init()
  },
  beforeDestroy() {
    this.removeListeners()
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
