<template>
  <div>
    <div v-if="processing" class="max-w-[600px] h-32 sm:h-[200px] flex items-center justify-center">
      <widgets-loading-spinner />
    </div>
    <img v-else-if="dataUrl" :src="dataUrl" />
  </div>
</template>

<script>
export default {
  props: {
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
  methods: {
    async initCanvas() {
      if (!this.yearStats) return

      const canvas = document.createElement('canvas')
      canvas.width = 600
      canvas.height = 200
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

      if (bookCovers.length) {
        let index = 0
        ctx.globalAlpha = 0.25
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((-Math.PI / 180) * 25)
        ctx.translate(-canvas.width / 2, -canvas.height / 2)
        ctx.translate(-10, -90)
        for (let x = 0; x < 4; x++) {
          for (let y = 0; y < 3; y++) {
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
                ctx.drawImage(img, sx, sy, sw, sw, 155 * x, 155 * y, 155, 155)
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

      const twoColumnWidth = 180

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
      createRoundedRect(15, 75, 280, 110)
      addText(this.yearStats.numBooksFinished, '48px', 'bold', 'white', '0px', 105, 120)
      addText(this.$strings.StatsBooksFinished, '20px', 'normal', tanColor, '0px', 105, 155, twoColumnWidth)
      const readIconPath = new Path2D()
      readIconPath.addPath(new Path2D('M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-9 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z'), { a: 1.5, d: 1.5, e: 55, f: 115 })
      ctx.fillStyle = '#ffffff'
      ctx.fill(readIconPath)

      createRoundedRect(305, 75, 280, 110)
      addText(this.yearStats.numBooksListened, '48px', 'bold', 'white', '0px', 400, 120)
      addText(this.$strings.StatsBooksListenedTo, '20px', 'normal', tanColor, '0px', 400, 155, twoColumnWidth)
      addIcon('local_library', 'white', '42px', 345, 130)

      this.canvas = canvas
      this.dataUrl = canvas.toDataURL('png')
    },
    share() {
      this.canvas.toBlob((blob) => {
        const file = new File([blob], 'yearinreviewshort.png', { type: blob.type })
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
