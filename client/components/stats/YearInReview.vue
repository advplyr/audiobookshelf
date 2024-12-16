<template>
  <div>
    <div v-if="processing" role="img" :aria-label="$strings.MessageLoading" class="max-w-[800px] h-80 md:h-[800px] mx-auto flex items-center justify-center">
      <widgets-loading-spinner />
    </div>
    <img v-else-if="dataUrl" :src="dataUrl" class="mx-auto" :aria-label="$getString('LabelPersonalYearReview', [variant + 1])" />
  </div>
</template>

<script>
export default {
  props: {
    variant: {
      type: Number,
      default: 0
    },
    year: Number,
    processing: Boolean
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

      const addIcon = (icon, color, fontSize, x, y) => {
        ctx.fillStyle = color
        ctx.font = `${fontSize} Material Symbols Rounded`
        ctx.fillText(icon, x, y)
      }

      // Bg color
      ctx.fillStyle = '#232323'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Cover image tiles
      const bookCovers = this.yearStats.finishedBooksWithCovers
      bookCovers.push(...this.yearStats.booksWithCovers)

      let finishedBookCoverImgs = {}

      if (bookCovers.length) {
        let index = 0
        ctx.globalAlpha = 0.25
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((-Math.PI / 180) * 25)
        ctx.translate(-canvas.width / 2, -canvas.height / 2)
        ctx.translate(-130, -120)
        for (let x = 0; x < 5; x++) {
          for (let y = 0; y < 5; y++) {
            const coverIndex = index % bookCovers.length
            let libraryItemId = bookCovers[coverIndex]
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
                resolve()
                if (this.yearStats.finishedBooksWithCovers.includes(libraryItemId) && !finishedBookCoverImgs[libraryItemId]) {
                  finishedBookCoverImgs[libraryItemId] = {
                    img,
                    sx,
                    sy,
                    sw
                  }
                }
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

      const twoColumnWidth = 210

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
      createRoundedRect(50, 100, 340, 160)
      addText(this.yearStats.numBooksFinished, '64px', 'bold', 'white', '0px', 160, 165)
      addText(this.$strings.StatsBooksFinished, '28px', 'normal', tanColor, '0px', 160, 210, twoColumnWidth)
      const readIconPath = new Path2D()
      readIconPath.addPath(new Path2D('M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-9 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z'), { a: 2, d: 2, e: 100, f: 160 })
      ctx.fillStyle = '#ffffff'
      ctx.fill(readIconPath)

      // Box top right
      createRoundedRect(410, 100, 340, 160)
      addText(this.$elapsedPrettyExtended(this.yearStats.totalListeningTime, true, false), '40px', 'bold', 'white', '0px', 500, 165)
      addText(this.$strings.StatsSpentListening, '28px', 'normal', tanColor, '0px', 500, 205, twoColumnWidth)
      addIcon('watch_later', 'white', '52px', 440, 180)

      // Box bottom left
      createRoundedRect(50, 280, 340, 160)
      addText(this.yearStats.totalListeningSessions, '64px', 'bold', 'white', '0px', 160, 345)
      addText(this.$strings.StatsSessions, '28px', 'normal', tanColor, '1px', 160, 390, twoColumnWidth)
      addIcon('headphones', 'white', '52px', 95, 360)

      // Box bottom right
      createRoundedRect(410, 280, 340, 160)
      addText(this.yearStats.numBooksListened, '64px', 'bold', 'white', '0px', 500, 345)
      addText(this.$strings.StatsBooksListenedTo, '28px', 'normal', tanColor, '0px', 500, 390, twoColumnWidth)
      addIcon('local_library', 'white', '52px', 440, 360)

      if (!this.variant) {
        // Text stats
        const topNarrator = this.yearStats.mostListenedNarrator
        if (topNarrator) {
          addText(this.$strings.StatsTopNarrator, '24px', 'normal', tanColor, '1px', 70, 520, 330)
          addText(topNarrator.name, '36px', 'bolder', 'white', '0px', 70, 564, 330)
          addText(this.$elapsedPrettyExtended(topNarrator.time, true, false), '24px', 'lighter', 'white', '1px', 70, 599)
        }

        const topGenre = this.yearStats.topGenres[0]
        if (topGenre) {
          addText(this.$strings.StatsTopGenre, '24px', 'normal', tanColor, '1px', 430, 520, 330)
          addText(topGenre.genre, '36px', 'bolder', 'white', '0px', 430, 564, 330)
          addText(this.$elapsedPrettyExtended(topGenre.time, true, false), '24px', 'lighter', 'white', '1px', 430, 599)
        }

        const topAuthor = this.yearStats.topAuthors[0]
        if (topAuthor) {
          addText(this.$strings.StatsTopAuthor, '24px', 'normal', tanColor, '1px', 70, 670, 330)
          addText(topAuthor.name, '36px', 'bolder', 'white', '0px', 70, 714, 330)
          addText(this.$elapsedPrettyExtended(topAuthor.time, true, false), '24px', 'lighter', 'white', '1px', 70, 749)
        }

        if (this.yearStats.mostListenedMonth?.time) {
          const jsdate = new Date(this.year, this.yearStats.mostListenedMonth.month, 1)
          const monthName = this.$formatJsDate(jsdate, 'LLLL')
          addText(this.$strings.StatsTopMonth, '24px', 'normal', tanColor, '1px', 430, 670, 330)
          addText(monthName, '36px', 'bolder', 'white', '0px', 430, 714, 330)
          addText(this.$elapsedPrettyExtended(this.yearStats.mostListenedMonth.time, true, false), '24px', 'lighter', 'white', '1px', 430, 749)
        }
      } else if (this.variant === 1) {
        // Bottom images
        finishedBookCoverImgs = Object.values(finishedBookCoverImgs)
        if (finishedBookCoverImgs.length > 0) {
          ctx.textAlign = 'center'
          addText(this.$strings.StatsBooksFinishedThisYear, '28px', 'normal', tanColor, '0px', canvas.width / 2, 530)

          for (let i = 0; i < Math.min(5, finishedBookCoverImgs.length); i++) {
            let imgToAdd = finishedBookCoverImgs[i]
            ctx.drawImage(imgToAdd.img, imgToAdd.sx, imgToAdd.sy, imgToAdd.sw, imgToAdd.sw, 40 + 145 * i, 570, 140, 140)
          }
        }
      } else if (this.variant === 2) {
        // Text stats
        if (this.yearStats.topAuthors.length) {
          addText(this.$strings.StatsTopAuthors, '24px', 'normal', tanColor, '1px', 70, 524)
          for (let i = 0; i < this.yearStats.topAuthors.length; i++) {
            addText(this.yearStats.topAuthors[i].name, '36px', 'bolder', 'white', '0px', 70, 584 + i * 60, 330)
          }
        }

        if (this.yearStats.topGenres.length) {
          addText(this.$strings.StatsTopGenres, '24px', 'normal', tanColor, '1px', 430, 524)
          for (let i = 0; i < this.yearStats.topGenres.length; i++) {
            addText(this.yearStats.topGenres[i].genre, '36px', 'bolder', 'white', '0px', 430, 584 + i * 60, 330)
          }
        }
      }

      this.canvas = canvas
      this.dataUrl = canvas.toDataURL('png')
    },
    refresh() {
      this.init()
    },
    share() {
      this.canvas.toBlob((blob) => {
        const file = new File([blob], 'yearinreview.png', { type: blob.type })
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
    async init() {
      this.$emit('update:processing', true)
      this.yearStats = await this.$axios.$get(`/api/me/stats/year/${this.year}`).catch((err) => {
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
