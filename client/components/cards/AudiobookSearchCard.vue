<template>
  <div class="flex h-full px-1 overflow-hidden">
    <cards-book-cover :audiobook="audiobook" :width="50" />
    <div class="flex-grow px-2 searchCardContent h-full">
      <p class="truncate text-sm">{{ title }}</p>
      <p class="text-xs text-gray-200 truncate">by {{ author }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    audiobook: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {}
  },
  computed: {
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    },
    title() {
      return this.book ? this.book.title : 'No Title'
    },
    author() {
      return this.book ? this.book.author : 'Unknown'
    }
  },
  methods: {},
  mounted() {}
}
</script>

<style>
.searchCardContent {
  width: calc(100% - 80px);
  height: calc(50px * 1.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>