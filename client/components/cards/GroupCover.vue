<template>
  <div ref="wrapper" :style="{ height: height + 'px', width: width + 'px' }" class="relative">
    <div v-if="noValidCovers" class="absolute top-0 left-0 w-full h-full flex items-center justify-center box-shadow-book" :style="{ padding: `${sizeMultiplier}rem` }">
      <p :style="{ fontSize: sizeMultiplier + 'rem' }">{{ name }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    name: String,
    bookItems: {
      type: Array,
      default: () => []
    },
    width: Number,
    height: Number
  },
  data() {
    return {
      noValidCovers: false,
      coverDiv: null
    }
  },
  watch: {
    bookItems: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          // ensure wrapper is initialized
          this.$nextTick(this.init)
        }
      }
    }
  },
  computed: {
    sizeMultiplier() {
      return this.width / 192
    }
  },
  methods: {
    getCoverUrl(book) {
      return this.$store.getters['audiobooks/getBookCoverSrc'](book, '')
    },
    async buildCoverImg(src, bgCoverWidth, offsetLeft, forceCoverBg = false) {
      var showCoverBg =
        forceCoverBg ||
        (await new Promise((resolve) => {
          var image = new Image()

          image.onload = () => {
            var { naturalWidth, naturalHeight } = image
            var aspectRatio = naturalHeight / naturalWidth
            var arDiff = Math.abs(aspectRatio - 1.6)

            // If image aspect ratio is <= 1.45 or >= 1.75 then use cover bg, otherwise stretch to fit
            if (arDiff > 0.15) {
              resolve(true)
            } else {
              resolve(false)
            }
          }
          image.onerror = (err) => {
            console.error(err)
            resolve(false)
          }
          image.src = src
        }))

      var imgdiv = document.createElement('div')
      imgdiv.style.height = this.height + 'px'
      imgdiv.style.width = bgCoverWidth + 'px'
      imgdiv.style.left = offsetLeft + 'px'
      imgdiv.className = 'absolute top-0 box-shadow-book'
      imgdiv.style.boxShadow = '-4px 0px 4px #11111166'
      // imgdiv.style.transform = 'skew(0deg, 15deg)'

      if (showCoverBg) {
        var coverbgwrapper = document.createElement('div')
        coverbgwrapper.className = 'absolute top-0 left-0 w-full h-full bg-primary'

        var coverbg = document.createElement('div')
        coverbg.className = 'w-full h-full'
        coverbg.style.backgroundImage = `url("${src}")`
        coverbg.style.backgroundSize = 'cover'
        coverbg.style.backgroundPosition = 'center'
        coverbg.style.opacity = 0.25
        coverbg.style.filter = 'blur(1px)'

        coverbgwrapper.appendChild(coverbg)
        imgdiv.appendChild(coverbgwrapper)
      }

      var img = document.createElement('img')
      img.src = src
      img.className = 'absolute top-0 left-0 w-full h-full'
      img.style.objectFit = showCoverBg ? 'contain' : 'cover'

      imgdiv.appendChild(img)
      return imgdiv
    },
    async init() {
      if (this.coverDiv) {
        this.coverDiv.remove()
        this.coverDiv = null
      }
      var validCovers = this.bookItems.map((bookItem) => this.getCoverUrl(bookItem.book)).filter((b) => b !== '')
      if (!validCovers.length) {
        this.noValidCovers = true
        return
      }
      this.noValidCovers = false

      var coverWidth = this.width
      var widthPer = this.width
      if (validCovers.length > 1) {
        coverWidth = this.height / 1.6
        widthPer = (this.width - coverWidth) / (validCovers.length - 1)
      }

      var outerdiv = document.createElement('div')
      outerdiv.className = 'w-full h-full relative'

      for (let i = 0; i < validCovers.length; i++) {
        var offsetLeft = widthPer * i
        var img = await this.buildCoverImg(validCovers[i], coverWidth, offsetLeft, validCovers.length === 1)
        outerdiv.appendChild(img)
      }

      if (this.$refs.wrapper) {
        this.coverDiv = outerdiv
        this.$refs.wrapper.appendChild(outerdiv)
      }
    }
  },
  mounted() {}
}
</script>