<template>
  <div v-if="show" id="reader" :data-theme="ereaderTheme" class="group absolute top-0 left-0 w-full z-60 data-[theme=dark]:bg-primary data-[theme=dark]:text-white data-[theme=light]:bg-white data-[theme=light]:text-black" :class="{ 'reader-player-open': !!streamLibraryItem }">
    <div class="absolute top-4 left-4 z-20 flex items-center">
      <button v-if="isEpub" @click="toggleToC" type="button" aria-label="Table of contents menu" class="inline-flex opacity-80 hover:opacity-100">
        <span class="material-symbols text-2xl">menu</span>
      </button>
      <button v-if="hasSettings" @click="openSettings" type="button" aria-label="Ereader settings" class="mx-4 inline-flex opacity-80 hover:opacity-100">
        <span class="material-symbols text-1.5xl">settings</span>
      </button>
    </div>

    <div class="absolute top-4 left-1/2 transform -translate-x-1/2">
      <h1 :data-type="ebookType" class="text-lg sm:text-xl md:text-2xl mb-1 data-[type=comic]:hidden" style="line-height: 1.15; font-weight: 100">
        <span style="font-weight: 600">{{ abTitle }}</span>
        <span v-if="abAuthor" class="hidden md:inline"> – </span>
        <span v-if="abAuthor" class="hidden md:inline">{{ abAuthor }}</span>
      </h1>
    </div>

    <div class="absolute top-4 right-4 z-20">
      <button @click="close" type="button" aria-label="Close ereader" class="inline-flex opacity-80 hover:opacity-100">
        <span class="material-symbols text-2xl">close</span>
      </button>
    </div>

    <component v-if="componentName" ref="readerComponent" :is="componentName" :library-item="selectedLibraryItem" :player-open="!!streamLibraryItem" :keep-progress="keepProgress" :file-id="ebookFileId" @touchstart="touchstart" @touchend="touchend" @hook:mounted="readerMounted" />

    <!-- TOC side nav -->
    <div v-if="tocOpen" class="w-full h-full overflow-y-scroll absolute inset-0 bg-black/20 z-20" @click.stop.prevent="toggleToC"></div>
    <div v-if="isEpub" class="w-96 h-full max-h-full absolute top-0 left-0 shadow-xl transition-transform z-30 group-data-[theme=dark]:bg-primary group-data-[theme=dark]:text-white group-data-[theme=light]:bg-white group-data-[theme=light]:text-black" :class="tocOpen ? 'translate-x-0' : '-translate-x-96'" @click.stop.prevent>
      <div class="flex flex-col p-4 h-full">
        <div class="flex items-center mb-2">
          <button @click.stop.prevent="toggleToC" type="button" aria-label="Close table of contents" class="inline-flex opacity-80 hover:opacity-100">
            <span class="material-symbols text-2xl">arrow_back</span>
          </button>

          <p class="text-lg font-semibold ml-2">{{ $strings.HeaderTableOfContents }}</p>
        </div>
        <form @submit.prevent="searchBook" @click.stop.prevent>
          <ui-text-input clearable ref="input" @clear="searchBook" v-model="searchQuery" :placeholder="$strings.PlaceholderSearch" class="h-8 w-full text-sm flex mb-2" />
        </form>

        <div class="overflow-y-auto">
          <div v-if="isSearching && !this.searchResults.length" class="w-full h-40 justify-center">
            <p class="text-center text-xl py-4">{{ $strings.MessageNoResults }}</p>
          </div>

          <ul>
            <li v-for="chapter in isSearching ? this.searchResults : chapters" :key="chapter.id" class="py-1">
              <a :href="chapter.href" class="opacity-80 hover:opacity-100" @click.prevent="goToChapter(chapter.href)">{{ chapter.title }}</a>
              <div v-for="searchResults in chapter.searchResults" :key="searchResults.cfi" class="text-sm py-1 pl-4">
                <a :href="searchResults.cfi" class="opacity-50 hover:opacity-100" @click.prevent="goToChapter(searchResults.cfi)">{{ searchResults.excerpt }}</a>
              </div>

              <ul v-if="chapter.subitems.length">
                <li v-for="subchapter in chapter.subitems" :key="subchapter.id" class="py-1 pl-4">
                  <a :href="subchapter.href" class="opacity-80 hover:opacity-100" @click.prevent="goToChapter(subchapter.href)">{{ subchapter.title }}</a>
                  <div v-for="subChapterSearchResults in subchapter.searchResults" :key="subChapterSearchResults.cfi" class="text-sm py-1 pl-4">
                    <a :href="subChapterSearchResults.cfi" class="opacity-50 hover:opacity-100" @click.prevent="goToChapter(subChapterSearchResults.cfi)">{{ subChapterSearchResults.excerpt }}</a>
                  </div>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ereader settings modal -->
    <modals-modal v-model="showSettings" name="ereader-settings-modal" :width="500" :height="'unset'" :processing="false">
      <template #outer>
        <div class="absolute top-0 left-0 p-5 w-3/4 overflow-hidden">
          <p class="text-xl md:text-3xl text-white truncate">{{ $strings.HeaderEreaderSettings }}</p>
        </div>
      </template>
      <div class="px-2 py-4 md:p-8 w-full text-base rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-x-hidden overflow-y-auto" style="max-height: 80vh">
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">{{ $strings.LabelTheme }}:</p>
          </div>
          <ui-toggle-btns v-model="ereaderSettings.theme" :items="themeItems.theme" @input="settingsUpdated" />
        </div>
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">{{ $strings.LabelFontFamily }}:</p>
          </div>
          <ui-toggle-btns v-model="ereaderSettings.font" :items="themeItems.font" @input="settingsUpdated" />
        </div>
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">{{ $strings.LabelFontScale }}:</p>
          </div>
          <ui-range-input v-model="ereaderSettings.fontScale" :min="5" :max="300" :step="5" @input="settingsUpdated" />
        </div>
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">{{ $strings.LabelLineSpacing }}:</p>
          </div>
          <ui-range-input v-model="ereaderSettings.lineSpacing" :min="100" :max="300" :step="5" @input="settingsUpdated" />
        </div>
        <div class="flex items-center mb-4">
          <div class="w-40">
            <p class="text-lg">{{ $strings.LabelFontBoldness }}:</p>
          </div>
          <ui-range-input v-model="ereaderSettings.textStroke" :min="0" :max="300" :step="5" @input="settingsUpdated" />
        </div>
        <div class="flex items-center">
          <div class="w-40">
            <p class="text-lg">{{ $strings.LabelLayout }}:</p>
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
      touchstartX: 0,
      touchstartY: 0,
      touchendX: 0,
      touchendY: 0,
      touchstartTime: 0,
      touchIdentifier: null,
      chapters: [],
      isSearching: false,
      searchResults: [],
      searchQuery: '',
      tocOpen: false,
      showSettings: false,
      ereaderSettings: {
        theme: 'dark',
        font: 'serif',
        fontScale: 100,
        lineSpacing: 115,
        fontBoldness: 100,
        spread: 'auto',
        textStroke: 0
      }
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
    ereaderTheme() {
      if (this.isEpub) return this.ereaderSettings.theme
      return 'dark'
    },
    spreadItems() {
      return [
        {
          text: this.$strings.LabelLayoutSinglePage,
          value: 'none'
        },
        {
          text: this.$strings.LabelLayoutSplitPage,
          value: 'auto'
        }
      ]
    },
    themeItems() {
      return {
        theme: [
          {
            text: this.$strings.LabelThemeDark,
            value: 'dark'
          },
          {
            text: this.$strings.LabelThemeLight,
            value: 'light'
          }
        ],
        font: [
          {
            text: 'Sans',
            value: 'sans-serif'
          },
          {
            text: 'Serif',
            value: 'serif'
          }
        ]
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
    goToChapter(uri) {
      this.toggleToC()
      this.$refs.readerComponent.goToChapter(uri)
    },
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
    async searchBook() {
      if (this.searchQuery.length > 1) {
        this.searchResults = await this.$refs.readerComponent.searchBook(this.searchQuery)
        this.isSearching = true
      } else {
        this.isSearching = false
        this.searchResults = []
      }
    },
    next() {
      if (this.$refs.readerComponent?.next) this.$refs.readerComponent.next()
    },
    prev() {
      if (this.$refs.readerComponent?.prev) this.$refs.readerComponent.prev()
    },
    handleGesture() {
      // Touch must be less than 1s. Must be > 60px drag and X distance > Y distance
      const touchTimeMs = Date.now() - this.touchstartTime
      if (touchTimeMs >= 1000) {
        console.log('Touch too long', touchTimeMs)
        return
      }

      const touchDistanceX = Math.abs(this.touchendX - this.touchstartX)
      const touchDistanceY = Math.abs(this.touchendY - this.touchstartY)
      const touchDistance = Math.sqrt(Math.pow(this.touchstartX - this.touchendX, 2) + Math.pow(this.touchstartY - this.touchendY, 2))
      if (touchDistance < 60) {
        return
      }

      if (touchDistanceX < 60 || touchDistanceY > touchDistanceX) {
        return
      }

      if (this.touchendX < this.touchstartX) {
        this.next()
      }
      if (this.touchendX > this.touchstartX) {
        this.prev()
      }
    },
    touchstart(e) {
      // Ignore rapid touch
      if (this.touchstartTime && Date.now() - this.touchstartTime < 250) {
        return
      }

      this.touchstartX = e.touches[0].screenX
      this.touchstartY = e.touches[0].screenY
      this.touchstartTime = Date.now()
      this.touchIdentifier = e.touches[0].identifier
    },
    touchend(e) {
      if (this.touchIdentifier !== e.changedTouches[0].identifier) {
        return
      }

      this.touchendX = e.changedTouches[0].screenX
      this.touchendY = e.changedTouches[0].screenY
      this.handleGesture()
    },
    registerListeners() {
      this.$eventBus.$on('reader-hotkey', this.hotkey)
      document.body.addEventListener('touchstart', this.touchstart)
      document.body.addEventListener('touchend', this.touchend)
    },
    unregisterListeners() {
      this.$eventBus.$off('reader-hotkey', this.hotkey)
      document.body.removeEventListener('touchstart', this.touchstart)
      document.body.removeEventListener('touchend', this.touchend)
    },
    loadEreaderSettings() {
      try {
        const settings = localStorage.getItem('ereaderSettings')
        if (settings) {
          const _ereaderSettings = JSON.parse(settings)
          for (const key in this.ereaderSettings) {
            if (_ereaderSettings[key] !== undefined) {
              this.ereaderSettings[key] = _ereaderSettings[key]
            }
          }
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
      this.isSearching = false
      this.searchQuery = ''
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
