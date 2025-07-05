<template>
  <modals-modal v-model="show" name="podcast-episodes-modal" :width="1200" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" id="podcast-wrapper" class="p-4 w-full text-sm py-2 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div v-if="episodesCleaned.length" class="w-full py-3 mx-auto flex">
        <form @submit.prevent="submit" class="flex grow">
          <ui-text-input v-model="search" @input="inputUpdate" type="search" :placeholder="$strings.PlaceholderSearchEpisode" class="grow mr-2 text-sm md:text-base" />
        </form>
        <ui-btn :padding-x="4" @click="toggleSort">
          <span class="pr-4">{{ $strings.LabelSortPubDate }}</span>
          <span class="text-yellow-400 absolute inset-y-0 right-0 flex items-center pr-2">
            <span class="material-symbols text-xl" :aria-label="sortDescending ? $strings.LabelSortDescending : $strings.LabelSortAscending">{{ sortDescending ? 'expand_more' : 'expand_less' }}</span>
          </span>
        </ui-btn>
      </div>
      <div ref="episodeContainer" id="episodes-scroll" class="w-full overflow-x-hidden overflow-y-auto">
        <div v-for="(episode, index) in episodesList" :key="index" class="relative" :class="episode.isDownloaded || episode.isDownloading ? 'bg-primary/40' : selectedEpisodes[episode.cleanUrl] ? 'cursor-pointer bg-success/10' : index % 2 == 0 ? 'cursor-pointer bg-primary/25 hover:bg-primary/40' : 'cursor-pointer bg-primary/5 hover:bg-primary/25'" @click="toggleSelectEpisode(episode)">
          <div class="absolute top-0 left-0 h-full flex items-center p-2">
            <span v-if="episode.isDownloaded" class="material-symbols text-success text-xl">download_done</span>
            <span v-else-if="episode.isDownloading" class="material-symbols text-warning text-xl">download</span>
            <ui-checkbox v-else v-model="selectedEpisodes[episode.cleanUrl]" small checkbox-bg="primary" border-color="gray-600" />
          </div>
          <div class="px-8 py-2">
            <div class="flex items-center font-semibold text-gray-200">
              <div v-if="episode.season || episode.episode">#</div>
              <div v-if="episode.season">{{ episode.season }}x</div>
              <div v-if="episode.episode">{{ episode.episode }}</div>
            </div>
            <div class="flex items-center mb-1">
              <div class="break-words">{{ episode.title }}</div>
              <widgets-podcast-type-indicator :type="episode.episodeType" />
            </div>
            <p v-if="episode.subtitle" class="mb-1 text-sm text-gray-300 line-clamp-2">{{ episode.subtitle }}</p>
            <div class="flex items-center space-x-2">
              <!-- published -->
              <p class="text-xs text-gray-300 w-40">Published {{ episode.publishedAt ? $dateDistanceFromNow(episode.publishedAt) : 'Unknown' }}</p>
              <!-- duration -->
              <p v-if="episode.durationSeconds && !isNaN(episode.durationSeconds)" class="text-xs text-gray-300 min-w-28">{{ $strings.LabelDuration }}: {{ $elapsedPretty(episode.durationSeconds) }}</p>
              <!-- size -->
              <p v-if="episode.enclosure?.length && !isNaN(episode.enclosure.length) && Number(episode.enclosure.length) > 0" class="text-xs text-gray-300">{{ $strings.LabelSize }}: {{ $bytesPretty(Number(episode.enclosure.length)) }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="flex justify-end pt-4">
        <ui-checkbox v-if="!allDownloaded" v-model="selectAll" @input="toggleSelectAll" :label="selectAllLabel" small checkbox-bg="primary" border-color="gray-600" class="mx-8" />
        <ui-btn v-if="!allDownloaded" :disabled="!episodesSelected.length" @click="submit">{{ buttonText }}</ui-btn>
        <p v-else class="text-success text-base px-2 py-4">{{ $strings.LabelAllEpisodesDownloaded }}</p>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  props: {
    value: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    },
    episodes: {
      type: Array,
      default: () => []
    },
    downloadQueue: {
      type: Array,
      default: () => []
    },
    episodesDownloading: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      processing: false,
      episodesCleaned: [],
      selectedEpisodes: {},
      selectAll: false,
      search: null,
      searchTimeout: null,
      searchText: null,
      downloadedEpisodeGuidMap: {},
      downloadedEpisodeUrlMap: {},
      sortDescending: true
    }
  },
  watch: {
    show: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
      }
    },
    episodes: {
      handler(newVal) {
        if (newVal) this.updateEpisodeDownloadStatuses()
      }
    },
    episodesDownloading: {
      handler(newVal) {
        if (newVal) this.updateEpisodeDownloadStatuses()
      }
    },
    downloadQueue: {
      handler(newVal) {
        if (newVal) this.updateEpisodeDownloadStatuses()
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    title() {
      if (!this.libraryItem) return ''
      return this.libraryItem.media.metadata.title || 'Unknown'
    },
    allDownloaded() {
      return !this.episodesCleaned.some((episode) => !this.getIsEpisodeDownloaded(episode))
    },
    episodesSelected() {
      return Object.keys(this.selectedEpisodes).filter((key) => !!this.selectedEpisodes[key])
    },
    buttonText() {
      if (!this.episodesSelected.length) return this.$strings.LabelNoEpisodesSelected
      if (this.episodesSelected.length === 1) return `${this.$strings.LabelDownload} ${this.$strings.LabelEpisode.toLowerCase()}`
      return this.$getString('LabelDownloadNEpisodes', [this.episodesSelected.length])
    },
    itemEpisodes() {
      return this.libraryItem?.media.episodes || []
    },
    episodesList() {
      return this.episodesCleaned.filter((episode) => {
        if (!this.searchText) return true
        return episode.title?.toLowerCase().includes(this.searchText) || episode.subtitle?.toLowerCase().includes(this.searchText)
      })
    },
    selectAllLabel() {
      if (this.episodesList.length === this.episodesCleaned.length) {
        return this.$strings.LabelSelectAllEpisodes
      }
      const episodesNotDownloaded = this.episodesList.filter((ep) => !this.getIsEpisodeDownloaded(ep)).length
      return this.$getString('LabelSelectEpisodesShowing', [episodesNotDownloaded])
    }
  },
  methods: {
    toggleSort() {
      this.sortDescending = !this.sortDescending
      this.episodesCleaned = this.episodesCleaned.toSorted((a, b) => {
        if (this.sortDescending) {
          return a.publishedAt < b.publishedAt ? 1 : -1
        }
        return a.publishedAt > b.publishedAt ? 1 : -1
      })
      this.selectedEpisodes = {}
      this.selectAll = false
    },
    getIsEpisodeDownloaded(episode) {
      if (episode.guid && !!this.downloadedEpisodeGuidMap[episode.guid]) {
        return true
      }
      if (this.downloadedEpisodeUrlMap[episode.cleanUrl]) {
        return true
      }
      return false
    },
    getIsEpisodeDownloadingOrQueued(episode) {
      const episodesToCheck = [...this.episodesDownloading, ...this.downloadQueue]
      if (episode.guid) {
        return episodesToCheck.some((download) => download.guid === episode.guid)
      }
      return episodesToCheck.some((download) => this.getCleanEpisodeUrl(download.url) === episode.cleanUrl)
    },
    /**
     * UPDATE: As of v2.4.5 guid is used for matching existing downloaded episodes if it is found on the RSS feed.
     * Fallback to checking the clean url
     * @see https://github.com/advplyr/audiobookshelf/issues/2207
     *
     * RSS feed episode url is used for matching with existing downloaded episodes.
     * Some RSS feeds include timestamps in the episode url (e.g. patreon) that can change on requests.
     * These need to be removed in order to detect the same episode each time the feed is pulled.
     *
     * An RSS feed may include an `id` in the query string. In these cases we want to leave the `id`.
     * @see https://github.com/advplyr/audiobookshelf/issues/1896
     *
     * @param {string} url - rss feed episode url
     * @returns {string} rss feed episode url without dynamic query strings
     */
    getCleanEpisodeUrl(url) {
      let queryString = url.split('?')[1]
      if (!queryString) return url

      const searchParams = new URLSearchParams(queryString)
      for (const p of Array.from(searchParams.keys())) {
        if (p !== 'id') searchParams.delete(p)
      }

      if (!searchParams.toString()) return url
      return `${url}?${searchParams.toString()}`
    },
    inputUpdate() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(() => {
        if (!this.search?.trim()) {
          this.searchText = ''
          this.checkSetIsSelectedAll()
          return
        }
        this.searchText = this.search.toLowerCase().trim()
        this.checkSetIsSelectedAll()
      }, 500)
    },
    toggleSelectAll(val) {
      for (const episode of this.episodesList) {
        if (episode.isDownloaded || episode.isDownloading) this.selectedEpisodes[episode.cleanUrl] = false
        else this.$set(this.selectedEpisodes, episode.cleanUrl, val)
      }
    },
    checkSetIsSelectedAll() {
      for (const episode of this.episodesList) {
        if (!episode.isDownloaded && !episode.isDownloading && !this.selectedEpisodes[episode.cleanUrl]) {
          this.selectAll = false
          return
        }
      }
      this.selectAll = true
    },
    toggleSelectEpisode(episode) {
      if (episode.isDownloaded || episode.isDownloading) return
      this.$set(this.selectedEpisodes, episode.cleanUrl, !this.selectedEpisodes[episode.cleanUrl])
      this.checkSetIsSelectedAll()
    },
    submit() {
      let episodesToDownload = []
      if (this.episodesSelected.length) {
        episodesToDownload = this.episodesSelected.map((cleanUrl) => this.episodesCleaned.find((ep) => ep.cleanUrl == cleanUrl))
      }

      const payloadSize = JSON.stringify(episodesToDownload).length
      const sizeInMb = payloadSize / 1024 / 1024
      const sizeInMbPretty = sizeInMb.toFixed(2) + 'MB'
      console.log('Request size', sizeInMb)
      if (sizeInMb > 9.99) {
        return this.$toast.error(`Request is too large (${sizeInMbPretty}) should be < 10Mb`)
      }

      this.processing = true
      this.$axios
        .$post(`/api/podcasts/${this.libraryItem.id}/download-episodes`, episodesToDownload)
        .then(() => {
          this.processing = false
          this.$toast.success('Started downloading episodes')
          this.show = false
        })
        .catch((error) => {
          console.error('Failed to download episodes', error)
          this.processing = false
          this.$toast.error(error.response?.data || 'Failed to download episodes')

          this.selectedEpisodes = {}
          this.selectAll = false
        })
    },
    init() {
      this.updateDownloadedEpisodeMaps()

      this.episodesCleaned = this.episodes
        .filter((ep) => ep.enclosure?.url)
        .map((_ep) => {
          return {
            ..._ep,
            cleanUrl: this.getCleanEpisodeUrl(_ep.enclosure.url),
            isDownloading: this.getIsEpisodeDownloadingOrQueued(_ep),
            isDownloaded: this.getIsEpisodeDownloaded(_ep)
          }
        })
      this.episodesCleaned.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      this.selectAll = false
      this.selectedEpisodes = {}
    },
    updateDownloadedEpisodeMaps() {
      this.downloadedEpisodeGuidMap = {}
      this.downloadedEpisodeUrlMap = {}

      this.itemEpisodes.forEach((episode) => {
        if (episode.guid) this.downloadedEpisodeGuidMap[episode.guid] = episode.id
        if (episode.enclosure?.url) this.downloadedEpisodeUrlMap[this.getCleanEpisodeUrl(episode.enclosure.url)] = episode.id
      })
    },
    updateEpisodeDownloadStatuses() {
      this.updateDownloadedEpisodeMaps()
      this.episodesCleaned = this.episodesCleaned.map((ep) => {
        return {
          ...ep,
          isDownloading: this.getIsEpisodeDownloadingOrQueued(ep),
          isDownloaded: this.getIsEpisodeDownloaded(ep)
        }
      })
    }
  },
  mounted() {}
}
</script>

<style scoped>
#podcast-wrapper {
  min-height: 400px;
  max-height: 80vh;
}
#episodes-scroll {
  max-height: calc(80vh - 200px);
}
</style>
