<template>
  <div class="relative rounded-sm overflow-hidden" :style="{ height: width * 1.6 + 'px', width: width + 'px', maxWidth: width + 'px', minWidth: width + 'px' }">
    <div class="w-full h-full relative bg-bg">
      <div v-if="showCoverBg" class="bg-primary absolute top-0 left-0 w-full h-full">
        <div class="w-full h-full z-0" ref="coverBg" />
      </div>
      <img v-if="audiobook" ref="cover" :src="fullCoverUrl" loading="lazy" @error="imageError" @load="imageLoaded" class="w-full h-full absolute top-0 left-0 z-10" :class="showCoverBg ? 'object-contain' : 'object-cover'" />
      <div v-show="loading && audiobook" class="absolute top-0 left-0 h-full w-full flex items-center justify-center">
        <p class="font-book text-center" :style="{ fontSize: 0.75 * sizeMultiplier + 'rem' }">{{ title }}</p>
        <div class="absolute top-2 right-2">
          <div class="la-ball-spin-clockwise la-sm">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="imageFailed" class="absolute top-0 left-0 right-0 bottom-0 w-full h-full bg-red-100" :style="{ padding: placeholderCoverPadding + 'rem' }">
      <div class="w-full h-full border-2 border-error flex flex-col items-center justify-center">
        <img src="/Logo.png" loading="lazy" class="mb-2" :style="{ height: 64 * sizeMultiplier + 'px' }" />
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
      loading: true,
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
      if (!this.audiobook) return {}
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
      if (!this.audiobook) return null
      var store = this.$store || this.$nuxt.$store
      return store.getters['audiobooks/getBookCoverSrc'](this.audiobook, this.placeholderUrl)
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
      this.loading = false
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
      this.loading = false
      console.error('ImgError', err)
      this.imageFailed = true
    }
  },
  mounted() {}
}
</script>

<style>
/*!
 * Load Awesome v1.1.0 (http://github.danielcardoso.net/load-awesome/)
 * Copyright 2015 Daniel Cardoso <@DanielCardoso>
 * Licensed under MIT
 */
.la-ball-spin-clockwise,
.la-ball-spin-clockwise > div {
  position: relative;
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
}
.la-ball-spin-clockwise {
  display: block;
  font-size: 0;
  color: #fff;
}
.la-ball-spin-clockwise.la-dark {
  color: #262626;
}
.la-ball-spin-clockwise > div {
  display: inline-block;
  float: none;
  background-color: currentColor;
  border: 0 solid currentColor;
}
.la-ball-spin-clockwise {
  width: 32px;
  height: 32px;
}
.la-ball-spin-clockwise > div {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-top: -4px;
  margin-left: -4px;
  border-radius: 100%;
  -webkit-animation: ball-spin-clockwise 1s infinite ease-in-out;
  -moz-animation: ball-spin-clockwise 1s infinite ease-in-out;
  -o-animation: ball-spin-clockwise 1s infinite ease-in-out;
  animation: ball-spin-clockwise 1s infinite ease-in-out;
}
.la-ball-spin-clockwise > div:nth-child(1) {
  top: 5%;
  left: 50%;
  -webkit-animation-delay: -0.875s;
  -moz-animation-delay: -0.875s;
  -o-animation-delay: -0.875s;
  animation-delay: -0.875s;
}
.la-ball-spin-clockwise > div:nth-child(2) {
  top: 18.1801948466%;
  left: 81.8198051534%;
  -webkit-animation-delay: -0.75s;
  -moz-animation-delay: -0.75s;
  -o-animation-delay: -0.75s;
  animation-delay: -0.75s;
}
.la-ball-spin-clockwise > div:nth-child(3) {
  top: 50%;
  left: 95%;
  -webkit-animation-delay: -0.625s;
  -moz-animation-delay: -0.625s;
  -o-animation-delay: -0.625s;
  animation-delay: -0.625s;
}
.la-ball-spin-clockwise > div:nth-child(4) {
  top: 81.8198051534%;
  left: 81.8198051534%;
  -webkit-animation-delay: -0.5s;
  -moz-animation-delay: -0.5s;
  -o-animation-delay: -0.5s;
  animation-delay: -0.5s;
}
.la-ball-spin-clockwise > div:nth-child(5) {
  top: 94.9999999966%;
  left: 50.0000000005%;
  -webkit-animation-delay: -0.375s;
  -moz-animation-delay: -0.375s;
  -o-animation-delay: -0.375s;
  animation-delay: -0.375s;
}
.la-ball-spin-clockwise > div:nth-child(6) {
  top: 81.8198046966%;
  left: 18.1801949248%;
  -webkit-animation-delay: -0.25s;
  -moz-animation-delay: -0.25s;
  -o-animation-delay: -0.25s;
  animation-delay: -0.25s;
}
.la-ball-spin-clockwise > div:nth-child(7) {
  top: 49.9999750815%;
  left: 5.0000051215%;
  -webkit-animation-delay: -0.125s;
  -moz-animation-delay: -0.125s;
  -o-animation-delay: -0.125s;
  animation-delay: -0.125s;
}
.la-ball-spin-clockwise > div:nth-child(8) {
  top: 18.179464974%;
  left: 18.1803700518%;
  -webkit-animation-delay: 0s;
  -moz-animation-delay: 0s;
  -o-animation-delay: 0s;
  animation-delay: 0s;
}
.la-ball-spin-clockwise.la-sm {
  width: 16px;
  height: 16px;
}
.la-ball-spin-clockwise.la-sm > div {
  width: 4px;
  height: 4px;
  margin-top: -2px;
  margin-left: -2px;
}
.la-ball-spin-clockwise.la-2x {
  width: 64px;
  height: 64px;
}
.la-ball-spin-clockwise.la-2x > div {
  width: 16px;
  height: 16px;
  margin-top: -8px;
  margin-left: -8px;
}
.la-ball-spin-clockwise.la-3x {
  width: 96px;
  height: 96px;
}
.la-ball-spin-clockwise.la-3x > div {
  width: 24px;
  height: 24px;
  margin-top: -12px;
  margin-left: -12px;
}
/*
 * Animation
 */
@-webkit-keyframes ball-spin-clockwise {
  0%,
  100% {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 0;
    -webkit-transform: scale(0);
    transform: scale(0);
  }
}
@-moz-keyframes ball-spin-clockwise {
  0%,
  100% {
    opacity: 1;
    -moz-transform: scale(1);
    transform: scale(1);
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 0;
    -moz-transform: scale(0);
    transform: scale(0);
  }
}
@-o-keyframes ball-spin-clockwise {
  0%,
  100% {
    opacity: 1;
    -o-transform: scale(1);
    transform: scale(1);
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 0;
    -o-transform: scale(0);
    transform: scale(0);
  }
}
@keyframes ball-spin-clockwise {
  0%,
  100% {
    opacity: 1;
    -webkit-transform: scale(1);
    -moz-transform: scale(1);
    -o-transform: scale(1);
    transform: scale(1);
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 0;
    -webkit-transform: scale(0);
    -moz-transform: scale(0);
    -o-transform: scale(0);
    transform: scale(0);
  }
}
</style>