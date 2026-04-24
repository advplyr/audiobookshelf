<template>
  <div v-if="book" class="w-full border-b border-gray-700 pb-2">
    <div class="flex py-1 hover:bg-gray-300/10 cursor-pointer" @click="selectMatch">
      <div class="min-w-12 max-w-12 md:min-w-20 md:max-w-20">
        <div class="w-full bg-primary">
          <img v-if="selectedCover" :src="selectedCover" class="h-full w-full object-contain" />
          <div v-else class="w-12 h-12 md:w-20 md:h-20 bg-primary" />
        </div>
      </div>
      <div v-if="!isPodcast" class="px-2 md:px-4 grow">
        <div class="flex items-center">
          <h1 class="text-sm md:text-base">{{ book.title }}</h1>
          <div class="grow" />
          <p class="text-sm md:text-base">{{ book.publishedYear }}</p>
        </div>

        <div class="flex items-center">
          <div>
            <p v-if="book.author" class="text-gray-300 text-xs md:text-sm">{{ $getString('LabelByAuthor', [book.author]) }}</p>
            <p v-if="book.narrator" class="text-gray-400 text-xs">{{ $strings.LabelNarrators }}: {{ book.narrator }}</p>
            <div v-if="bookRatingValue > 0" class="flex items-center text-xs text-gray-400 mt-0.5">
              <span v-for="i in 5" :key="i" class="material-symbols text-xs mr-0.5" :class="bookRatingValue >= i - 0.5 ? 'text-warning fill' : 'text-gray-500'">{{ bookRatingValue >= i ? 'star' : bookRatingValue >= i - 0.5 ? 'star_half' : 'star_border' }}</span>
              <span class="ml-1">{{ bookRatingValue.toFixed(1) }}</span>
            </div>
            <p v-if="book.duration" class="text-gray-400 text-xs">{{ $strings.LabelDuration }}: {{ $elapsedPrettyExtended(bookDuration, false) }} {{ bookDurationComparison }}</p>
          </div>
          <div class="grow" />
          <div v-if="book.matchConfidence" class="rounded-full px-2 py-1 text-xs whitespace-nowrap text-white" :class="book.matchConfidence > 0.95 ? 'bg-success/80' : 'bg-info/80'">{{ $strings.LabelMatchConfidence }}: {{ (book.matchConfidence * 100).toFixed(0) }}%</div>
        </div>

        <div v-if="book.series?.length" class="flex py-1 -mx-1">
          <div v-for="(series, index) in book.series" :key="index" class="bg-white/10 rounded-full px-1 py-0.5 mx-1">
            <p class="leading-3 text-xs text-gray-400">
              {{ series.series }}<span v-if="series.sequence">&nbsp;#{{ series.sequence }}</span>
            </p>
          </div>
        </div>
        <div class="w-full max-h-12 overflow-hidden">
          <p class="text-gray-500 text-xs">{{ book.descriptionPlain }}</p>
        </div>
      </div>
      <div v-else class="px-4 grow">
        <h1>
          <div class="flex items-center">{{ book.title }}<widgets-explicit-indicator v-if="book.explicit" /></div>
        </h1>
        <p class="text-base text-gray-300 whitespace-nowrap truncate">{{ $getString('LabelByAuthor', [book.author]) }}</p>
        <p v-if="book.genres" class="text-xs text-gray-400 leading-5">{{ book.genres.join(', ') }}</p>
        <p class="text-xs text-gray-400 leading-5">{{ book.trackCount }} Episodes</p>
      </div>
    </div>
    <div v-if="bookCovers.length > 1" class="flex">
      <template v-for="cover in bookCovers">
        <div :key="cover" class="border-2 hover:border-yellow-300 border-transparent" :class="cover === selectedCover ? 'border-yellow-200' : ''" @mousedown.stop @mouseup.stop @click.stop="clickCover(cover)">
          <img :src="cover" class="h-20 w-12 object-cover mr-1" />
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    book: {
      type: Object,
      default: () => {}
    },
    isPodcast: Boolean,
    bookCoverAspectRatio: Number,
    currentBookDuration: Number
  },
  data() {
    return {
      selectedCover: null
    }
  },
  computed: {
    bookCovers() {
      return this.book.covers || []
    },
    serverSettings() {
      return this.$store.state.serverSettings
    },
    bookDuration() {
      return (this.book.duration || 0) * 60
    },
    bookDurationComparison() {
      if (!this.book.duration || !this.currentBookDuration) return ''
      const currentBookDurationMinutes = Math.floor(this.currentBookDuration / 60)
      let differenceInMinutes = currentBookDurationMinutes - this.book.duration
      if (differenceInMinutes < 0) {
        differenceInMinutes = Math.abs(differenceInMinutes)
        return this.$getString('LabelDurationComparisonLonger', [this.$elapsedPrettyExtended(differenceInMinutes * 60, false, false)])
      } else if (differenceInMinutes > 0) {
        return this.$getString('LabelDurationComparisonShorter', [this.$elapsedPrettyExtended(differenceInMinutes * 60, false, false)])
      }
      return this.$strings.LabelDurationComparisonExactMatch
    },
    bookRatingValue() {
      if (!this.book.rating) return 0
      if (typeof this.book.rating === 'string') {
        const num = Number(this.book.rating)
        return isNaN(num) ? 0 : num
      }
      if (typeof this.book.rating === 'object' && this.book.rating.average) {
        return Number(this.book.rating.average) || 0
      }
      const num = Number(this.book.rating)
      return isNaN(num) ? 0 : num
    },
  },
  methods: {
    selectMatch() {
      const book = { ...this.book }
      book.cover = this.selectedCover
      this.$emit('select', book)
    },
    clickCover(cover) {
      this.selectedCover = cover
    }
  },
  mounted() {
    this.selectedCover = this.bookCovers.length ? this.bookCovers[0] : this.book.cover || null
  }
}
</script>
