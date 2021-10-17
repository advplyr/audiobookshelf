<template>
  <div v-if="show" class="w-screen h-screen fixed top-0 left-0 z-50 bg-white text-black">
    <div class="absolute top-4 right-4 z-10">
      <span class="material-icons cursor-pointer text-4xl" @click="show = false">close</span>
    </div>
    <!-- <div v-if="chapters.length" class="absolute top-0 left-0 w-52">
      <select v-model="selectedChapter" class="w-52" @change="changedChapter">
        <option v-for="chapter in chapters" :key="chapter.href" :value="chapter.href">{{ chapter.label }}</option>
      </select>
    </div> -->
    <div class="absolute top-4 left-4 font-book">
      <h1 class="text-2xl mb-1">{{ title || abTitle }}</h1>
      <p v-if="author || abAuthor">by {{ author || abAuthor }}</p>
    </div>

    <!-- EPUB -->
    <div v-if="ebookType === 'epub'" class="h-full flex items-center">
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center overflow-x-hidden">
        <span v-show="hasPrev" class="material-icons text-black text-opacity-30 hover:text-opacity-80 cursor-pointer text-8xl" @mousedown.prevent @click="pageLeft">chevron_left</span>
      </div>
      <div id="frame" class="w-full" style="height: 650px">
        <div id="viewer" class="spreads"></div>

        <div class="px-16 flex justify-center" style="height: 50px">
          <p class="px-4">{{ progress }}%</p>
        </div>
      </div>
      <div style="width: 100px; max-width: 100px" class="h-full flex items-center overflow-x-hidden">
        <span v-show="hasNext" class="material-icons text-black text-opacity-30 hover:text-opacity-80 cursor-pointer text-8xl" @mousedown.prevent @click="pageRight">chevron_right</span>
      </div>
    </div>
    <!-- MOBI/AZW3 -->
    <div v-else-if="ebookType === 'mobi'" class="h-full max-h-full w-full">
      <div class="ebook-viewer absolute overflow-y-scroll left-0 right-0 top-12 w-full max-w-4xl m-auto z-10 border border-black border-opacity-20">
        <iframe title="html-viewer" width="100%"> Loading </iframe>
      </div>
    </div>
    <!-- PDF -->
    <div v-else-if="ebookType === 'pdf'" class="h-full flex items-center">
      <app-pdf-reader :src="ebookUrl" />
    </div>
    <!-- COMIC -->
    <div v-else-if="ebookType === 'comic'" class="h-full flex items-center">
      <app-comic-reader :src="ebookUrl" @close="show = false" />
    </div>

    <div class="absolute bottom-2 left-2">{{ ebookType }}</div>
  </div>
</template>

<script>
import ePub from 'epubjs'
import MobiParser from '@/assets/ebooks/mobi.js'
import HtmlParser from '@/assets/ebooks/htmlParser.js'
import defaultCss from '@/assets/ebooks/basic.js'

