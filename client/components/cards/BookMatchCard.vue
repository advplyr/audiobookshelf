<template>
  <div v-if="book" class="w-full border-b border-gray-700 pb-2">
    <div class="flex py-1 hover:bg-gray-300 hover:bg-opacity-10 cursor-pointer" @click="selectMatch">
      <div class="min-w-12 max-w-12 md:min-w-20 md:max-w-20">
        <div class="w-full bg-primary">
          <img v-if="selectedCover" :src="selectedCover" class="h-full w-full object-contain" />
          <div v-else class="w-12 h-12 md:w-20 md:h-20 bg-primary" />
        </div>
      </div>
      <div v-if="!isPodcast" class="px-2 md:px-4 flex-grow">
        <div class="flex items-center">
          <h1 class="text-sm md:text-base">{{ book.title }}</h1>
          <div class="flex-grow" />
          <p class="text-sm md:text-base">{{ book.publishedYear }}</p>
        </div>
        <p v-if="book.author" class="text-gray-300 text-xs md:text-sm">by {{ book.author }}</p>
        <p v-if="book.narrator" class="text-gray-400 text-xs">Narrated by {{ book.narrator }}</p>
        <p v-if="book.duration" class="text-gray-400 text-xs">Runtime: {{ $elapsedPrettyExtended(book.duration * 60) }}</p>
        <div v-if="book.series && book.series.length" class="flex py-1 -mx-1">
          <div v-for="(series, index) in book.series" :key="index" class="bg-white bg-opacity-10 rounded-full px-1 py-0.5 mx-1">
            <p class="leading-3 text-xs text-gray-400">
              {{ series.series }}<span v-if="series.sequence">&nbsp;#{{ series.sequence }}</span>
            </p>
          </div>
        </div>
        <div class="w-full max-h-12 overflow-hidden">
          <p class="text-gray-500 text-xs">{{ book.descriptionPlain || book.description }}</p>
        </div>
      </div>
      <div v-else class="px-4 flex-grow">
        <h1>
          <div class="flex items-center">
            {{ book.title }}<widgets-explicit-indicator :explicit="book.explicit" />
          </div>
        </h1>
        <p class="text-base text-gray-300 whitespace-nowrap truncate">by {{ book.author }}</p>
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
    bookCoverAspectRatio: Number
  },
  data() {
    return {
      selectedCover: null
    }
  },
  computed: {
    bookCovers() {
      return this.book.covers ? this.book.covers || [] : []
    }
  },
  methods: {
    selectMatch() {
      var book = { ...this.book }
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
