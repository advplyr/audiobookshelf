<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderLibraryStats + ': ' + currentLibraryName">
      <stats-preview-icons v-if="totalItems" :library-stats="libraryStats" />

      <div class="flex lg:flex-row flex-wrap justify-between flex-col mt-8">
        <div class="w-80 my-6 mx-auto">
          <h1 class="text-2xl mb-4 font-book">{{ $strings.HeaderStatsTop5Genres }}</h1>
          <p v-if="!top5Genres.length">{{ $strings.MessageNoGenres }}</p>
          <template v-for="genre in top5Genres">
            <div :key="genre.genre" class="w-full py-2">
              <div class="flex items-end mb-1">
                <p class="text-2xl font-bold">{{ Math.round((100 * genre.count) / totalItems) }}&nbsp;%</p>
                <div class="flex-grow" />
                <nuxt-link :to="`/library/${currentLibraryId}/bookshelf?filter=genres.${$encode(genre.genre)}`" class="text-base font-book text-white text-opacity-70 hover:underline">
                  {{ genre.genre }}
                </nuxt-link>
              </div>
              <div class="w-full rounded-full h-3 bg-primary bg-opacity-50 overflow-hidden">
                <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * genre.count) / totalItems) + '%' }" />
              </div>
            </div>
          </template>
        </div>
        <div class="w-80 my-6 mx-auto">
          <h1 class="text-2xl mb-4 font-book">{{ $strings.HeaderStatsTop10Authors }}</h1>
          <p v-if="!top10Authors.length">{{ $strings.MessageNoAuthors }}</p>
          <template v-for="(author, index) in top10Authors">
            <div :key="author.id" class="w-full py-2">
              <div class="flex items-center mb-1">
                <p class="text-sm font-book text-white text-opacity-70 w-36 pr-2 truncate">
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
          <h1 class="text-2xl mb-4 font-book">{{ $strings.HeaderStatsLongestItems }}</h1>
          <p v-if="!top10LongestItems.length">{{ $strings.MessageNoItems }}</p>
          <template v-for="(ab, index) in top10LongestItems">
            <div :key="index" class="w-full py-2">
              <div class="flex items-center mb-1">
                <p class="text-sm font-book text-white text-opacity-70 w-44 pr-2 truncate">
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
      </div>
    </app-settings-content>
  </div>
</template>

<script>
export default {
  asyncData({ redirect, store }) {
    if (!store.state.libraries.currentLibraryId) {
      return redirect('/config')
    }
    return {}
  },
  data() {
    return {
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
    totalItems() {
      return this.libraryStats ? this.libraryStats.totalItems : 0
    },
    genresWithCount() {
      return this.libraryStats ? this.libraryStats.genresWithCount : []
    },
    top5Genres() {
      return this.genresWithCount.slice(0, 5)
    },
    top10LongestItems() {
      return this.libraryStats ? this.libraryStats.longestItems || [] : []
    },
    longestItemDuration() {
      if (!this.top10LongestItems.length) return 0
      return this.top10LongestItems[0].duration
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
    },
    currentLibraryName() {
      return this.$store.getters['libraries/getCurrentLibraryName']
    }
  },
  methods: {
    async init() {
      this.libraryStats = await this.$axios.$get(`/api/libraries/${this.currentLibraryId}/stats`).catch((err) => {
        console.error('Failed to get library stats', err)
        var errorMsg = err.response ? err.response.data || 'Unknown Error' : 'Unknown Error'
        this.$toast.error(`Failed to get library stats: ${errorMsg}`)
      })
    }
  },
  mounted() {
    this.init()
  }
}
</script>