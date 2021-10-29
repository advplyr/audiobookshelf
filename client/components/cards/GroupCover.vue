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
      coverDiv: null,
      isHovering: false,
      coverImageEls: [],
      coverWidth: 0,
      offsetIncrement: 0,
      isFannedOut: false
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
    setHover(val) {
      if (val && !this.isHovering) {
        this.fanOutCovers()
      } else if (!val && this.isHovering) {
        this.reverseFan()
      }
      this.isHovering = val
    },
    fanOutCovers() {
      if (this.coverImageEls.length < 2 || this.isFannedOut) return
      this.isFannedOut = true
      var fanCoverWidth = this.coverWidth * 0.75
      var fanWidth = (this.coverImageEls.length - 1) * fanCoverWidth
      var offsetLeft = (-1 * fanWidth) / 2
      for (let i = 0; i < this.coverImageEls.length; i++) {
        var coverEl = this.coverImageEls[i]
        coverEl.style.transform = `translateX(${offsetLeft}px)`
        offsetLeft += fanCoverWidth

        var coverOverlay = document.createElement('div')
        coverOverlay.className = 'absolute top-0 left-0 w-full h-full hover:bg-black hover:bg-opacity-40 text-white text-opacity-0 hover:text-opacity-100 flex items-center justify-center'

        if (coverEl.dataset.volumeNumber) {
          var pEl = document.createElement('p')
          pEl.className = 'text-2xl'
          pEl.textContent = `#${coverEl.dataset.volumeNumber}`
          coverOverlay.appendChild(pEl)
        }

        let audiobookId = coverEl.dataset.audiobookId
        coverOverlay.addEventListener('click', (e) => {
          this.$router.push(`/audiobook/${audiobookId}`)
          e.stopPropagation()
          e.preventDefault()
        })
        coverEl.appendChild(coverOverlay)
      }
    },
    reverseFan() {
      if (this.coverImageEls.length < 2 || !this.isFannedOut) return
      this.isFannedOut = false
      for (let i = 0; i < this.coverImageEls.length; i++) {
        var coverEl = this.coverImageEls[i]
        coverEl.style.transform = 'translateX(0px)'
        if (coverEl.lastChild) coverEl.lastChild.remove()
      }
    },
    getCoverUrl(book) {
      return this.$store.getters['audiobooks/getBookCoverSrc'](book, '')
    },
    async buildCoverImg(coverData, bgCoverWidth, offsetLeft, zIndex, forceCoverBg = false) {
      var src = coverData.coverUrl

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
      imgdiv.style.zIndex = zIndex
      imgdiv.dataset.audiobookId = coverData.id
      imgdiv.dataset.volumeNumber = coverData.volumeNumber || ''
      imgdiv.className = 'absolute top-0 box-shadow-book transition-transform'
      imgdiv.style.boxShadow = '4px 0px 4px #11111166'
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
      var validCovers = this.bookItems
        .map((bookItem) => {
          return {
            id: bookItem.id,
            volumeNumber: bookItem.book ? bookItem.book.volumeNumber : null,
            coverUrl: this.getCoverUrl(bookItem)
          }
        })
        .filter((b) => b.coverUrl !== '')
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
      this.coverWidth = coverWidth
      this.offsetIncrement = widthPer

      var outerdiv = document.createElement('div')
      outerdiv.className = 'w-full h-full relative'

      var coverImageEls = []
      for (let i = 0; i < validCovers.length; i++) {
        var offsetLeft = widthPer * i
        var zIndex = validCovers.length - i
        var img = await this.buildCoverImg(validCovers[i], coverWidth, offsetLeft, zIndex, validCovers.length === 1)
        outerdiv.appendChild(img)
        coverImageEls.push(img)
      }
      this.coverImageEls = coverImageEls

      if (this.$refs.wrapper) {
        this.coverDiv = outerdiv
        this.$refs.wrapper.appendChild(outerdiv)
      }
    }
  },
  mounted() {}
}
</script>