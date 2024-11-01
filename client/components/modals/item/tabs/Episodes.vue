<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div class="w-full mb-4">
      <div v-if="userIsAdminOrUp" class="flex items-end justify-end mb-4">
        <ui-text-input-with-label ref="lastCheckInput" v-model="lastEpisodeCheckInput" :disabled="checkingNewEpisodes" type="datetime-local" :label="$strings.LabelLookForNewEpisodesAfterDate" class="max-w-xs mr-2" />
        <ui-text-input-with-label ref="maxEpisodesInput" v-model="maxEpisodesToDownload" :disabled="checkingNewEpisodes" type="number" :label="$strings.LabelLimit" class="w-16 mr-2" input-class="h-10">
          <div class="flex -mb-0.5">
            <p class="px-1 text-sm font-semibold" :class="{ 'text-gray-400': checkingNewEpisodes }">{{ $strings.LabelLimit }}</p>
            <ui-tooltip direction="top" :text="$strings.LabelMaxEpisodesToDownload">
              <span class="material-symbols text-base">info</span>
            </ui-tooltip>
          </div>
        </ui-text-input-with-label>
        <ui-btn :loading="checkingNewEpisodes" @click="checkForNewEpisodes">{{ $strings.ButtonCheckAndDownloadNewEpisodes }}</ui-btn>
      </div>

      <div v-if="episodes.length" class="w-full p-4 bg-primary">
        <p>{{ $strings.HeaderEpisodes }}</p>
      </div>
      <div v-if="!episodes.length" class="flex my-4 text-center justify-center text-xl">{{ $strings.MessageNoEpisodes }}</div>
      <table v-else class="text-sm tracksTable">
        <tr>
          <th class="text-center w-20 min-w-20">{{ $strings.LabelEpisode }}</th>
          <th class="text-left">{{ $strings.LabelEpisodeTitle }}</th>
          <th class="text-center w-28">{{ $strings.LabelEpisodeDuration }}</th>
          <th class="text-center w-28">{{ $strings.LabelEpisodeSize }}</th>
        </tr>
        <tr v-for="episode in episodes" :key="episode.id">
          <td class="text-center w-20 min-w-20">
            <p>{{ episode.episode }}</p>
          </td>
          <td dir="auto">
            {{ episode.title }}
          </td>
          <td class="font-mono text-center">
            {{ $secondsToTimestamp(episode.duration) }}
          </td>
          <td class="font-mono text-center">
            {{ $bytesPretty(episode.size) }}
          </td>
        </tr>
      </table>
    </div>
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
      checkingNewEpisodes: false,
      lastEpisodeCheckInput: null,
      maxEpisodesToDownload: 3
    }
  },
  watch: {
    lastEpisodeCheck: {
      handler(newVal) {
        if (newVal) {
          this.setLastEpisodeCheckInput()
        }
      }
    }
  },
  computed: {
    userIsAdminOrUp() {
      return this.$store.getters['user/getIsAdminOrUp']
    },
    autoDownloadEpisodes() {
      return !!this.media.autoDownloadEpisodes
    },
    lastEpisodeCheck() {
      return this.media.lastEpisodeCheck
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    episodes() {
      return this.media.episodes || []
    }
  },
  methods: {
    async checkForNewEpisodes() {
      if (this.$refs.lastCheckInput) {
        this.$refs.lastCheckInput.blur()
      }
      if (this.$refs.maxEpisodesInput) {
        this.$refs.maxEpisodesInput.blur()
      }

      if (this.maxEpisodesToDownload < 0) {
        this.maxEpisodesToDownload = 3
        this.$toast.error(this.$strings.ToastInvalidMaxEpisodesToDownload)
        return
      }

      this.checkingNewEpisodes = true
      const lastEpisodeCheck = new Date(this.lastEpisodeCheckInput).valueOf()

      // If last episode check changed then update it first
      if (lastEpisodeCheck && lastEpisodeCheck !== this.lastEpisodeCheck) {
        var updateResult = await this.$axios.$patch(`/api/items/${this.libraryItemId}/media`, { lastEpisodeCheck }).catch((error) => {
          console.error('Failed to update', error)
          return false
        })
        console.log('updateResult', updateResult)
      }

      this.$axios
        .$get(`/api/podcasts/${this.libraryItemId}/checknew?limit=${this.maxEpisodesToDownload}`)
        .then((response) => {
          if (response.episodes && response.episodes.length) {
            console.log('New episodes', response.episodes.length)
            this.$toast.success(this.$getString('ToastNewEpisodesFound', [response.episodes.length]))
          } else {
            this.$toast.info(this.$strings.ToastNoNewEpisodesFound)
          }
          this.checkingNewEpisodes = false
        })
        .catch((error) => {
          console.error('Failed', error)
          var errorMsg = error.response && error.response.data ? error.response.data : 'Unknown Error'
          this.$toast.error(errorMsg)
          this.checkingNewEpisodes = false
        })
    },
    setLastEpisodeCheckInput() {
      this.lastEpisodeCheckInput = this.lastEpisodeCheck ? this.$formatDate(this.lastEpisodeCheck, "yyyy-MM-dd'T'HH:mm") : null
    }
  },
  mounted() {
    this.setLastEpisodeCheckInput()
  }
}
</script>
