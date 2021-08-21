<template>
  <div class="relative rounded-sm overflow-hidden" :style="{ height: width * 1.6 + 'px', width: width + 'px', maxWidth: width + 'px', minWidth: width + 'px' }">
    <img ref="cover" :src="cover" @error="imageError" class="w-full h-full object-cover" />

    <div v-if="imageFailed" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-red-100" :style="{ padding: placeholderCoverPadding + 'rem' }">
      <div class="w-full h-full border-2 border-error flex flex-col items-center justify-center">
        <img src="/LogoTransparent.png" class="mb-2" :style="{ height: 64 * sizeMultiplier + 'px' }" />
        <p class="text-center font-book text-error" :style="{ fontSize: titleFontSize + 'rem' }">Invalid Cover</p>
      </div>
    </div>
    <div v-if="!hasCover" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem' }">
      <div>
        <p class="text-center font-book" style="color: rgb(247 223 187)" :style="{ fontSize: titleFontSize + 'rem' }">{{ titleCleaned }}</p>
      </div>
    </div>
    <div v-if="!hasCover" class="absolute left-0 right-0 w-full flex items-center justify-center" :style="{ padding: placeholderCoverPadding + 'rem', bottom: authorBottom + 'rem' }">
      <p class="text-center font-book" style="color: rgb(247 223 187); opacity: 0.75" :style="{ fontSize: authorFontSize + 'rem' }">{{ authorCleaned }}</p>
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
    return {
      imageFailed: false
    }
  },
  computed: {
    book() {
      return this.audiobook.book || {}
    },
    title() {
      return this.book.title || 'No Title'
    },
    titleCleaned() {
      if (this.title.length > 60) {
        return this.title.slice(0, 57) + '...'
      }
      return this.title
    },
    author() {
      return this.book.author || 'Unknown'
    },
    authorCleaned() {
      if (this.author.length > 30) {
        return this.author.slice(0, 27) + '...'
      }
      return this.author
    },
    cover() {
      return this.book.cover || '/book_placeholder.jpg'
    },
    hasCover() {
      return !!this.book.cover
    },
    sizeMultiplier() {
      return this.width / 120
    },
    titleFontSize() {
      return 0.75 * this.sizeMultiplier
    },
    authorFontSize() {
      return 0.6 * this.sizeMultiplier
    },
    placeholderCoverPadding() {
      return 0.8 * this.sizeMultiplier
    },
    authorBottom() {
      return 0.75 * this.sizeMultiplier
    }
  },
  methods: {
    imageError(err) {
      console.error('ImgError', err)
      this.imageFailed = true
    }
  },
  mounted() {}
}
</script>