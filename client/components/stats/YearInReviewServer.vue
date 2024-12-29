<template>
  <div>
    <div v-if="processing" role="img" :aria-label="$strings.MessageLoading" class="max-w-[800px] h-80 md:h-[800px] mx-auto flex items-center justify-center">
      <widgets-loading-spinner />
    </div>
    <img v-else-if="dataUrl" :src="dataUrl" class="mx-auto" :aria-label="$getString('LabelServerYearReview', [variant + 1])" />
  </div>
</template>

<script>
export default {
  props: {
    variant: {
      type: Number,
      default: 0
    },
    processing: Boolean,
    year: Number
  },
  data() {
    return {
      canvas: null,
      dataUrl: null,
      yearStats: null
    }
  },
  watch: {
    variant() {
      this.init()
    }
  },
  methods: {
    async initCanvas() {
      if (!this.yearStats) return

      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 800
      const ctx = canvas.getContext('2d')

      const createRoundedRect = (x, y, w, h) => {
        const grd1 = ctx.createLinearGradient(x, y, x + w, y + h)
        grd1.addColorStop(0, '#44444455')
        grd1.addColorStop(1, '#ffffff11')
        ctx.fillStyle = grd1
        ctx.strokeStyle = '#C0C0C088'
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, [20])
        ctx.fill()
        ctx.stroke()
      }

      const addText = (text, fontSize, fontWeight, color, letterSpacing, x, y, maxWidth = 0) => {
        ctx.fillStyle = color
        ctx.font = `${fontWeight} ${fontSize} Source Sans Pro`
        ctx.letterSpacing = letterSpacing

        // If maxWidth is specified then continue to remove chars until under maxWidth and add ellipsis
        if (maxWidth) {
          let txtWidth = ctx.measureText(text).width
          while (txtWidth > maxWidth) {
            console.warn(`Text "${text}" is greater than max width ${maxWidth} (width:${txtWidth})`)
            if (text.endsWith('...')) text = text.slice(0, -4) // Repeated checks remove 1 char at a time
            else text = text.slice(0, -3) // First check remove last 3 chars
            text += '...'
            txtWidth = ctx.measureText(text).width
            console.log(`Checking text "${text}" (width:${txtWidth})`)
          }
        }

        ctx.fillText(text, x, y)
      }

      // Bg color
      ctx.fillStyle = '#232323'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Cover image tiles
      let imgsToAdd = {}

      if (this.yearStats.booksAddedWithCovers.length) {
        let index = 0
        ctx.globalAlpha = 0.25
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((-Math.PI / 180) * 25)
        ctx.translate(-canvas.width / 2, -canvas.height / 2)
        ctx.translate(-130, -120)
        for (let x = 0; x < 5; x++) {
          for (let y = 0; y < 5; y++) {
            const coverIndex = index % this.yearStats.booksAddedWithCovers.length
            let libraryItemId = this.yearStats.booksAddedWithCovers[coverIndex]
            index++

            await new Promise((resolve) => {
              const img = new Image()
              img.crossOrigin = 'anonymous'
              img.addEventListener('load', () => {
                let sw = img.width
                if (img.width > img.height) {
                  sw = img.height
                }
                let sx = -(sw - img.width) / 2
                let sy = -(sw - img.height) / 2
                ctx.drawImage(img, sx, sy, sw, sw, 215 * x, 215 * y, 215, 215)
                if (!imgsToAdd[libraryItemId]) {
                  imgsToAdd[libraryItemId] = {
                    img,
                    sx,
                    sy,
                    sw
                  }
                }
                resolve()
              })
              img.addEventListener('error', () => {
                resolve()
              })
              img.src = this.$store.getters['globals/getLibraryItemCoverSrcById'](libraryItemId)
            })
          }
        }
        ctx.restore()
      }

      const threeColumnTextWidth = 200

      ctx.globalAlpha = 1
      ctx.textBaseline = 'middle'

      // Create gradient
      const grd1 = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grd1.addColorStop(0, '#000000aa')
      grd1.addColorStop(1, '#cd9d49aa')
      ctx.fillStyle = grd1
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Top Abs icon
      let tanColor = '#ffdb70'
      ctx.fillStyle = tanColor
      ctx.font = '42px absicons'
      ctx.fillText('\ue900', 15, 36)

      // Top text
      addText('audiobookshelf', '28px', 'normal', tanColor, '0px', 65, 28)
      addText(`${this.year} ${this.$strings.StatsYearInReview}`, '18px', 'bold', 'white', '1px', 65, 51)

      // Top left box
      createRoundedRect(40, 100, 230, 100)
      ctx.textAlign = 'center'
      addText(this.yearStats.numBooksAdded, '48px', 'bold', 'white', '0px', 155, 140)
      addText(this.$strings.StatsBooksAdded, '18px', 'normal', tanColor, '0px', 155, 170, threeColumnTextWidth)

      // Box top right
      createRoundedRect(285, 100, 230, 100)
      addText(this.yearStats.numAuthorsAdded, '48px', 'bold', 'white', '0px', 400, 140)
      addText(this.$strings.StatsAuthorsAdded, '18px', 'normal', tanColor, '0px', 400, 170, threeColumnTextWidth)

      // Box bottom left
      createRoundedRect(530, 100, 230, 100)
      addText(this.yearStats.numListeningSessions, '48px', 'bold', 'white', '0px', 645, 140)
      addText(this.$strings.StatsSessions, '18px', 'normal', tanColor, '1px', 645, 170, threeColumnTextWidth)

      // Text stats
      if (this.yearStats.totalBooksAddedSize) {
        addText(this.$strings.StatsCollectionGrewTo, '24px', 'normal', tanColor, '0px', canvas.width / 2, 260)
        addText(this.$bytesPretty(this.yearStats.totalBooksSize), '36px', 'bolder', 'white', '0px', canvas.width / 2, 300)
        addText('+' + this.$bytesPretty(this.yearStats.totalBooksAddedSize), '20px', 'lighter', 'white', '0px', canvas.width / 2, 330)
      }

      if (this.yearStats.totalBooksAddedDuration) {
        addText(this.$strings.StatsTotalDuration, '24px', 'normal', tanColor, '0px', canvas.width / 2, 400)
        addText(this.$elapsedPrettyExtended(this.yearStats.totalBooksDuration, true, false), '36px', 'bolder', 'white', '0px', canvas.width / 2, 440)
        addText('+' + this.$elapsedPrettyExtended(this.yearStats.totalBooksAddedDuration, true, false), '20px', 'lighter', 'white', '0px', canvas.width / 2, 470)
      }

      if (!this.variant) {
        // Bottom images
        imgsToAdd = Object.values(imgsToAdd)
        if (imgsToAdd.length > 0) {
          addText(this.$strings.StatsBooksAdditional, '24px', 'normal', tanColor, '0px', canvas.width / 2, 540)

          for (let i = 0; i < Math.min(5, imgsToAdd.length); i++) {
            let imgToAdd = imgsToAdd[i]
            ctx.drawImage(imgToAdd.img, imgToAdd.sx, imgToAdd.sy, imgToAdd.sw, imgToAdd.sw, 40 + 145 * i, 580, 140, 140)
          }
        }
      } else if (this.variant === 1) {
        // Text stats
        ctx.textAlign = 'left'
        if (this.yearStats.topAuthors.length) {
          addText(this.$strings.StatsTopAuthors, '24px', 'normal', tanColor, '1px', 70, 549, 330)
          for (let i = 0; i < this.yearStats.topAuthors.length; i++) {
            addText(this.yearStats.topAuthors[i].name, '36px', 'bolder', 'white', '0px', 70, 609 + i * 60, 330)
          }
        }

        if (this.yearStats.topNarrators.length) {
          addText(this.$strings.StatsTopNarrators, '24px', 'normal', tanColor, '1px', 430, 549)
          for (let i = 0; i < this.yearStats.topNarrators.length; i++) {
            addText(this.yearStats.topNarrators[i].name, '36px', 'bolder', 'white', '0px', 430, 609 + i * 60, 330)
          }
        }
      } else if (this.variant === 2) {
        // Text stats
        ctx.textAlign = 'left'
        if (this.yearStats.topAuthors.length) {
          addText(this.$strings.StatsTopAuthors, '24px', 'normal', tanColor, '1px', 70, 549, 330)
          for (let i = 0; i < this.yearStats.topAuthors.length; i++) {
            addText(this.yearStats.topAuthors[i].name, '36px', 'bolder', 'white', '0px', 70, 609 + i * 60, 330)
          }
        }

        if (this.yearStats.topGenres.length) {
          addText(this.$strings.StatsTopGenres, '24px', 'normal', tanColor, '1px', 430, 549)
          for (let i = 0; i < this.yearStats.topGenres.length; i++) {
            addText(this.yearStats.topGenres[i].genre, '36px', 'bolder', 'white', '0px', 430, 609 + i * 60, 330)
          }
        }
      }

      this.canvas = canvas
      this.dataUrl = canvas.toDataURL('png')
    },
    share() {
      this.canvas.toBlob((blob) => {
        const file = new File([blob], 'yearinreviewserver.png', { type: blob.type })
        const shareData = {
          files: [file]
        }
        if (navigator.canShare(shareData)) {
          navigator
            .share(shareData)
            .then(() => {
              console.log('Share success')
            })
            .catch((error) => {
              console.error('Failed to share', error)
              if (error.name !== 'AbortError') {
                this.$toast.error(this.$strings.ToastFailedToShare + ': ' + error.message)
              }
            })
        } else {
          this.$toast.error(this.$strings.ToastErrorCannotShare)
        }
      })
    },
    refresh() {
      this.init()
    },
    async init() {
      this.$emit('update:processing', true)
      this.yearStats = await this.$axios.$get(`/api/stats/year/${this.year}`).catch((err) => {
        console.error('Failed to load stats for year', err)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return null
      })
      await this.initCanvas()
      this.$emit('update:processing', false)
    }
  },
  mounted() {
    this.init()
  }
}
</script>
