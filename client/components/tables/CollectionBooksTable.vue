<template>
  <div class="w-full bg-primary bg-opacity-40">
    <div class="w-full h-14 flex items-center px-4 bg-primary">
      <p>Collection List</p>
      <div class="w-6 h-6 bg-white bg-opacity-10 flex items-center justify-center rounded-full ml-2">
        <p class="font-mono text-sm">{{ books.length }}</p>
      </div>
      <div class="flex-grow" />
      <p v-if="totalDuration">{{ totalDurationPretty }}</p>
    </div>
    <template v-for="book in books">
      <tables-collection-book-table-row :key="book.id" :book="book" />
    </template>
  </div>
</template>

<script>
export default {
  props: {
    books: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {}
  },
  computed: {
    totalDuration() {
      var _total = 0
      this.books.forEach((book) => {
        _total += book.duration
      })
      return _total
    },
    totalDurationPretty() {
      return this.$elapsedPretty(this.totalDuration)
    }
  },
  methods: {},
  mounted() {}
}
</script>