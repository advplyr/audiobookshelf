<template>
  <div ref="wrapper" :style="{ height: height + 'px', width: width + 'px' }" class="relative" @mouseover="mouseoverCover" @mouseleave="mouseleaveCover">
    <div v-if="noValidCovers" class="absolute top-0 left-0 w-full h-full flex items-center justify-center box-shadow-book" :style="{ padding: `${sizeMultiplier}rem` }">
      <p :style="{ fontSize: sizeMultiplier + 'rem' }">{{ name }}</p>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    id: String,
    name: String,
    bookItems: {
      type: Array,
      default: () => []
    },
    width: Number,
    height: Number,
    groupTo: String,
    isCategorized: Boolean,
    bookCoverAspectRatio: Number
  },
  data() {
    return {
      noValidCovers: false,
      coverDiv: null,
      isHovering: false,
      coverWrapperEl: null,
      coverImageEls: [],
      coverWidth: 0,
      offsetIncrement: 0,
      isFannedOut: false,
      isDetached: false,
      isAttaching: false,
      windowWidth: 0,
      isInit: false
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
      if (this.bookCoverAspectRatio === 1) return this.width / (120 * 1.6 * 2)
      return this.width / 240
    },
    showExperimentalFeatures() {
      return this.store.state.showExperimentalFeatures
    },
    showCoverFan() {
      // return this.showExperimentalFeatures && this.windowWidth > 1024 && !this.isCategorized
      return false
    },
    store() {
      return this.$store || this.$nuxt.$store
    },
    router() {
      return this.$router || this.$nuxt.$router
    }
  },
  methods: {
    mouseoverCover() {
      if (this.showCoverFan) this.setHover(true)
    },
    mouseleaveCover() {
      if (this.showCoverFan) this.setHover(false)
    },
    detchCoverWrapper() {
      if (!this.coverWrapperEl || !this.$refs.wrapper || this.isDetached) return

      this.coverWrapperEl.remove()

      this.isDetached = true
      document.body.appendChild(this.coverWrapperEl)
      this.coverWrapperEl.addEventListener('mouseleave', this.mouseleaveCover)

      this.coverWrapperEl.style.position = 'absolute'
      this.coverWrapperEl.style.zIndex = 40

      this.updatePosition()
    },
    attachCoverWrapper() {
      if (!this.coverWrapperEl || !this.$refs.wrapper || !this.isDetached) return

      this.coverWrapperEl.remove()
      this.coverWrapperEl.style.position = 'relative'
      this.coverWrapperEl.style.left = 'unset'
      this.coverWrapperEl.style.top = 'unset'
      this.coverWrapperEl.style.width = this.$refs.wrapper.clientWidth + 'px'

      this.$refs.wrapper.appendChild(this.coverWrapperEl)

      this.isDetached = false
    },
    updatePosition() {
      var rect = this.$refs.wrapper.getBoundingClientRect()
      this.coverWrapperEl.style.top = rect.top + window.scrollY + 'px'

      this.coverWrapperEl.style.left = rect.left + window.scrollX + 4 + 'px'

      this.coverWrapperEl.style.height = rect.height + 'px'
      this.coverWrapperEl.style.width = rect.width + 'px'
    },
    setHover(val) {
      if (this.isAttaching) return
      if (val && !this.isHovering) {
        this.detchCoverWrapper()
        this.fanOutCovers()
      } else if (!val && this.isHovering) {
        this.isAttaching = true
        // this.reverseFan()
        // setTimeout(() => {
        //   this.attachCoverWrapper()
        //   this.isAttaching = false
        // }, 100)
      }
      this.isHovering = val
    },
    fanOutCovers() {
      if (this.coverImageEls.length < 2 || this.isFannedOut) return
      this.isFannedOut = true
      var fanCoverWidth = this.coverWidth * 0.75
      var maximumWidth = window.innerWidth - 80

      var totalFanWidth = (this.coverImageEls.length + 1) * fanCoverWidth

      // If Fan width is too large, set new fan cover width
      if (totalFanWidth > maximumWidth) {
        fanCoverWidth = maximumWidth / (this.coverImageEls.length + 1)
      }

      var fanWidth = (this.coverImageEls.length - 1) * fanCoverWidth
      var offsetLeft = (-1 * fanWidth) / 2

      var rect = this.$refs.wrapper.getBoundingClientRect()

      // If fan is going off page left or right, make adjustment
      var leftEdge = rect.left + offsetLeft
      var rightEdge = rect.left + rect.width - offsetLeft
      if (leftEdge < 0) {
        offsetLeft += leftEdge * -1
      }
      if (rightEdge + 80 > window.innerWidth) {
        var difference = rightEdge + 80 - window.innerWidth
        offsetLeft -= difference / 2
      }

      for (let i = 0; i < this.coverImageEls.length; i++) {
        var coverEl = this.coverImageEls[i]

        // Series name card pop out further
        if (i === this.coverImageEls.length - 1) {
          offsetLeft += fanCoverWidth * 0.25
        }

        coverEl.style.transform = `translateX(${offsetLeft}px)`
        offsetLeft += fanCoverWidth

        var coverOverlay = document.createElement('div')
        coverOverlay.className = 'absolute top-0 left-0 w-full h-full hover:bg-black hover:bg-opacity-40 text-white text-opacity-0 hover:text-opacity-100 flex items-center justify-center cursor-pointer'

        if (coverEl.dataset.volumeNumber) {
          var pEl = document.createElement('p')
          pEl.className = 'text-2xl'
          pEl.textContent = `#${coverEl.dataset.volumeNumber}`
          coverOverlay.appendChild(pEl)
        }
        if (coverEl.dataset.audiobookId) {
          let audiobookId = coverEl.dataset.audiobookId
          coverOverlay.addEventListener('click', (e) => {
            this.router.push(`/audiobook/${audiobookId}`)
            e.stopPropagation()
            e.preventDefault()
          })
        } else {
          // Is Series
          coverOverlay.addEventListener('click', (e) => {
            this.router.push(this.groupTo)
            e.stopPropagation()
            e.preventDefault()
          })
        }

        coverEl.appendChild(coverOverlay)
      }
    },
    reverseFan() {
      if (this.coverImageEls.length < 2 || !this.isFannedOut) return
      this.isFannedOut = false
      for (let i = 0; i < this.coverImageEls.length; i++) {
        var coverEl = this.coverImageEls[i]
        coverEl.style.transform = 'translateX(0px)'
        if (coverEl.lastChild) coverEl.lastChild.remove() // Remove cover overlay
      }
    },
    getCoverUrl(book) {
      return this.store.getters['audiobooks/getBookCoverSrc'](book, '')
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
            var arDiff = Math.abs(aspectRatio - this.bookCoverAspectRatio)

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
        coverbgwrapper.className = 'absolute top-0 left-0 w-full h-full overflow-hidden rounded-sm bg-primary'

        var coverbg = document.createElement('div')
        coverbg.className = 'absolute cover-bg'
        coverbg.style.backgroundImage = `url("${src}")`

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
    createSeriesNameCover(offsetLeft) {
      var imgdiv = document.createElement('div')
      imgdiv.style.height = this.height + 'px'
      imgdiv.style.width = this.height / this.bookCoverAspectRatio + 'px'
      imgdiv.style.left = offsetLeft + 'px'
      imgdiv.className = 'absolute top-0 box-shadow-book transition-transform flex items-center justify-center'
      imgdiv.style.boxShadow = '4px 0px 4px #11111166'
      imgdiv.style.backgroundColor = '#111'

      var innerP = document.createElement('p')
      innerP.textContent = this.name
      innerP.className = 'text-sm font-book text-white'
      imgdiv.appendChild(innerP)

      return imgdiv
    },
    async init() {
      if (this.isInit) return
      this.isInit = true

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
        coverWidth = this.height / this.bookCoverAspectRatio
        widthPer = (this.width - coverWidth) / (validCovers.length - 1)
      }
      this.coverWidth = coverWidth
      this.offsetIncrement = widthPer

      var outerdiv = document.createElement('div')
      outerdiv.id = `group-cover-${this.id}`
      this.coverWrapperEl = outerdiv
      outerdiv.className = 'w-full h-full relative box-shadow-book'

      var coverImageEls = []
      var offsetLeft = 0
      for (let i = 0; i < validCovers.length; i++) {
        offsetLeft = widthPer * i
        var zIndex = validCovers.length - i
        var img = await this.buildCoverImg(validCovers[i], coverWidth, offsetLeft, zIndex, validCovers.length === 1)
        outerdiv.appendChild(img)
        coverImageEls.push(img)
      }

      if (this.showCoverFan) {
        var seriesNameCover = this.createSeriesNameCover(offsetLeft)
        outerdiv.appendChild(seriesNameCover)
        coverImageEls.push(seriesNameCover)
      }

      this.coverImageEls = coverImageEls

      if (this.$refs.wrapper) {
        this.coverDiv = outerdiv
        this.$refs.wrapper.appendChild(outerdiv)
      }
    }
  },
  mounted() {
    this.windowWidth = window.innerWidth
  },
  beforeDestroy() {
    if (this.coverWrapperEl) this.coverWrapperEl.remove()
    if (this.coverImageEls && this.coverImageEls.length) {
      this.coverImageEls.forEach((el) => el.remove())
    }
    if (this.coverDiv) this.coverDiv.remove()
  }
}
</script>