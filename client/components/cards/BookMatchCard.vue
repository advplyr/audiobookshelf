<template>
  <div class="w-full border-b border-gray-700 pb-2">
    <div class="flex py-1 hover:bg-gray-300 hover:bg-opacity-10 cursor-pointer" @click="selectMatch">
      <div class="h-24 bg-primary" :style="{ minWidth: 96 / bookCoverAspectRatio + 'px' }">
        <img v-if="selectedCover" :src="selectedCover" class="h-full w-full object-contain" />
      </div>
      <div v-if="!isPodcast" class="px-4 flex-grow">
        <div class="flex items-center">
          <h1 class="text-base">{{ book.title }}</h1>
          <div class="flex-grow" />
          <p>{{ book.publishedYear }}</p>
        </div>
        <p class="text-gray-300 text-sm">{{ book.author }}</p>
        <div v-if="book.series && book.series.length" class="flex py-1 -mx-1">
          <div v-for="(series, index) in book.series" :key="index" class="bg-white bg-opacity-10 rounded-full px-1 py-0.5 mx-1">
            <p class="leading-3 text-xs text-gray-400">
              {{ series.series }}<span v-if="series.volumeNumber">&nbsp;#{{ series.volumeNumber }}</span>
            </p>
          </div>
        </div>
        <div class="w-full max-h-12 overflow-hidden">
          <p class="text-gray-500 text-xs">{{ book.description }}</p>
        </div>
      </div>
      <div v-else class="px-4 flex-grow">
        <h1>{{ book.title }}</h1>
        <p class="text-base text-gray-300 whitespace-nowrap truncate">by {{ book.author }}</p>
        <p class="text-xs text-gray-400 leading-5">{{ book.genres.join(', ') }}</p>
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
      this.$emit('select', this.book)
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