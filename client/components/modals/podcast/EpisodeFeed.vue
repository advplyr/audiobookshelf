<template>
  <modals-modal v-model="show" name="podcast-episodes-modal" :width="1200" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="font-book text-3xl text-white truncate">{{ title }}</p>
      </div>
    </template>
    <div ref="wrapper" id="podcast-wrapper" class="p-4 w-full text-sm py-2 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-hidden">
      <div ref="episodeContainer" id="episodes-scroll" class="w-full overflow-x-hidden overflow-y-auto">
        <div
          v-for="(episode, index) in episodes"
          :key="index"
          class="relative"
          :class="episode.enclosure && itemEpisodeMap[episode.enclosure.url] ? 'bg-primary bg-opacity-40' : selectedEpisodes[String(index)] ? 'cursor-pointer bg-success bg-opacity-10' : index % 2 == 0 ? 'cursor-pointer bg-primary bg-opacity-25 hover:bg-opacity-40' : 'cursor-pointer bg-primary bg-opacity-5 hover:bg-opacity-25'"
          @click="toggleSelectEpisode(index)"
        >
          <div class="absolute top-0 left-0 h-full flex items-center p-2">
            <span v-if="episode.enclosure && itemEpisodeMap[episode.enclosure.url]" class="material-icons text-success text-xl">download_done</span>
            <ui-checkbox v-else v-model="selectedEpisodes[String(index)]" small checkbox-bg="primary" border-color="gray-600" />
          </div>
          <div class="px-8 py-2">
            <p v-if="episode.episode" class="font-semibold text-gray-200">#{{ episode.episode }}</p>
            <p class="break-words mb-1">{{ episode.title }}</p>
            <p v-if="episode.subtitle" class="break-words mb-1 text-sm text-gray-300 episode-subtitle">{{ episode.subtitle }}</p>
            <p class="text-xs text-gray-300">Published {{ episode.publishedAt ? $dateDistanceFromNow(episode.publishedAt) : 'Unknown' }}</p>
            <!-- <span class="material-icons cursor-pointer text-lg hover:text-success" @click="saveEpisode(episode)">save</span> -->
          </div>
        </div>
      </div>
      <div class="flex justify-end pt-4">
        <div class="relative">
          <div class="absolute top-0 left-0 h-full flex items-center p-2">
            <ui-checkbox v-model="selectAll" small checkbox-bg="primary" border-color="gray-600" :disabled="allDownloaded" />
          </div>
          <div class="px-8 py-2">
            <p :class="!allDownloaded ? 'font-semibold text-gray-200' : 'text-gray-400'">Select all episodes</p>
          </div>
        </div>
        <ui-btn :disabled="!episodesSelected.length" @click="submit">{{ buttonText }}</ui-btn>
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
    }
  },
  data() {
    return {
      processing: false,
      selectedEpisodes: {}
    }
  },
  watch: {
    show: {
      immediate: true,
      handler(newVal) {
        if (newVal) this.init()
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
    selectAll: {
      get() {
        return this.episodesSelected.length == this.episodes.filter((_, index) => !(this.episodes[index].enclosure && this.itemEpisodeMap[this.episodes[index].enclosure.url])).length
      },
      set(val) {
        for (const key in this.selectedEpisodes) {
          this.selectedEpisodes[key] = val
        }
      }
    },
    title() {
      if (!this.libraryItem) return ''
      return this.libraryItem.media.metadata.title || 'Unknown'
    },
    allDownloaded() {
      return Object.values(this.episodes).filter((episode) => !(episode.enclosure && this.itemEpisodeMap[episode.enclosure.url])).length === 0
    },
    episodesSelected() {
      return Object.keys(this.selectedEpisodes).filter((key) => !!this.selectedEpisodes[key])
    },
    buttonText() {
      if (!this.episodesSelected.length) return 'No Episodes Selected'
      return `Download ${this.episodesSelected.length} Episode${this.episodesSelected.length > 1 ? 's' : ''}`
    },
    itemEpisodes() {
      if (!this.libraryItem) return []
      return this.libraryItem.media.episodes || []
    },
    itemEpisodeMap() {
      var map = {}
      this.itemEpisodes.forEach((item) => {
        if (item.enclosure) map[item.enclosure.url] = true
      })
      return map
    }
  },
  methods: {
    toggleSelectEpisode(index) {
      this.$set(this.selectedEpisodes, String(index), !this.selectedEpisodes[String(index)])
    },
    submit() {
      var episodesToDownload = []
      if (this.episodesSelected.length) {
        episodesToDownload = this.episodesSelected.map((episodeIndex) => this.episodes[Number(episodeIndex)])
      }

      var payloadSize = JSON.stringify(episodesToDownload).length
      var sizeInMb = payloadSize / 1024 / 1024
      var sizeInMbPretty = sizeInMb.toFixed(2) + 'MB'
      console.log('Request size', sizeInMb)
      if (sizeInMb > 4.99) {
        return this.$toast.error(`Request is too large (${sizeInMbPretty}) should be < 5Mb`)
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
          var errorMsg = error.response && error.response.data ? error.response.data : 'Failed to download episodes'
          console.error('Failed to download episodes', error)
          this.processing = false
          this.$toast.error(errorMsg)
        })
    },
    init() {
      this.episodes.sort((a, b) => (a.publishedAt < b.publishedAt) ? 1 : -1)
      for (let i = 0; i < this.episodes.length; i++) {
        var episode = this.episodes[i]
        if (episode.enclosure && !this.itemEpisodeMap[episode.enclosure.url]) {
          // Do not include episodes already downloaded
          this.$set(this.selectedEpisodes, String(i), false)
        }
      }
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