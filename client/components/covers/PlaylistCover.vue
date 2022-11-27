<template>
  <div class="relative rounded-sm overflow-hidden" :style="{ width: width + 'px', height: height + 'px' }">
    <div v-if="hasOwnCover" class="w-full h-full relative rounded-sm">
      <div v-if="showCoverBg" class="bg-primary absolute top-0 left-0 w-full h-full">
        <div class="w-full h-full z-0" ref="coverBg" />
      </div>
      <img ref="cover" :src="fullCoverUrl" @error="imageError" @load="imageLoaded" class="w-full h-full absolute top-0 left-0" :class="showCoverBg ? 'object-contain' : 'object-cover'" />
    </div>
    <div v-else-if="items.length" class="flex flex-wrap justify-center h-full relative bg-primary bg-opacity-95 rounded-sm">
      <div class="absolute top-0 left-0 w-full h-full bg-gray-400 bg-opacity-5" />
      <covers-book-cover v-for="li in libraryItemCovers" :key="li.id" :library-item="li" :width="width / 2" :book-cover-aspect-ratio="1" />

      <!-- <covers-book-cover :library-item="items[0].libraryItem" :width="width / 2" :book-cover-aspect-ratio="bookCoverAspectRatio" />
      <covers-book-cover v-if="items.length > 1" :library-item="items[1].libraryItem" :width="width / 2" :book-cover-aspect-ratio="bookCoverAspectRatio" /> -->
    </div>
    <div v-else class="relative w-full h-full flex items-center justify-center p-2 bg-primary rounded-sm">
      <div class="absolute top-0 left-0 w-full h-full bg-gray-400 bg-opacity-5" />

      <p class="font-book text-white text-opacity-60 text-center" :style="{ fontSize: Math.min(1, sizeMultiplier) + 'rem' }">Empty Playlist</p>
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
    height: Number,
    bookCoverAspectRatio: Number
  },
  data() {
    return {
      imageFailed: false,
      showCoverBg: false
    }
  },
  computed: {
    sizeMultiplier() {
      if (this.bookCoverAspectRatio === 1) return this.width / (120 * 1.6 * 2)
      return this.width / 240
    },
    hasOwnCover() {
      return false
    },
    fullCoverUrl() {
      return null
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
  methods: {
    imageError() {},
    imageLoaded() {}
  },
  mounted() {}
}
</script>