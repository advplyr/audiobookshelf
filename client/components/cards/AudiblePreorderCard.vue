<template>
  <div class="relative" :style="{ width: coverWidth + 'px' }">
    <div @mouseover="isHovering = true" @mouseleave="isHovering = false" class="cursor-default">
      <!-- Cover image -->
      <div class="relative rounded-sm overflow-hidden bg-primary" :style="{ width: coverWidth + 'px', height: coverHeight + 'px' }">
        <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="w-full h-full object-cover" loading="lazy" />
        <div v-else class="w-full h-full flex items-center justify-center bg-primary/50">
          <span class="material-symbols text-white/30" style="font-size: 3rem">headphones</span>
        </div>

        <!-- Release date badge -->
        <div v-if="book.releaseDate" class="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-center">
          <p class="text-yellow-400 font-semibold truncate" :style="{ fontSize: 0.6 + 'em' }">{{ formatReleaseDate(book.releaseDate) }}</p>
        </div>
      </div>

      <!-- Title & author below cover -->
      <div class="pt-1 px-0.5" :style="{ width: coverWidth + 'px' }">
        <p class="font-semibold truncate leading-tight" :style="{ fontSize: 0.75 + 'em' }">{{ book.title }}</p>
        <p v-if="authorLine" class="text-gray-300 truncate" :style="{ fontSize: 0.65 + 'em' }">{{ authorLine }}</p>
        <p v-if="seriesLine" class="text-gray-400 truncate" :style="{ fontSize: 0.6 + 'em' }">{{ seriesLine }}</p>
      </div>
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
    return { isHovering: false }
  },
  computed: {
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    coverHeight() {
      return 192 * this.sizeMultiplier
    },
    coverWidth() {
      return this.coverHeight / this.bookCoverAspectRatio
    },
    authorLine() {
      return (this.book.authors || []).join(', ') || null
    },
    seriesLine() {
      if (!this.book.seriesName) return null
      return this.book.seriesPosition ? `${this.book.seriesName} #${this.book.seriesPosition}` : this.book.seriesName
    }
  },
  methods: {
    formatReleaseDate(d) {
      if (!d) return ''
      const date = new Date(d.length === 10 ? d + 'T00:00:00' : d)
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
}
</script>
