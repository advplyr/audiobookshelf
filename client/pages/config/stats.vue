<template>
  <div>
    <stats-preview-icons :listening-stats="listeningStats" :library-stats="libraryStats" />

    <div class="flex md:flex-row flex-wrap justify-between flex-col mt-12">
      <div class="w-80 my-6 mx-auto">
        <h1 class="text-2xl mb-4 font-book">Top 5 Genres</h1>
        <template v-for="genre in top5Genres">
          <div :key="genre.genre" class="w-full py-2">
            <div class="flex items-end mb-1">
              <p class="text-2xl font-bold">{{ Math.round((100 * genre.count) / totalBooks) }}&nbsp;%</p>
              <div class="flex-grow" />
              <p class="text-base font-book text-white text-opacity-70">{{ genre.genre }}</p>
            </div>
            <div class="w-full rounded-full h-3 bg-primary bg-opacity-50 overflow-hidden">
              <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * genre.count) / totalBooks) + '%' }" />
            </div>
          </div>
        </template>
      </div>
      <div class="w-80 my-6 mx-auto">
        <h1 class="text-2xl mb-4 font-book">Top 10 Authors</h1>
        <template v-for="(author, index) in top10Authors">
          <div :key="author.author" class="w-full py-2">
            <div class="flex items-center mb-1">
              <p class="text-sm font-book text-white text-opacity-70 w-36 pr-2 truncate">{{ index + 1 }}.&nbsp;&nbsp;&nbsp;&nbsp;{{ author.author }}</p>
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
      <stats-daily-listening-chart :listening-stats="listeningStats" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      listeningStats: null,
      libraryStats: null
    }
  },
  watch: {
    currentLibraryId(newVal, oldVal) {
      if (newVal) {
        this.init()
      }
    }
  },
  computed: {
    user() {
      return this.$store.state.user.user
    },
    totalBooks() {
      return this.libraryStats ? this.libraryStats.totalBooks : 0
    },
    genresWithCount() {
      return this.libraryStats ? this.libraryStats.genresWithCount : []
    },
    top5Genres() {
      return this.genresWithCount.slice(0, 5)
    },
    authorsWithCount() {
      return this.libraryStats ? this.libraryStats.authorsWithCount : []
    },
    mostUsedAuthorCount() {
      if (!this.authorsWithCount.length) return 0
      return this.authorsWithCount[0].count
    },
    top10Authors() {
      return this.authorsWithCount.slice(0, 10)
    },
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  },
  methods: {
    async init() {
      this.libraryStats = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/stats`).catch((err) => {
        console.error('Failed to get library stats', err)
        var errorMsg = err.response ? err.response.data || 'Unknown Error' : 'Unknown Error'
        this.$toast.error(`Failed to get library stats: ${errorMsg}`)
      })
      console.log('lib stats', this.libraryStats)
      this.listeningStats = await this.$axios.$get(`/api/me/listening-stats`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return []
      })
      console.log('Loaded user listening data', this.listeningStats)
    }
  },
  mounted() {
    this.init()
  }
}
</script>