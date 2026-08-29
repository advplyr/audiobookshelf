<template>
  <nuxt-link :to="`/item/${item.id}`" class="block group min-w-0" :style="{ width: cardWidth + 'px' }">
    <div class="relative rounded-sm overflow-hidden bg-primary box-shadow-book" :style="{ width: cardWidth + 'px', height: cardHeight + 'px' }">
      <covers-book-cover :library-item="libraryItem" :width="cardWidth" :book-cover-aspect-ratio="bookCoverAspectRatio" />

      <div class="absolute inset-0 z-20 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
        <span class="material-symbols fill text-5xl opacity-0 group-hover:opacity-90 transition-opacity">
          {{ item.mediaType === 'podcast' ? 'podcasts' : 'menu_book' }}
        </span>
      </div>
    </div>

    <p class="mt-3 text-base md:text-lg font-semibold truncate group-hover:text-yellow-200">{{ item.title }}</p>
    <p class="text-xs md:text-sm text-white/55 truncate">{{ item.author || item.diskName }}</p>
  </nuxt-link>
</template>

<script>
export default {
  props: {
    item: {
      type: Object,
      required: true
    },
    height: {
      type: Number,
      default: 192
    }
  },
  computed: {
    sizeMultiplier() {
      return this.$store.getters['user/getSizeMultiplier']
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    cardHeight() {
      return Math.round(this.height * this.sizeMultiplier)
    },
    cardWidth() {
      return Math.round(this.cardHeight / this.bookCoverAspectRatio)
    },
    libraryItem() {
      return {
        id: this.item.id,
        updatedAt: this.item.updatedAt,
        media: {
          coverPath: this.item.hasCover ? 'indexed' : null,
          metadata: {
            title: this.item.title,
            authors: this.item.author ? [{ name: this.item.author }] : []
          }
        }
      }
    }
  }
}
</script>
