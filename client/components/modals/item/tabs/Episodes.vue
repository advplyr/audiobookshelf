<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden px-4 py-6">
    <div class="w-full mb-4">
      <div class="flex items-center mb-4">
        <p v-if="autoDownloadEpisodes">Last new episode check {{ $formatDate(lastEpisodeCheck) }}</p>
        <div class="flex-grow" />
        <ui-btn :loading="checkingNewEpisodes" @click="checkForNewEpisodes">Check for new episodes</ui-btn>
      </div>

      <div class="w-full p-4 bg-primary">
        <p>Podcast Episodes</p>
      </div>
      <div v-if="!episodes.length" class="flex my-4 text-center justify-center text-xl">No Episodes</div>
      <table v-else class="text-sm tracksTable">
        <tr class="font-book">
          <th class="text-left w-16"><span class="px-4">#</span></th>
          <th class="text-left">Title</th>
          <th class="text-center w-28">Duration</th>
          <th class="text-center w-28">Size</th>
        </tr>
        <tr v-for="episode in episodes" :key="episode.id">
          <td class="text-left">
            <p class="px-4">{{ episode.index }}</p>
          </td>
          <td class="font-book">
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
      checkingNewEpisodes: false
    }
  },
  computed: {
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
    checkForNewEpisodes() {
      this.checkingNewEpisodes = true
      this.$axios
        .$get(`/api/podcasts/${this.libraryItemId}/checknew`)
        .then((response) => {
          if (response.episodes && response.episodes.length) {
            console.log('New episodes', response.episodes.length)
            this.$toast.success(`${response.episodes.length} new episodes found!`)
          } else {
            this.$toast.info('No new episodes found')
          }
          this.checkingNewEpisodes = false
        })
        .catch((error) => {
          console.error('Failed', error)
          var errorMsg = error.response && error.response.data ? error.response.data : 'Unknown Error'
          this.$toast.error(errorMsg)
          this.checkingNewEpisodes = false
        })
    }
  }
}
</script>