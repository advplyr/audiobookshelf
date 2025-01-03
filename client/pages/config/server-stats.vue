<template>

  <div>
    <app-settings-content v-if="serverStats != null" :header-text="$strings.HeaderAllStats">
      <stats-preview-icons :library-stats="serverStats['combined']['all']" media-type="overview"/>
    </app-settings-content>

    <app-settings-content v-if="serverStats != null && bookLibraryListStats.length >= 1" :header-text="$strings.HeaderBookLibraries">
      <stats-preview-icons :library-stats="serverStats['combined']['books']" media-type="book"/>

      <table class="tracksTable max-w-3xl mx-auto mt-8">
        <tr>
          <th class="text-left">{{ $strings.LabelName }}</th>
          <th class="text-left">{{ $strings.LabelStatsItemsInLibrary }}</th>
          <th class="text-left">{{ $strings.LabelStatsOverallHours }}</th>
          <th class="text-left">{{ $strings.LabelStatsAuthors }}</th>
          <th class="text-left">{{ $strings.LabelSize }}</th>
          <th class="text-left">{{ $strings.LabelStatsAudioTracks }}</th>
        </tr>
        <tr v-for="library in bookLibraryListStats">
          <td>
            <p class="text-sm md:text-base text-gray-100">
              <a :href="'/library/' + library.id + '/stats'" class="hover:underline" @click.prevent="switchLibrary(library.id)">
                {{ library.name }}
              </a>
            </p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ library.stats.totalItems }}</p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ $formatNumber(totalHours(library.stats.totalDuration)) }}</p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ library.stats.totalAuthors }}</p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ $formatNumber(totalSizeNum(library.stats.totalSize)) }} {{totalSizeMod(library.stats.totalSize)}}</p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ library.stats.numAudioTracks }}</p>
          </td>
        </tr>
      </table>

    </app-settings-content>

    <app-settings-content v-if="serverStats != null && podcastLibraryListStats.length >= 1" :header-text="$strings.HeaderPodcastLibraries">
      <stats-preview-icons :library-stats="serverStats['combined']['podcasts']" media-type="podcast"/>

      <table class="tracksTable max-w-3xl mx-auto mt-8">
        <tr>
          <th class="text-left">{{ $strings.LabelName }}</th>
          <th class="text-left">{{ $strings.LabelStatsItemsInLibrary }}</th>
          <th class="text-left">{{ $strings.LabelEpisodes }}</th>
          <th class="text-left">{{ $strings.LabelStatsOverallHours }}</th>
          <th class="text-left">{{ $strings.LabelSize }}</th>
        </tr>
        <tr v-for="library in podcastLibraryListStats">
          <td>
            <p class="text-sm md:text-base text-gray-100">
              <a :href="'/library/' + library.id + '/stats'" class="hover:underline" @click.prevent="switchLibrary(library.id)">
                {{ library.name }}
              </a>
            </p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ library.stats.totalItems }}</p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ library.stats.numAudioTracks }}</p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ $formatNumber(totalHours(library.stats.totalDuration)) }}</p>
          </td>
          <td>
            <p class="text-sm md:text-base text-gray-100">{{ $formatNumber(totalSizeNum(library.stats.totalSize)) }} {{totalSizeMod(library.stats.totalSize)}}</p>
          </td>
        </tr>
      </table>

    </app-settings-content>
  </div>

</template>

<script>
export default {
  asyncData({ redirect, store }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
      return
    }

    return {}
  },
  data() {
    return {
      serverStats: null
    }
  },
  computed: {
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    user() {
      return this.$store.state.user.user
    },
    totalItems() {
      return this.serverStats?.totalItems || 0
    },
    bookLibraryIndex() {
      return this.serverStats?.libraries.findIndex((lib) => lib['type'] === 'book')
    },
    podcastLibraryIndex() {
      return this.serverStats?.libraries.findIndex((lib) => lib['type'] === 'podcast')
    },
    bookLibraryListStats() {
      if (this.bookLibraryIndex === -1) return []
      if (this.podcastLibraryIndex !== -1) {
        return this.serverStats['libraries'].slice(0, this.podcastLibraryIndex)
      }
      return this.serverStats['libraries']
    },
    podcastLibraryListStats() {
      if (this.podcastLibraryIndex === -1) return []
      return this.serverStats['libraries'].slice(this.podcastLibraryIndex)
    }
  },
  methods: {
    async init() {
      this.serverStats = (await this.$axios.$get(`/api/libraries/stats`).catch((err) => {
        console.error('Failed to get library stats', err)
        var errorMsg = err.response ? err.response.data || 'Unknown Error' : 'Unknown Error'
        this.$toast.error(`Failed to get library stats: ${errorMsg}`)
      }))

      // Sort the libraries by type
      this.serverStats['libraries'].sort((a, b) => {
        if (a['type'] < b['type']) return -1
        if (a['type'] > b['type']) return 1
        return 0
      })
    },
    totalHours(duration) {
      return Math.round(duration / (60 * 60))
    },
    totalSizePretty(size) {
      let totalSize = size || 0
      return this.$bytesPretty(totalSize, 1)
    },
    totalSizeNum(size) {
      return this.totalSizePretty(size).split(' ')[0]
    },
    totalSizeMod(size) {
      return this.totalSizePretty(size).split(' ')[1]
    },
    async switchLibrary(libraryId) {
      await this.$store.dispatch('libraries/fetch', libraryId);

      await this.$router.push(`/library/${libraryId}/stats`)
    }
  },
  mounted() {
    this.init()
  }
}
</script>