export default {
  data() {
    return {
      scale: 1,
      book: null,
      rendition: null,
      chapters: [],
      title: '',
      author: '',
      progress: 0,
      hasNext: true,
      hasPrev: false,
      ebookType: '',
      ebookUrl: ''
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.init()
      } else {
        this.close()
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.showEReader
      },
      set(val) {
        this.$store.commit('setShowEReader', val)
      }
    },
    abTitle() {
      return this.selectedAudiobook.book.title
    },
    abAuthor() {
      return this.selectedAudiobook.book.author
    },
    selectedAudiobook() {
      return this.$store.state.selectedAudiobook
    },
    libraryId() {
      return this.selectedAudiobook.libraryId
    },
    folderId() {
      return this.selectedAudiobook.folderId
    },
    ebooks() {
      return this.selectedAudiobook.ebooks || []
    },
    epubEbook() {
      return this.ebooks.find((eb) => eb.ext === '.epub')
    },
    mobiEbook() {
      return this.ebooks.find((eb) => eb.ext === '.mobi' || eb.ext === '.azw3')
    },
    pdfEbook() {
      return this.ebooks.find((eb) => eb.ext === '.pdf')
    },
    comicEbook() {
      return this.ebooks.find((eb) => eb.ext === '.cbz' || eb.ext === '.cbr')
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    selectedAudiobookFile() {
      return this.$store.state.selectedAudiobookFile
    }
  },
  methods: {
    getEbookUrl(path) {
      return `/ebook/${this.libraryId}/${this.folderId}/${path}`
    },
    changedChapter() {
      if (this.rendition) {
        this.rendition.display(this.selectedChapter)
      }
    },
    pageLeft() {
      if (this.rendition) {
        this.rendition.prev()
      }
    },
    pageRight() {
      if (this.rendition) {
        this.rendition.next()
      }
    },
    keyUp(e) {
      if (!this.rendition) {
        console.error('No rendition')
        return
      }

      if ((e.keyCode || e.which) == 37) {
        this.rendition.prev()
      } else if ((e.keyCode || e.which) == 39) {
        this.rendition.next()
      } else if ((e.keyCode || e.which) == 27) {
        this.show = false
      }
    },
    registerListeners() {
      document.addEventListener('keyup', this.keyUp)
    },
    unregisterListeners() {
      document.removeEventListener('keyup', this.keyUp)
    },
    init() {
      if (this.selectedAudiobookFile) {
        this.ebookUrl = this.getEbookUrl(this.selectedAudiobookFile.path)
        if (this.selectedAudiobookFile.ext === '.pdf') {
          this.ebookType = 'pdf'
        } else if (this.selectedAudiobookFile.ext === '.mobi' || this.selectedAudiobookFile.ext === '.azw3') {
          this.ebookType = 'mobi'
          this.initMobi()
        } else if (this.selectedAudiobookFile.ext === '.epub') {
          this.ebookType = 'epub'
          this.initEpub()
        } else if (this.selectedAudiobookFile.ext === '.cbr' || this.selectedAudiobookFile.ext === '.cbz') {
          this.ebookType = 'comic'
        }
      } else if (this.epubEbook) {
        this.ebookType = 'epub'
        this.ebookUrl = this.getEbookUrl(this.epubEbook.path)
        this.initEpub()
      } else if (this.mobiEbook) {
        this.ebookType = 'mobi'
        this.ebookUrl = this.getEbookUrl(this.mobiEbook.path)
        this.initMobi()
      } else if (this.pdfEbook) {
        this.ebookType = 'pdf'
        this.ebookUrl = this.getEbookUrl(this.pdfEbook.path)
      } else if (this.comicEbook) {
        this.ebookType = 'comic'
        this.ebookUrl = this.getEbookUrl(this.comicEbook.path)
      }
    },
    addHtmlCss() {
      let iframe = document.getElementsByTagName('iframe')[0]
      if (!iframe) return
      let doc = iframe.contentDocument
      if (!doc) return
      let style = doc.createElement('style')
      style.id = 'default-style'
      style.textContent = defaultCss
      doc.head.appendChild(style)
    },
    handleIFrameHeight(iFrame) {
      const isElement = (obj) => !!(obj && obj.nodeType === 1)

      var body = iFrame.contentWindow.document.body,
        html = iFrame.contentWindow.document.documentElement
      iFrame.height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight) * 2

      setTimeout(() => {
        let lastchild = body.lastElementChild
        let lastEle = body.lastChild

        let itemAs = body.querySelectorAll('a')
        let itemPs = body.querySelectorAll('p')
        let lastItemA = itemAs[itemAs.length - 1]
        let lastItemP = itemPs[itemPs.length - 1]
        let lastItem
        if (isElement(lastItemA) && isElement(lastItemP)) {
          if (lastItemA.clientHeight + lastItemA.offsetTop > lastItemP.clientHeight + lastItemP.offsetTop) {
            lastItem = lastItemA
          } else {
            lastItem = lastItemP
          }
        }

        if (!lastchild && !lastItem && !lastEle) return
        if (lastEle.nodeType === 3 && !lastchild && !lastItem) return

        let nodeHeight = 0
        if (lastEle.nodeType === 3 && document.createRange) {
          let range = document.createRange()
          range.selectNodeContents(lastEle)
          if (range.getBoundingClientRect) {
            let rect = range.getBoundingClientRect()
            if (rect) {
              nodeHeight = rect.bottom - rect.top
            }
          }
        }
        var lastChildHeight = isElement(lastchild) ? lastchild.clientHeight + lastchild.offsetTop : 0
        var lastEleHeight = isElement(lastEle) ? lastEle.clientHeight + lastEle.offsetTop : 0
        var lastItemHeight = isElement(lastItem) ? lastItem.clientHeight + lastItem.offsetTop : 0
        iFrame.height = Math.max(lastChildHeight, lastEleHeight, lastItemHeight) + 100 + nodeHeight
      }, 500)
    },
    async initMobi() {
      // Fetch mobi file as blob
      var buff = await this.$axios.$get(this.ebookUrl, {
        responseType: 'blob'
      })
      var reader = new FileReader()
      reader.onload = async (event) => {
        var file_content = event.target.result

        let mobiFile = new MobiParser(file_content)

        let content = await mobiFile.render()
        let htmlParser = new HtmlParser(new DOMParser().parseFromString(content.outerHTML, 'text/html'))
        var anchoredDoc = htmlParser.getAnchoredDoc()

        let iFrame = document.getElementsByTagName('iframe')[0]
        iFrame.contentDocument.body.innerHTML = anchoredDoc.documentElement.outerHTML

        // Add css
        let style = iFrame.contentDocument.createElement('style')
        style.id = 'default-style'
        style.textContent = defaultCss
        iFrame.contentDocument.head.appendChild(style)

        this.handleIFrameHeight(iFrame)
      }
      reader.readAsArrayBuffer(buff)
    },
    initEpub() {
      this.registerListeners()
      // var book = ePub(this.url, {
      //   requestHeaders: {
      //     Authorization: `Bearer ${this.userToken}`
      //   }
      // })
      var book = ePub(this.ebookUrl)
      this.book = book

      this.rendition = book.renderTo('viewer', {
        width: window.innerWidth - 200,
        height: 600,
        ignoreClass: 'annotator-hl',
        manager: 'continuous',
        spread: 'always'
      })
      var displayed = this.rendition.display()

      book.ready
        .then(() => {
          console.log('Book ready')
          return book.locations.generate(1600)
        })
        .then((locations) => {
          // console.log('Loaded locations', locations)
          // Wait for book to be rendered to get current page
          displayed.then(() => {
            // Get the current CFI
            var currentLocation = this.rendition.currentLocation()
            if (!currentLocation.start) {
              console.error('No Start', currentLocation)
            } else {
              var currentPage = book.locations.percentageFromCfi(currentLocation.start.cfi)
              // console.log('current page', currentPage)
            }
          })
        })

      book.loaded.navigation.then((toc) => {
        var _chapters = []
        toc.forEach((chapter) => {
          _chapters.push(chapter)
        })
        this.chapters = _chapters
      })
      book.loaded.metadata.then((metadata) => {
        this.author = metadata.creator
        this.title = metadata.title
      })

      this.rendition.on('keyup', this.keyUp)

      this.rendition.on('relocated', (location) => {
        var percent = book.locations.percentageFromCfi(location.start.cfi)
        var percentage = Math.floor(percent * 100)
        this.progress = percentage

        this.hasNext = !location.atEnd
        this.hasPrev = !location.atStart
      })
    },
    close() {
      if (this.ebookType === 'epub') {
        this.unregisterListeners()
      }
    }
  },
  mounted() {
    if (this.show) this.init()
  },
  beforeDestroy() {
    this.close()
  }
}
</script>

<style>
/* @import url(@/assets/calibre/basic.css); */
.ebook-viewer {
  height: calc(100% - 96px);
}
</style>