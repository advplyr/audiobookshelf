<template>
  <div class="relative rounded-sm overflow-hidden" :style="{ height: width * 1.6 + 'px', width: width + 'px', maxWidth: width + 'px', minWidth: width + 'px' }">
    <div class="w-full h-full relative">
      <div v-if="showCoverBg" class="bg-primary absolute top-0 left-0 w-full h-full">
        <div class="w-full h-full z-0" ref="coverBg" />
      </div>
      <img ref="cover" :src="fullCoverUrl" @error="imageError" @load="imageLoaded" class="w-full h-full absolute top-0 left-0" :class="showCoverBg ? 'object-contain' : 'object-cover'" />
    </div>

    <div v-if="imageFailed" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-red-100" :style="{ padding: placeholderCoverPadding + 'rem' }">
      <div class="w-full h-full border-2 border-error flex flex-col items-center justify-center">
        <img src="/Logo.png" class="mb-2" :style="{ height: 64 * sizeMultiplier + 'px' }" />
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
    authorOverride: String,
    width: {
      type: Number,
      default: 120
    }
  },
  data() {
    return {
      imageFailed: false,
      showCoverBg: false
    }
  },
  watch: {
    cover() {
      this.imageFailed = false
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
      if (this.authorOverride) return this.authorOverride
      return this.book.author || 'Unknown'
    },
    authorCleaned() {
      if (this.author.length > 30) {
        return this.author.slice(0, 27) + '...'
      }
      return this.author
    },
    placeholderUrl() {
      return '/book_placeholder.jpg'
    },
    fullCoverUrl() {
      return this.$store.getters['audiobooks/getBookCoverSrc'](this.audiobook, this.placeholderUrl)
    },
    cover() {
      return this.book.cover || this.placeholderUrl
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
    },
    userToken() {
      return this.$store.getters['user/getToken']
    }
  },
  methods: {
    setCoverBg() {
      if (this.$refs.coverBg) {
        this.$refs.coverBg.style.backgroundImage = `url("${this.fullCoverUrl}")`
        this.$refs.coverBg.style.backgroundSize = 'cover'
        this.$refs.coverBg.style.backgroundPosition = 'center'
        this.$refs.coverBg.style.opacity = 0.25
        this.$refs.coverBg.style.filter = 'blur(1px)'
      }
    },
    hideCoverBg() {},
    imageLoaded() {
      if (this.$refs.cover && this.cover !== this.placeholderUrl) {
        var { naturalWidth, naturalHeight } = this.$refs.cover
        var aspectRatio = naturalHeight / naturalWidth
        var arDiff = Math.abs(aspectRatio - 1.6)

        // If image aspect ratio is <= 1.45 or >= 1.75 then use cover bg, otherwise stretch to fit
        if (arDiff > 0.15) {
          this.showCoverBg = true
          this.$nextTick(this.setCoverBg)
        } else {
          this.showCoverBg = false
        }
      }
    },
    imageError(err) {
      console.error('ImgError', err)
      this.imageFailed = true
    }
  },
  mounted() {}
}
</script>