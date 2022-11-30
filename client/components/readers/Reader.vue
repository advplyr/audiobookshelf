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
    return {}
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
      return this.mediaMetadata.title
    },
    abAuthor() {
      return this.mediaMetadata.authorName
    },
    selectedLibraryItem() {
      return this.$store.state.selectedLibraryItem || {}
    },
    media() {
      return this.selectedLibraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    libraryId() {
      return this.selectedLibraryItem.libraryId
    },
    folderId() {
      return this.selectedLibraryItem.folderId
    },
    ebookFile() {
      return this.media.ebookFile
    },
    ebookFormat() {
      if (!this.ebookFile) return null
      return this.ebookFile.ebookFormat
    },
    ebookType() {
      if (this.isMobi) return 'mobi'
      else if (this.isEpub) return 'epub'
      else if (this.isPdf) return 'pdf'
      else if (this.isComic) return 'comic'
      return null
    },
    isEpub() {
      return this.ebookFormat == 'epub'
    },
    isMobi() {
      return this.ebookFormat == 'mobi' || this.ebookFormat == 'azw3'
    },
    isPdf() {
      return this.ebookFormat == 'pdf'
    },
    isComic() {
      return this.ebookFormat == 'cbz' || this.ebookFormat == 'cbr'
    },
    ebookUrl() {
      if (!this.ebookFile) return null
      let filepath = ''
      if (this.selectedLibraryItem.isFile) {
        filepath = this.$encodeUriPath(this.ebookFile.metadata.filename)
      } else {
        const itemRelPath = this.selectedLibraryItem.relPath
        if (itemRelPath.startsWith('/')) itemRelPath = itemRelPath.slice(1)
        const relPath = this.ebookFile.metadata.relPath
        if (relPath.startsWith('/')) relPath = relPath.slice(1)

        filepath = this.$encodeUriPath(`${itemRelPath}/${relPath}`)
      }
      return `/ebook/${this.libraryId}/${this.folderId}/${filepath}`
    },
    userToken() {
      return this.$store.getters['user/getToken']
    }
  },
  methods: {
    hotkey(action) {
      console.log('Reader hotkey', action)
      if (!this.$refs.readerComponent) return

      if (action === this.$hotkeys.EReader.NEXT_PAGE) {
        if (this.$refs.readerComponent.next) this.$refs.readerComponent.next()
      } else if (action === this.$hotkeys.EReader.PREV_PAGE) {
        if (this.$refs.readerComponent.prev) this.$refs.readerComponent.prev()
      } else if (action === this.$hotkeys.EReader.CLOSE) {
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