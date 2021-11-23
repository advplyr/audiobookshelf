<template>
  <div>
    <stats-preview-icons :listening-stats="listeningStats" />

    <div class="flex md:flex-row flex-wrap justify-between flex-col mt-12">
      <div class="w-80 my-6 mx-auto">
        <h1 class="text-2xl mb-4 font-book">Top 5 Genres</h1>
        <template v-for="genre in top5Genres">
          <div :key="genre.genre" class="w-full py-2">
            <div class="flex items-end mb-1">
              <p class="text-2xl font-bold">{{ Math.round((100 * genre.count) / audiobooks.length) }}&nbsp;%</p>
              <div class="flex-grow" />
              <p class="text-base font-book text-white text-opacity-70">{{ genre.genre }}</p>
            </div>
            <div class="w-full rounded-full h-3 bg-primary bg-opacity-50 overflow-hidden">
              <div class="bg-yellow-400 h-full rounded-full" :style="{ width: Math.round((100 * genre.count) / audiobooks.length) + '%' }" />
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
      listeningStats: null
    }
  },
  computed: {
    audiobooks() {
      return this.$store.state.audiobooks.audiobooks
    },
    user() {
      return this.$store.state.user.user
    },
    genresWithCount() {
      var genresMap = {}
      this.audiobooks.forEach((ab) => {
        var genres = ab.book.genres || []
        genres.forEach((genre) => {
          if (genresMap[genre]) genresMap[genre].count++
          else
            genresMap[genre] = {
              genre,
              count: 1
            }
        })
      })
      var genres = Object.values(genresMap).sort((a, b) => b.count - a.count)
      return genres
    },
    top5Genres() {
      return this.genresWithCount.slice(0, 5)
    },
    authorsWithCount() {
      var authorsMap = {}
      this.audiobooks.forEach((ab) => {
        var authors = ab.book.authorFL ? ab.book.authorFL.split(', ') : []
        authors.forEach((author) => {
          if (authorsMap[author]) authorsMap[author].count++
          else
            authorsMap[author] = {
              author,
              count: 1
            }
        })
      })
      return Object.values(authorsMap).sort((a, b) => b.count - a.count)
    },
    mostUsedAuthorCount() {
      if (!this.authorsWithCount.length) return 0
      return this.authorsWithCount[0].count
    },
    top10Authors() {
      return this.authorsWithCount.slice(0, 10)
    }
  },
  methods: {
    async init() {
      this.listeningStats = await this.$axios.$get(`/api/me/listening-stats`).catch((err) => {
        console.error('Failed to load listening sesions', err)
        return []
      })
      console.log('Loaded user listening data', this.listeningStats)
    }
  },
  mounted() {
    this.init()
    this.$store.dispatch('audiobooks/load')
  }
}
</script>