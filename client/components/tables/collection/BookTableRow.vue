<template>
  <div class="w-full px-6 py-2" @mouseover="mouseover" @mouseleave="mouseleave" :class="isHovering ? 'bg-white bg-opacity-5' : ''">
    <div v-if="book" class="flex h-20">
      <covers-book-cover :audiobook="book" :width="50" />
      <div class="w-80 h-full px-2 flex items-center">
        <div>
          <p class="truncate">{{ bookTitle }}</p>
          <p class="truncate text-gray-400 text-sm">{{ bookAuthor }}</p>
        </div>
      </div>
      <div class="flex-grow flex items-center">
        <p>{{ bookDuration }}</p>
      </div>
      <!-- <div class="w-12 flex items-center justify-center">
        <span class="material-icons text-lg text-white text-opacity-70 hover:text-opacity-100 cursor-pointer">radio_button_unchecked</span>
      </div> -->
    </div>
  </div>
</template>

<script>
export default {
  props: {
    book: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      isHovering: false
    }
  },
  computed: {
    _book() {
      return this.book.book || {}
    },
    bookTitle() {
      return this._book.title || ''
    },
    bookAuthor() {
      return this._book.authorFL || ''
    },
    bookDuration() {
      return this.$secondsToTimestamp(this.book.duration)
    }
  },
  methods: {
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    }
  },
  mounted() {}
}
</script>