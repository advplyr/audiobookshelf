<template>
  <div v-if="show" class="w-screen h-screen fixed top-0 left-0 z-50 bg-primary text-white">
    <div class="absolute top-4 right-4 z-20">
      <span class="material-icons cursor-pointer text-4xl" @click="close">close</span>
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
    hotkey(action) {
      console.log('Reader hotkey', action)
      if (!this.$refs.readerComponent) return

      if (action === 'ArrowRight') {
        if (this.$refs.readerComponent.next) this.$refs.readerComponent.next()
      } else if (action === 'ArrowLeft') {
        if (this.$refs.readerComponent.prev) this.$refs.readerComponent.prev()
      } else if (action === 'Escape') {
        this.close()
      }
    },
    registerListeners() {
      this.$eventBus.$on('reader-hotkey', this.hotkey)
    },
    unregisterListeners() {
      this.$eventBus.$off('reader-hotkey', this.hotkey)
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
      this.unregisterListeners()
      this.show = false
    }
  },
  mounted() {
    if (this.show) this.init()
  },
  beforeDestroy() {
    this.unregisterListeners()
  }
}
</script>

<style>
/* @import url(@/assets/calibre/basic.css); */
.ebook-viewer {
  height: calc(100% - 96px);
}
</style>