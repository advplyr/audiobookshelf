<template>
  <div v-if="show" id="reader" class="absolute top-0 left-0 w-full z-60 bg-primary text-white" :class="{ 'reader-player-open': !!streamLibraryItem }">
    <div class="absolute top-4 left-4 z-20">
      <span v-if="hasToC && !tocOpen" ref="tocButton" class="material-icons cursor-pointer text-2xl" @click="toggleToC">menu</span>
    </div>

    <div class="absolute top-4 left-1/2 transform -translate-x-1/2">
      <h1 class="text-lg sm:text-xl md:text-2xl mb-1" style="line-height: 1.15; font-weight: 100">
        <span style="font-weight: 600">{{ abTitle }}</span>
        <span v-if="abAuthor" style="display: inline"> – </span>
        <span v-if="abAuthor">{{ abAuthor }}</span>
      </h1>
    </div>

    <div class="absolute top-4 right-4 z-20">
      <span v-if="hasSettings" class="material-icons cursor-pointer text-2xl" @click="openSettings">settings</span>
      <span class="material-icons cursor-pointer text-2xl" @click="close">close</span>
    </div>

    <component v-if="componentName" ref="readerComponent" :is="componentName" :library-item="selectedLibraryItem" :player-open="!!streamLibraryItem" />

    <!-- TOC side nav -->
    <div v-if="tocOpen" class="w-full h-full fixed inset-0 bg-black/20 z-20" @click.stop.prevent="toggleToC"></div>
    <div v-if="hasToC" class="w-96 h-full max-h-full absolute top-0 left-0 bg-bg shadow-xl transition-transform z-30" :class="tocOpen ? 'translate-x-0' : '-translate-x-96'" @click.stop.prevent="toggleToC">
      <div class="p-4 h-full">
        <p class="text-lg font-semibold mb-2">Table of Contents</p>
        <div class="tocContent">
          <ul>
            <li v-for="chapter in chapters" :key="chapter.id" class="py-1">
              <a :href="chapter.href" class="text-white/70 hover:text-white" @click.prevent="$refs.readerComponent.goToChapter(chapter.href)">{{ chapter.label }}</a>
              <ul v-if="chapter.subitems.length">
                <li v-for="subchapter in chapter.subitems" :key="subchapter.id" class="py-1 pl-4">
                  <a :href="subchapter.href" class="text-white/70 hover:text-white" @click.prevent="$refs.readerComponent.goToChapter(subchapter.href)">{{ subchapter.label }}</a>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      chapters: [],
      tocOpen: false
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
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    hasToC() {
      return this.isEpub
    },
    hasSettings() {
      return false
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
    userToken() {
      return this.$store.getters['user/getToken']
    }
  },
  methods: {
    toggleToC() {
      this.tocOpen = !this.tocOpen
      this.chapters = this.$refs.readerComponent.chapters
    },
    openSettings() {},
    hotkey(action) {
      if (!this.$refs.readerComponent) return

      if (action === this.$hotkeys.EReader.NEXT_PAGE) {
        this.next()
      } else if (action === this.$hotkeys.EReader.PREV_PAGE) {
        this.prev()
      } else if (action === this.$hotkeys.EReader.CLOSE) {
        this.close()
      }
    },
    next() {
      if (this.$refs.readerComponent?.next) this.$refs.readerComponent.next()
    },
    prev() {
      if (this.$refs.readerComponent?.prev) this.$refs.readerComponent.prev()
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
.tocContent {
  height: calc(100% - 36px);
  overflow-y: auto;
}
#reader {
  height: 100%;
}
#reader.reader-player-open {
  height: calc(100% - 164px);
}
@media (max-height: 400px) {
  #reader.reader-player-open {
    height: 100%;
  }
}
</style>