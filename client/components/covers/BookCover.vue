<template>
  <div class="relative rounded-xs overflow-hidden" :style="{ height: height + 'px', width: width + 'px', maxWidth: width + 'px', minWidth: width + 'px' }">
    <div class="w-full h-full relative bg-bg">
      <div v-show="showCoverBg" class="absolute top-0 left-0 w-full h-full overflow-hidden rounded-xs bg-primary">
        <div class="absolute cover-bg" ref="coverBg" />
      </div>

      <img v-if="libraryItem" ref="cover" :src="fullCoverUrl" loading="lazy" draggable="false" @error="imageError" @load="imageLoaded" class="w-full h-full absolute top-0 left-0 z-10 duration-300 transition-opacity" :style="{ opacity: imageReady ? '1' : '0' }" :class="showCoverBg ? 'object-contain' : 'object-fill'" @click="clickCover" />

      <div v-show="loading && libraryItem" class="absolute top-0 left-0 h-full w-full flex items-center justify-center">
        <p class="text-center" :style="{ fontSize: 0.75 * sizeMultiplier + 'rem' }">{{ title }}</p>
        <div class="absolute top-2 right-2">
          <widgets-loading-spinner />
        </div>
      </div>
    </div>

    <div v-if="imageFailed" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-red-100" :style="{ padding: placeholderCoverPadding + 'rem' }">
      <div class="w-full h-full border-2 border-error flex flex-col items-center justify-center">
        <img src="/Logo.png" loading="lazy" class="mb-2" :style="{ height: 64 * sizeMultiplier + 'px' }" />
        <p class="text-center text-error" :style="{ fontSize: titleFontSize + 'rem' }">Invalid Cover</p>
      </div>
    </div>

    <div v-if="!hasCover" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex items-center justify-center z-10" :style="{ padding: placeholderCoverPadding + 'rem' }">
      <div>
        <p class="text-center" style="color: rgb(247 223 187)" :style="{ fontSize: titleFontSize + 'rem' }">{{ titleCleaned }}</p>
      </div>
    </div>
    <div v-if="!hasCover" class="absolute left-0 right-0 w-full flex items-center justify-center z-10" :style="{ padding: placeholderCoverPadding + 'rem', bottom: authorBottom + 'rem' }">
      <p class="text-center" style="color: rgb(247 223 187); opacity: 0.75" :style="{ fontSize: authorFontSize + 'rem' }">{{ authorCleaned }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    libraryItem: {
      type: Object,
      default: () => {}
    },
    width: {
      type: Number,
      default: 120
    },
    expandOnClick: Boolean,
    bookCoverAspectRatio: Number
  },
  data() {
    return {
      loading: true,
      imageFailed: false,
      showCoverBg: false,
      imageReady: false
    }
  },
  watch: {
    cover() {
      this.imageFailed = false
    }
  },
  computed: {
    squareAspectRatio() {
      return this.bookCoverAspectRatio === 1
    },
    height() {
      return this.width * this.bookCoverAspectRatio
    },
    media() {
      if (!this.libraryItem) return {}
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    title() {
      return this.mediaMetadata.title || 'No Title'
    },
    titleCleaned() {
      if (this.title.length > 60) {
        return this.title.slice(0, 57) + '...'
      }
      return this.title
    },
    authors() {
      return this.mediaMetadata.authors || []
    },
    author() {
      return this.authors.map((au) => au.name).join(', ')
    },
    authorCleaned() {
      if (this.author.length > 30) {
        return this.author.slice(0, 27) + '...'
      }
      return this.author
    },
    placeholderUrl() {
      const store = this.$store || this.$nuxt.$store
      return store.getters['globals/getPlaceholderCoverSrc']
    },
    fullCoverUrl() {
      if (!this.libraryItem) return null
      const store = this.$store || this.$nuxt.$store
      return store.getters['globals/getLibraryItemCoverSrc'](this.libraryItem, this.placeholderUrl)
    },
    rawCoverUrl() {
      if (!this.libraryItem) return null
      const store = this.$store || this.$nuxt.$store
      return store.getters['globals/getLibraryItemCoverSrc'](this.libraryItem, this.placeholderUrl, true)
    },
    cover() {
      return this.media.coverPath || this.placeholderUrl
    },
    hasCover() {
      return !!this.media.coverPath
    },
    sizeMultiplier() {
      var baseSize = this.squareAspectRatio ? 192 : 120
      return this.width / baseSize
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
    resolution() {
      return `${this.naturalWidth}x${this.naturalHeight}px`
    }
  },
  methods: {
    clickCover() {
      if (this.expandOnClick && this.libraryItem) {
        this.$store.commit('globals/setRawCoverPreviewModal', this.rawCoverUrl)
      }
    },
    setCoverBg() {
      if (this.$refs.coverBg) {
        this.$refs.coverBg.style.backgroundImage = `url("${this.fullCoverUrl}")`
      }
    },
    imageLoaded() {
      this.loading = false
      this.$nextTick(() => {
        this.imageReady = true
      })

      if (this.$refs.cover && this.cover !== this.placeholderUrl) {
        var { naturalWidth, naturalHeight } = this.$refs.cover
        var aspectRatio = naturalHeight / naturalWidth
        var arDiff = Math.abs(aspectRatio - this.bookCoverAspectRatio)

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
      this.loading = false
      console.error('ImgError', err)
      this.imageFailed = true
    }
  },
  mounted() {}
}
</script>

