<template>
  <div>
    <!-- <h1>Stats</h1> -->
    <div class="flex mt-6">
      <div class="flex mr-1 md:mr-6">
        <svg class="h-14 w-14 md:h-18 md:w-18" viewBox="0 0 24 24">
          <path fill="currentColor" d="M9 3V18H12V3H9M12 5L16 18L19 17L15 4L12 5M5 5V18H8V5H5M3 19V21H21V19H3Z" />
        </svg>
        <div class="px-2">
          <p class="text-4xl md:text-5xl font-bold">{{ audiobooks.length }}</p>
          <p class="font-book text-xs md:text-sm text-white text-opacity-80">Books in Library</p>
        </div>
      </div>
      <div class="flex mx-1 md:mx-6">
        <svg class="h-14 w-14 md:h-18 md:w-18" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M19 1L14 6V17L19 12.5V1M21 5V18.5C19.9 18.15 18.7 18 17.5 18C15.8 18 13.35 18.65 12 19.5V6C10.55 4.9 8.45 4.5 6.5 4.5C4.55 4.5 2.45 4.9 1 6V20.65C1 20.9 1.25 21.15 1.5 21.15C1.6 21.15 1.65 21.1 1.75 21.1C3.1 20.45 5.05 20 6.5 20C8.45 20 10.55 20.4 12 21.5C13.35 20.65 15.8 20 17.5 20C19.15 20 20.85 20.3 22.25 21.05C22.35 21.1 22.4 21.1 22.5 21.1C22.75 21.1 23 20.85 23 20.6V6C22.4 5.55 21.75 5.25 21 5M10 18.41C8.75 18.09 7.5 18 6.5 18C5.44 18 4.18 18.19 3 18.5V7.13C3.91 6.73 5.14 6.5 6.5 6.5C7.86 6.5 9.09 6.73 10 7.13V18.41Z"
          />
        </svg>
        <div class="px-3">
          <p class="text-4xl md:text-5xl font-bold">{{ userAudiobooksRead.length }}</p>
          <p class="font-book text-xs md:text-sm text-white text-opacity-80">Books Read</p>
        </div>
      </div>
      <div class="flex ml-1 md:ml-6">
        <svg class="h-14 w-14 md:h-18 md:w-18" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17V18.1H18.1V17C18.1,16.36 14.97,14.9 12,14.9Z" />
        </svg>
        <div class="px-1">
          <p class="text-4xl md:text-5xl font-bold">{{ uniqueAuthors.length }}</p>
          <p class="font-book text-xs md:text-sm text-white text-opacity-80">Authors</p>
        </div>
      </div>
    </div>

    <div class="flex md:flex-row flex-col mt-12">
      <div class="w-80 mb-12 md:mb-0 mx-auto md:ml-0 md:mr-12">
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
      <div class="w-80 mx-auto md:mx-12">
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
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },
  computed: {
    audiobooks() {
      return this.$store.state.audiobooks.audiobooks
    },
    uniqueAuthors() {
      return this.$store.getters['audiobooks/getUniqueAuthors']
    },
    userAudiobooks() {
      return Object.values(this.$store.state.user.user.audiobooks || {})
    },
    userAudiobooksRead() {
      return this.userAudiobooks.filter((ab) => !!ab.isRead)
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
  methods: {},
  mounted() {
    this.$store.dispatch('audiobooks/load')
  }
}
</script>