<template>
  <div>
    <div v-if="processing" class="w-[400px] h-[400px] flex items-center justify-center">
      <widgets-loading-spinner />
    </div>
    <img v-else-if="dataUrl" :src="dataUrl" />
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean
  },
  data() {
    return {
      dataUrl: null,
      year: null,
      yearStats: null
    }
  },
  methods: {
    async initCanvas() {
      if (!this.yearStats) return

      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      const ctx = canvas.getContext('2d')

      const createRoundedRect = (x, y, w, h) => {
        ctx.fillStyle = '#37383866'
        ctx.strokeStyle = '#C0C0C0aa'
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, [20])
        ctx.fill()
        ctx.stroke()
      }

      const addText = (text, fontSize, fontWeight, color, letterSpacing, x, y) => {
        ctx.fillStyle = color
        ctx.font = `${fontWeight} ${fontSize} Source Sans Pro`
        ctx.letterSpacing = letterSpacing
        ctx.fillText(text, x, y)
      }

      const addIcon = (icon, color, fontSize, x, y) => {
        ctx.fillStyle = color
        ctx.font = `${fontSize} Material Icons Outlined`
        ctx.fillText(icon, x, y)
      }

      // Bg color
      ctx.fillStyle = '#232323'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Cover image tiles
      if (this.yearStats.booksWithCovers.length) {
        let index = 0
        ctx.globalAlpha = 0.25
        for (let x = 0; x < 4; x++) {
          for (let y = 0; y < 4; y++) {
            const coverIndex = index % this.yearStats.booksWithCovers.length
            let libraryItemId = this.yearStats.booksWithCovers[coverIndex]
            index++

            await new Promise((resolve) => {
              const img = new Image()
              img.crossOrigin = 'anonymous'
              img.addEventListener('load', () => {
                ctx.drawImage(img, 100 * x, 100 * y, 100, 100)
                resolve()
              })
              img.addEventListener('error', () => {
                resolve()
              })
              img.src = this.$store.getters['globals/getLibraryItemCoverSrcById'](libraryItemId)
            })
          }
        }
      }

      ctx.globalAlpha = 1
      ctx.textBaseline = 'middle'

      // Create gradient
      const grd1 = ctx.createLinearGradient(0, 0, 400, 400)
      grd1.addColorStop(0, '#000000aa')
      grd1.addColorStop(1, '#cd9d49aa')
      ctx.fillStyle = grd1
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Top Abs icon
      let tanColor = '#ffdb70'
      ctx.fillStyle = tanColor
      ctx.font = '32px absicons'
      ctx.fillText('\ue900', 15, 32)

      // Top text
      addText('audiobookshelf', '22px', 'normal', tanColor, '0px', 55, 22)
      addText(`${this.year} YEAR IN REVIEW`, '14px', 'bold', 'white', '1px', 55, 44)

      // Top left box
      createRoundedRect(10, 65, 185, 80)
      addText(this.yearStats.numBooksFinished, '32px', 'bold', 'white', '0px', 63, 98)
      addText('books finished', '14px', 'normal', tanColor, '0px', 63, 120)
      const readIconPath = new Path2D()
      readIconPath.addPath(new Path2D('M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-9 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z'), { a: 1.2, d: 1.2, e: 26, f: 90 })
      ctx.fillStyle = '#ffffff'
      ctx.fill(readIconPath)

      // Box top right
      createRoundedRect(205, 65, 185, 80)
      addText(this.$elapsedPrettyExtended(this.yearStats.totalListeningTime, true, false), '20px', 'bold', 'white', '0px', 257, 96)
      addText('spent listening', '14px', 'normal', tanColor, '0px', 257, 117)
      addIcon('watch_later', 'white', '32px', 218, 105)

      // Box bottom left
      createRoundedRect(10, 155, 185, 80)
      addText(this.yearStats.totalListeningSessions, '32px', 'bold', 'white', '0px', 65, 188)
      addText('sessions', '14px', 'normal', tanColor, '1px', 65, 210)
      addIcon('headphones', 'white', '32px', 25, 195)

      // Box bottom right
      createRoundedRect(205, 155, 185, 80)
      addText(this.yearStats.numBooksListened, '32px', 'bold', 'white', '0px', 258, 188)
      addText('books listened to', '14px', 'normal', tanColor, '0.65px', 258, 210)
      addIcon('local_library', 'white', '32px', 220, 195)

      // Text stats
      const topNarrator = this.yearStats.mostListenedNarrator
      if (topNarrator) {
        addText('TOP NARRATOR', '12px', 'normal', tanColor, '1px', 20, 260)
        addText(topNarrator.name, '18px', 'bolder', 'white', '0px', 20, 282)
        addText(this.$elapsedPrettyExtended(topNarrator.time, true, false), '14px', 'lighter', 'white', '1px', 20, 302)
      }

      const topGenre = this.yearStats.topGenres[0]
      if (topGenre) {
        addText('TOP GENRE', '12px', 'normal', tanColor, '1px', 215, 260)
        addText(topGenre.genre, '18px', 'bolder', 'white', '0px', 215, 282)
        addText(this.$elapsedPrettyExtended(topGenre.time, true, false), '14px', 'lighter', 'white', '1px', 215, 302)
      }

      const topAuthor = this.yearStats.topAuthors[0]
      if (topAuthor) {
        addText('TOP AUTHOR', '12px', 'normal', tanColor, '1px', 20, 335)
        addText(topAuthor.name, '18px', 'bolder', 'white', '0px', 20, 357)
        addText(this.$elapsedPrettyExtended(topAuthor.time, true, false), '14px', 'lighter', 'white', '1px', 20, 377)
      }

      this.dataUrl = canvas.toDataURL('png')
    },
    refresh() {
      this.init()
    },
    async init() {
      this.$emit('update:processing', true)
      let year = new Date().getFullYear()
      if (new Date().getMonth() < 11) year--
      this.year = year
      this.yearStats = await this.$axios.$get(`/api/me/year/${year}/stats`).catch((err) => {
        console.error('Failed to load stats for year', err)
        this.$toast.error('Failed to load year stats')
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