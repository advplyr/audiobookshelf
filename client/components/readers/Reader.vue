<template>
  <div v-if="show" class="w-screen h-screen fixed top-0 left-0 z-50 bg-primary text-white">
    <div class="absolute top-4 right-4 z-20">
      <span class="material-icons cursor-pointer text-4xl" @click="show = false">close</span>
    </div>

    <div class="absolute top-4 left-4 font-book">
      <h1 class="text-2xl mb-1">{{ abTitle }}</h1>
      <p v-if="abAuthor">by {{ abAuthor }}</p>
    </div>

    <component v-if="componentName" ref="readerComponent" :is="componentName" :url="ebookUrl" />

    <div class="absolute bottom-2 left-2">{{ ebookType }}</div>
  </div>
</template>

<script>
export default {
  data() {
    return {
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
    componentName() {
      if (this.ebookType === 'epub') return 'readers-epub-reader'
      else if (this.ebookType === 'mobi') return 'readers-mobi-reader'
      else if (this.ebookType === 'pdf') return 'readers-pdf-reader'
      else if (this.ebookType === 'comic') return 'readers-comic-reader'
      return null
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
    keyUp(e) {
      if (!this.$refs.readerComponent) {
        return
      }
      if ((e.keyCode || e.which) == 37) {
        if (this.$refs.readerComponent.prev) {
          this.$refs.readerComponent.prev()
        }
      } else if ((e.keyCode || e.which) == 39) {
        if (this.$refs.readerComponent.next) {
          this.$refs.readerComponent.next()
        }
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
      this.registerListeners()

      if (this.selectedAudiobookFile) {
        this.ebookUrl = this.getEbookUrl(this.selectedAudiobookFile.path)
        if (this.selectedAudiobookFile.ext === '.pdf') {
          this.ebookType = 'pdf'
        } else if (this.selectedAudiobookFile.ext === '.mobi' || this.selectedAudiobookFile.ext === '.azw3') {
          this.ebookType = 'mobi'
          // this.initMobi()
        } else if (this.selectedAudiobookFile.ext === '.epub') {
          this.ebookType = 'epub'
          // this.initEpub()
        } else if (this.selectedAudiobookFile.ext === '.cbr' || this.selectedAudiobookFile.ext === '.cbz') {
          this.ebookType = 'comic'
        }
      } else if (this.epubEbook) {
        this.ebookType = 'epub'
        this.ebookUrl = this.getEbookUrl(this.epubEbook.path)
        // this.initEpub()
      } else if (this.mobiEbook) {
        this.ebookType = 'mobi'
        this.ebookUrl = this.getEbookUrl(this.mobiEbook.path)
        // this.initMobi()
      } else if (this.pdfEbook) {
        this.ebookType = 'pdf'
        this.ebookUrl = this.getEbookUrl(this.pdfEbook.path)
      } else if (this.comicEbook) {
        this.ebookType = 'comic'
        this.ebookUrl = this.getEbookUrl(this.comicEbook.path)
      }
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