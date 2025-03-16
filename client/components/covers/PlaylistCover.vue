<template>
  <div class="relative rounded-xs overflow-hidden" :style="{ width: width + 'px', height: height + 'px' }">
    <div v-if="items.length" class="flex flex-wrap justify-center h-full relative bg-primary/95 rounded-xs">
      <div class="absolute top-0 left-0 w-full h-full bg-gray-400/5" />
      <covers-book-cover v-for="(li, index) in libraryItemCovers" :key="index" :library-item="li" :width="itemCoverWidth" :book-cover-aspect-ratio="1" />
    </div>
    <div v-else class="relative w-full h-full flex items-center justify-center p-2 bg-primary rounded-xs">
      <div class="absolute top-0 left-0 w-full h-full bg-gray-400/5" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    items: {
      type: Array,
      default: () => []
    },
    width: Number,
    height: Number
  },
  data() {
    return {}
  },
  computed: {
    sizeMultiplier() {
      return this.width / (120 * 1.6 * 2)
    },
    itemCoverWidth() {
      if (this.libraryItemCovers.length === 1) return this.width
      return this.width / 2
    },
    libraryItemCovers() {
      if (!this.items.length) return []
      if (this.items.length === 1) return [this.items[0].libraryItem]

      const covers = []
      for (let i = 0; i < 4; i++) {
        let index = i % this.items.length
        if (this.items.length === 2 && i >= 2) index = (i + 1) % 2 // for playlists with 2 items show covers in checker pattern

        covers.push(this.items[index].libraryItem)
      }
      return covers
    }
  },
  methods: {},
  mounted() {}
}
</script>
