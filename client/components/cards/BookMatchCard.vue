<template>
  <div class="w-full border-b border-gray-700 pb-2">
    <div class="flex py-1 hover:bg-gray-300 hover:bg-opacity-10 cursor-pointer" @click="selectMatch">
      <img :src="selectedCover || '/book_placeholder.jpg'" class="h-24 object-cover" :style="{ width: 96 / bookCoverAspectRatio + 'px' }" />
      <div class="px-4 flex-grow">
        <div class="flex items-center">
          <h1>{{ book.title }}</h1>
          <div class="flex-grow" />
          <p>{{ book.publishedYear }}</p>
        </div>
        <p class="text-gray-400">{{ book.author }}</p>
        <div class="w-full max-h-12 overflow-hidden">
          <p class="text-gray-500 text-xs">{{ book.description }}</p>
        </div>
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