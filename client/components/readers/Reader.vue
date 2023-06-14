<template>
  <div v-if="show" id="reader" :data-theme="ereaderSettings.theme" class="group absolute top-0 left-0 w-full z-60 data-[theme=dark]:bg-primary data-[theme=dark]:text-white data-[theme=light]:bg-white data-[theme=light]:text-black" :class="{ 'reader-player-open': !!streamLibraryItem }">
    <div class="absolute top-4 left-4 z-20 flex items-center">
      <button v-if="isEpub" @click="toggleToC" type="button" aria-label="Table of contents menu" class="inline-flex opacity-80 hover:opacity-100">
        <span class="material-icons text-2xl">menu</span>
      </button>
      <button v-if="hasSettings" @click="openSettings" type="button" aria-label="Ereader settings" class="mx-4 inline-flex opacity-80 hover:opacity-100">
        <span class="material-icons text-1.5xl">settings</span>
      </button>
    </div>

    <div class="absolute top-4 left-1/2 transform -translate-x-1/2">
      <h1 class="text-lg sm:text-xl md:text-2xl mb-1" style="line-height: 1.15; font-weight: 100">
        <span style="font-weight: 600">{{ abTitle }}</span>
        <span v-if="abAuthor" style="display: inline"> – </span>
        <span v-if="abAuthor">{{ abAuthor }}</span>
      </h1>
    </div>

    <div class="absolute top-4 right-4 z-20">
      <button @click="close" type="button" aria-label="Close ereader" class="inline-flex opacity-80 hover:opacity-100">
        <span class="material-icons text-2xl">close</span>
      </button>
    </div>

    <component v-if="componentName" ref="readerComponent" :is="componentName" :library-item="selectedLibraryItem" :player-open="!!streamLibraryItem" :keep-progress="keepProgress" :file-id="ebookFileId" @hook:mounted="readerMounted" />

    <!-- TOC side nav -->
    <div v-if="tocOpen" class="w-full h-full fixed inset-0 bg-black/20 z-20" @click.stop.prevent="toggleToC"></div>
    <div v-if="isEpub" class="w-96 h-full max-h-full absolute top-0 left-0 shadow-xl transition-transform z-30 group-data-[theme=dark]:bg-primary group-data-[theme=dark]:text-white group-data-[theme=light]:bg-white group-data-[theme=light]:text-black" :class="tocOpen ? 'translate-x-0' : '-translate-x-96'" @click.stop.prevent="toggleToC">
      <div class="p-4 h-full">
        <div class="flex items-center mb-2">
          <button @click.stop.prevent="toggleToC" type="button" aria-label="Close table of contents" class="inline-flex opacity-80 hover:opacity-100">
            <span class="material-icons text-2xl">arrow_back</span>
          </button>

          <p class="text-lg font-semibold ml-2">Table of Contents</p>
        </div>
        <div class="tocContent">
          <ul>
            <li v-for="chapter in chapters" :key="chapter.id" class="py-1">
              <a :href="chapter.href" class="opacity-80 hover:opacity-100" @click.prevent="$refs.readerComponent.goToChapter(chapter.href)">{{ chapter.label }}</a>
              <ul v-if="chapter.subitems.length">
                <li v-for="subchapter in chapter.subitems" :key="subchapter.id" class="py-1 pl-4">
                  <a :href="subchapter.href" class="opacity-80 hover:opacity-100" @click.prevent="$refs.readerComponent.goToChapter(subchapter.href)">{{ subchapter.label }}</a>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <modals-modal v-model="showSettings" name="ereader-settings-modal" :width="500" :height="'unset'" :processing="false">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-3/4 overflow-hidden">
          <p class="text-xl md:text-3xl text-white truncate">Ereader Settings</p>
        </div>
      </template>
      <div class="p-2 md:p-8 w-full text-base py-2 rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-x-hidden overflow-y-auto" style="max-height: 80vh">
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">Theme:</p>
          </div>
          <ui-toggle-btns v-model="ereaderSettings.theme" :items="themeItems" @input="settingsUpdated" />
        </div>
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">Font scale:</p>
          </div>
          <ui-range-input v-model="ereaderSettings.fontScale" :min="5" :max="300" :step="5" @input="settingsUpdated" />
        </div>
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">Line spacing:</p>
          </div>
          <ui-range-input v-model="ereaderSettings.lineSpacing" :min="100" :max="300" :step="5" @input="settingsUpdated" />
        </div>
        <div class="flex items-center">
          <div class="w-40">
            <p class="text-lg">Spread:</p>
          </div>
          <ui-toggle-btns v-model="ereaderSettings.spread" :items="spreadItems" @input="settingsUpdated" />
        </div>
      </div>
    </modals-modal>
  </div>
</template>

<script>
export default {
  data() {
    return {
      chapters: [],
      tocOpen: false,
      showSettings: false,
      ereaderSettings: {
        theme: 'dark',
        fontScale: 100,
        lineSpacing: 115,
        spread: 'auto'
      },
      themeItems: [
        {
          text: 'Dark',
          value: 'dark'
        },
        {
          text: 'Light',
          value: 'light'
        }
      ],
      spreadItems: [
        {
          text: 'Single page',
          value: 'none'
        },
        {
          text: 'Split page',
          value: 'auto'
        }
      ]
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
    hasSettings() {
      return this.isEpub
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
      // ebook file id is passed when reading a supplementary ebook
      if (this.ebookFileId) {
        return this.selectedLibraryItem.libraryFiles.find((lf) => lf.ino === this.ebookFileId)
      }
      return this.media.ebookFile
    },
    ebookFormat() {
      if (!this.ebookFile) return null
      // Use file extension for supplementary ebook
      if (!this.ebookFile.ebookFormat) {
        return this.ebookFile.metadata.ext.toLowerCase().slice(1)
      }
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
    },
    keepProgress() {
      return this.$store.state.ereaderKeepProgress
    },
    ebookFileId() {
      return this.$store.state.ereaderFileId
    },
    isDarkTheme() {
      return this.ereaderSettings.theme === 'dark'
    }
  },
  methods: {
    readerMounted() {
      if (this.isEpub) {
        this.loadEreaderSettings()
      }
    },
    settingsUpdated() {
      this.$refs.readerComponent?.updateSettings?.(this.ereaderSettings)
      localStorage.setItem('ereaderSettings', JSON.stringify(this.ereaderSettings))
    },
    toggleToC() {
      this.tocOpen = !this.tocOpen
      this.chapters = this.$refs.readerComponent.chapters
    },
    openSettings() {
      this.showSettings = true
    },
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
    loadEreaderSettings() {
      try {
        const settings = localStorage.getItem('ereaderSettings')
        if (settings) {
          this.ereaderSettings = JSON.parse(settings)
          this.settingsUpdated()
        }
      } catch (error) {
        console.error('Failed to load ereader settings', error)
      }
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