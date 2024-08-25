<template>
  <app-settings-content :header-text="$strings.HeaderAllLibrariesStats" class="!mb-4">
      <div class="w-full max-w-4xl mx-auto">
        <stats-preview-icons v-if="totalItems" :library-stats="combinedLibraryStats" />

        <div class="flex lg:flex-row flex-wrap justify-between flex-col mt-8">
          <div class="w-80 my-6 mx-auto">
            <h1 class="text-2xl mb-4">{{ $strings.HeaderStatsTop5Genres }}</h1>
            <p v-if="!top5Genres.length">{{ $strings.MessageNoGenres }}</p>
            <template v-for="genre in top5Genres">
              <div :key="genre.genre" class="w-full py-2">
                <div class="flex items-end mb-1">
                  <p class="text-2xl font-bold">{{ Math.round((100 * genre.count) / totalItems) }}&nbsp;%</p>
                  <div class="flex-grow" />
                  <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=genres.${$encode(genre.genre)}`" class="text-base text-white text-opacity-70 hover:underline">
                    {{ genre.genre }}
                  </nuxt-link>
                </div>
                <div class="w-full rounded-full h-3 bg-primary bg-opacity-50 overflow-hidden">
                  <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * genre.count) / totalItems) + '%' }" />
                </div>
              </div>
            </template>
          </div>
          <div v-if="top10Authors.length" class="w-80 my-6 mx-auto">
            <h1 class="text-2xl mb-4">{{ $strings.HeaderStatsTop10Authors }}</h1>
            <p v-if="!top10Authors.length">{{ $strings.MessageNoAuthors }}</p>
            <template v-for="(author, index) in top10Authors">
              <div :key="author.id" class="w-full py-2">
                <div class="flex items-center mb-1">
                  <p class="text-sm text-white text-opacity-70 w-36 pr-2 truncate">
                    {{ index + 1 }}.&nbsp;&nbsp;&nbsp;&nbsp;<nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=authors.${$encode(author.id)}`" class="hover:underline">{{ author.name }}</nuxt-link>
                  </p>
                  <div class="flex-grow rounded-full h-2.5 bg-primary bg-opacity-0 overflow-hidden">
                    <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * author.count) / mostUsedAuthorCount) + '%' }" />
                  </div>
                  <div class="w-4 ml-3">
                    <p class="text-sm font-bold">{{ author.count }}</p>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="w-80 my-6 mx-auto">
            <h1 class="text-2xl mb-4">{{ $strings.HeaderStatsLongestItems }}</h1>
            <p v-if="!top10LongestItems.length">{{ $strings.MessageNoItems }}</p>
            <template v-for="(ab, index) in top10LongestItems">
              <div :key="index" class="w-full py-2">
                <div class="flex items-center mb-1">
                  <p class="text-sm text-white text-opacity-70 w-44 pr-2 truncate">
                    {{ index + 1 }}.&nbsp;&nbsp;&nbsp;&nbsp;<nuxt-link :to="`/item/${ab.id}`" class="hover:underline">{{ ab.title }}</nuxt-link>
                  </p>
                  <div class="flex-grow rounded-full h-2.5 bg-primary bg-opacity-0 overflow-hidden">
                    <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * ab.duration) / longestItemDuration) + '%' }" />
                  </div>
                  <div class="w-4 ml-3">
                    <p class="text-sm font-bold">{{ (ab.duration / 3600).toFixed(1) }}</p>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <div class="w-80 my-6 mx-auto">
            <h1 class="text-2xl mb-4">{{ $strings.HeaderStatsLargestItems }}</h1>
            <p v-if="!top10LargestItems.length">{{ $strings.MessageNoItems }}</p>
            <template v-for="(ab, index) in top10LargestItems">
              <div :key="index" class="w-full py-2">
                <div class="flex items-center mb-1">
                  <p class="text-sm text-white text-opacity-70 w-44 pr-2 truncate">
                    {{ index + 1 }}.&nbsp;&nbsp;&nbsp;&nbsp;<nuxt-link :to="`/item/${ab.id}`" class="hover:underline">{{ ab.title }}</nuxt-link>
                  </p>
                  <div class="flex-grow rounded-full h-2.5 bg-primary bg-opacity-0 overflow-hidden">
                    <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * ab.size) / largestItemSize) + '%' }" />
                  </div>
                  <div class="w-4 ml-3">
                    <p class="text-sm font-bold whitespace-nowrap">{{ $bytesPretty(ab.size) }}</p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </app-settings-content>
</template>

<script>
export default {
  asyncData({ redirect, store }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
      return
    }

    if (!store.state.libraries.currentLibraryId) {
      return redirect('/config')
    }
    return {}
  },
  data() {
    return {
      libraryStats: []
    }
  },
  computed: {
    combinedLibraryStats() {
      return this.libraryStats.reduce(
        (combined, stats) => {
          combined.totalItems += stats.totalItems || 0
          combined.totalDuration += stats.totalDuration || 0
          combined.totalAuthors += stats.totalAuthors || 0
          combined.totalSize += stats.totalSize || 0
          combined.numAudioTracks += stats.numAudioTracks || 0
          combined.genresWithCount = [...combined.genresWithCount, ...(stats.genresWithCount || [])].sort((a, b) => b.count - a.count).slice(0, 10)
          combined.longestItems = [...combined.longestItems, ...(stats.longestItems || [])].sort((a, b) => b.duration - a.duration).slice(0, 10)
          combined.largestItems = [...combined.largestItems, ...(stats.largestItems || [])].sort((a, b) => b.size - a.size).slice(0, 10)
          combined.authorsWithCount = [...combined.authorsWithCount, ...(stats.authorsWithCount || [])].sort((a, b) => b.count - a.count).slice(0, 10)
          return combined
        },
        {
          totalItems: 0,
          totalDuration: 0,
          totalAuthors: 0,
          totalSize: 0,
          numAudioTracks: 0,
          genresWithCount: [],
          longestItems: [],
          largestItems: [],
          authorsWithCount: []
        }
      )
    },
    totalItems() {
      return this.combinedLibraryStats.totalItems || 0
    },
    top5Genres() {
      return this.combinedLibraryStats.genresWithCount?.slice(0, 5) || []
    },
    top10LongestItems() {
      return this.combinedLibraryStats.longestItems || []
    },
    longestItemDuration() {
      if (!this.top10LongestItems.length) return 0
      return this.top10LongestItems[0].duration
    },
    top10LargestItems() {
      return this.combinedLibraryStats.largestItems || []
    },
    largestItemSize() {
      if (!this.top10LargestItems.length) return 0
      return this.top10LargestItems[0].size
    },
    top10Authors() {
      return this.combinedLibraryStats.authorsWithCount?.slice(0, 10) || []
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    },
    mostUsedAuthorCount() {
      if (!this.combinedLibraryStats.authorsWithCount.length) return 0
      return this.combinedLibraryStats.authorsWithCount[0].count
    },
  },
  methods: {
    async init() {
      this.libraryStatsInformation = await this.$axios.$get(`/api/libraries/stats`).catch((err) => {
        console.error('Failed to get library stats', err)
      })
      this.libraryStats = this.libraryStatsInformation.map(entry => {
        return { ...entry.stats };
      });
    }
  },
  mounted() {
    this.init()
  }
}
</script>
