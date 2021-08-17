<template>
  <div class="relative rounded-sm overflow-hidden" :style="{ height: width * 1.6 + 'px', width: width + 'px' }">
    <img ref="cover" :src="cover" class="w-full h-full object-cover" />

    <div v-if="!hasCover" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem' }">
      <div>
        <p class="text-center font-book" style="color: rgb(247 223 187)" :style="{ fontSize: titleFontSize + 'rem' }">{{ titleCleaned }}</p>
      </div>
    </div>
    <div v-if="!hasCover" class="absolute left-0 right-0 w-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem', bottom: authorBottom + 'rem' }">
      <p class="text-center font-book" style="color: rgb(247 223 187); opacity: 0.75" :style="{ fontSize: authorFontSize + 'rem' }">{{ author }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    audiobook: {
      type: Object,
      default: () => {}
    },
    width: {
      type: Number,
      default: 120
    }
  },
  data() {
    return {}
  },
  computed: {
    book() {
      return this.audiobook.book || {}
    },
    title() {
      return this.book.title || 'No Title'
    },
    titleCleaned() {
      if (this.title.length > 75) {
        return this.title.slice(0, 47) + '...'
      }
      return this.title
    },
    author() {
      return this.book.author || 'Unknown'
    },
    cover() {
      return this.book.cover || '/book_placeholder.jpg'
    },
    hasCover() {
      return !!this.book.cover
    },
    fontSizeMultiplier() {
      return this.width / 120
    },
    titleFontSize() {
      return 0.75 * this.fontSizeMultiplier
    },
    authorFontSize() {
      return 0.6 * this.fontSizeMultiplier
    },
    placeholderCoverPadding() {
      return 0.8 * this.fontSizeMultiplier
    },
    authorBottom() {
      return 0.75 * this.fontSizeMultiplier
    }
  },
  methods: {},
  mounted() {}
}
</script>