<template>
  <div class="w-full h-full overflow-hidden overflow-y-auto px-2 sm:px-4 py-6 relative">
    <div class="flex flex-col sm:flex-row mb-4">
      <div class="relative self-center">
        <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrcById'](libraryItemId, libraryItemUpdatedAt, true)" :width="120" :book-cover-aspect-ratio="bookCoverAspectRatio" />

        <!-- book cover overlay -->
        <div v-if="media.coverPath" class="absolute top-0 left-0 w-full h-full z-10 opacity-0 hover:opacity-100 transition-opacity duration-100">
          <div class="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-black-600 to-transparent" />
          <div v-if="userCanDelete" class="p-1 absolute top-1 right-1 text-red-500 rounded-full w-8 h-8 cursor-pointer hover:text-red-400 shadow-sm" @click="removeCover">
            <ui-tooltip direction="top" :text="$strings.LabelRemoveCover">
              <span class="material-symbols text-2xl">delete</span>
            </ui-tooltip>
          </div>
        </div>
      </div>
      <div class="flex-grow sm:pl-2 md:pl-6 sm:pr-2 mt-6 md:mt-0">
        <div class="flex items-center">
          <div v-if="userCanUpload" class="w-10 md:w-40 pr-2 md:min-w-32">
            <ui-file-input ref="fileInput" @change="fileUploadSelected">
              <span class="hidden md:inline-block">{{ $strings.ButtonUploadCover }}</span>
              <span class="material-symbols text-2xl inline-block md:!hidden">upload</span>
            </ui-file-input>
          </div>

          <form @submit.prevent="submitForm" class="flex flex-grow">
            <ui-text-input v-model="imageUrl" :placeholder="$strings.LabelImageURLFromTheWeb" class="h-9 w-full" />
            <ui-btn color="success" type="submit" :padding-x="4" :disabled="!imageUrl" class="ml-2 sm:ml-3 w-24 h-9">{{ $strings.ButtonSubmit }}</ui-btn>
          </form>
        </div>

        <div v-if="localCovers.length" class="mb-4 mt-6 border-t border-b border-white border-opacity-10">
          <div class="flex items-center justify-center py-2">
            <p>{{ localCovers.length }} local image{{ localCovers.length !== 1 ? 's' : '' }}</p>
            <div class="flex-grow" />
            <ui-btn small @click="showLocalCovers = !showLocalCovers">{{ showLocalCovers ? $strings.ButtonHide : $strings.ButtonShow }}</ui-btn>
          </div>

          <div v-if="showLocalCovers" class="flex items-center justify-center pb-2">
            <template v-for="localCoverFile in localCovers">
              <div :key="localCoverFile.ino" class="m-0.5 mb-5 border-2 border-transparent hover:border-yellow-300 cursor-pointer" :class="localCoverFile.metadata.path === coverPath ? 'border-yellow-300' : ''" @click="setCover(localCoverFile)">
                <div class="h-24 bg-primary" :style="{ width: 96 / bookCoverAspectRatio + 'px' }">
                  <covers-preview-cover :src="localCoverFile.localPath" :width="96 / bookCoverAspectRatio" :book-cover-aspect-ratio="bookCoverAspectRatio" />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
    <form @submit.prevent="submitSearchForm">
      <div class="flex flex-wrap sm:flex-nowrap items-center justify-start -mx-1">
        <div class="w-48 flex-grow p-1">
          <ui-dropdown v-model="provider" :items="providers" :label="$strings.LabelProvider" small />
        </div>
        <div class="w-72 flex-grow p-1">
          <ui-text-input-with-label v-model="searchTitle" :label="searchTitleLabel" :placeholder="$strings.PlaceholderSearch" />
        </div>
        <div v-show="provider != 'itunes' && provider != 'audiobookcovers'" class="w-72 flex-grow p-1">
          <ui-text-input-with-label v-model="searchAuthor" :label="$strings.LabelAuthor" />
        </div>
        <ui-btn class="mt-5 ml-1 md:min-w-24" :padding-x="4" type="submit">{{ $strings.ButtonSearch }}</ui-btn>
      </div>
    </form>
    <div v-if="hasSearched" class="flex items-center flex-wrap justify-center sm:max-h-80 sm:overflow-y-scroll mt-2 max-w-full">
      <p v-if="!coversFound.length">{{ $strings.MessageNoCoversFound }}</p>
      <template v-for="cover in coversFound">
        <div :key="cover" class="m-0.5 mb-5 border-2 border-transparent hover:border-yellow-300 cursor-pointer" :class="cover === coverPath ? 'border-yellow-300' : ''" @click="updateCover(cover)">
          <covers-preview-cover :src="cover" :width="80" show-open-new-tab :book-cover-aspect-ratio="bookCoverAspectRatio" />
        </div>
      </template>
    </div>

    <div v-if="previewUpload" class="absolute top-0 left-0 w-full h-full z-10 bg-bg p-8">
      <p class="text-lg">{{ $strings.HeaderPreviewCover }}</p>
      <span class="absolute top-4 right-4 material-symbols text-2xl cursor-pointer" @click="resetCoverPreview">close</span>
      <div class="flex justify-center py-4">
        <covers-preview-cover :src="previewUpload" :width="240" :book-cover-aspect-ratio="bookCoverAspectRatio" />
      </div>
      <div class="absolute bottom-0 right-0 flex py-4 px-5">
        <ui-btn :disabled="processingUpload" class="mx-2" @click="resetCoverPreview">{{ $strings.ButtonReset }}</ui-btn>
        <ui-btn :loading="processingUpload" color="success" @click="submitCoverUpload">{{ $strings.ButtonUpload }}</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    processing: Boolean,
    libraryItem: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      processingUpload: false,
      searchTitle: null,
      searchAuthor: null,
      imageUrl: null,
      coversFound: [],
      hasSearched: false,
      showLocalCovers: false,
      previewUpload: null,
      selectedFile: null,
      provider: 'google'
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.init()
        }
      }
    }
  },
  computed: {
    isProcessing: {
      get() {
        return this.processing
      },
      set(val) {
        this.$emit('update:processing', val)
      }
    },
    providers() {
      if (this.isPodcast) return this.$store.state.scanners.podcastProviders
      return [{ text: 'All', value: 'all' }, ...this.$store.state.scanners.providers, ...this.$store.state.scanners.coverOnlyProviders]
    },
    searchTitleLabel() {
      if (this.provider.startsWith('audible')) return this.$strings.LabelSearchTitleOrASIN
      else if (this.provider == 'itunes') return this.$strings.LabelSearchTerm
      return this.$strings.LabelSearchTitle
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    libraryItemId() {
      return this.libraryItem?.id || null
    },
    libraryItemUpdatedAt() {
      return this.libraryItem?.updatedAt || null
    },
    mediaType() {
      return this.libraryItem?.mediaType || null
    },
    isPodcast() {
      return this.mediaType == 'podcast'
    },
    media() {
      return this.libraryItem?.media || {}
    },
    coverPath() {
      return this.media.coverPath
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    libraryFiles() {
      return this.libraryItem?.libraryFiles || []
    },
    userCanUpload() {
      return this.$store.getters['user/getUserCanUpload']
    },
    userCanDelete() {
      return this.$store.getters['user/getUserCanDelete']
    },
    userToken() {
      return this.$store.getters['user/getToken']
    },
    localCovers() {
      return this.libraryFiles
        .filter((f) => f.fileType === 'image')
        .map((file) => {
          const _file = { ...file }
          _file.localPath = `${process.env.serverUrl}/api/items/${this.libraryItemId}/file/${file.ino}?token=${this.userToken}`
          return _file
        })
    }
  },
  methods: {
    submitCoverUpload() {
      this.processingUpload = true
      var form = new FormData()
      form.set('cover', this.selectedFile)

      this.$axios
        .$post(`/api/items/${this.libraryItemId}/cover`, form)
        .then((data) => {
          if (data.error) {
            this.$toast.error(data.error)
          } else {
            this.resetCoverPreview()
          }
          this.processingUpload = false
        })
        .catch((error) => {
          console.error('Failed', error)
          if (error.response && error.response.data) {
            this.$toast.error(error.response.data)
          } else {
            this.$toast.error(this.$strings.ToastUnknownError)
          }
          this.processingUpload = false
        })
    },
    resetCoverPreview() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.reset()
      }
      this.previewUpload = null
      this.selectedFile = null
    },
    fileUploadSelected(file) {
      this.previewUpload = URL.createObjectURL(file)
      this.selectedFile = file
    },
    init() {
      this.showLocalCovers = false
      if (this.coversFound.length && (this.searchTitle !== this.mediaMetadata.title || this.searchAuthor !== this.mediaMetadata.authorName)) {
        this.coversFound = []
        this.hasSearched = false
      }
      this.imageUrl = ''
      this.searchTitle = this.mediaMetadata.title || ''
      this.searchAuthor = this.mediaMetadata.authorName || ''
      if (this.isPodcast) this.provider = 'itunes'
      else this.provider = localStorage.getItem('book-cover-provider') || localStorage.getItem('book-provider') || 'google'
    },
    removeCover() {
      if (!this.coverPath) {
        return
      }
      this.isProcessing = true
      this.$axios
        .$delete(`/api/items/${this.libraryItemId}/cover`)
        .then(() => {})
        .catch((error) => {
          console.error('Failed to remove cover', error)
          if (error.response?.data) {
            this.$toast.error(error.response.data)
          }
        })
        .finally(() => {
          this.isProcessing = false
        })
    },
    submitForm() {
      this.updateCover(this.imageUrl)
    },
    async updateCover(cover) {
      if (!cover.startsWith('http:') && !cover.startsWith('https:')) {
        this.$toast.error(this.$strings.ToastInvalidUrl)
        return
      }

      this.isProcessing = true
      this.$axios
        .$post(`/api/items/${this.libraryItemId}/cover`, { url: cover })
        .then(() => {
          this.imageUrl = ''
        })
        .catch((error) => {
          console.error('Failed to update cover', error)
          this.$toast.error(error.response?.data || this.$strings.ToastCoverUpdateFailed)
        })
        .finally(() => {
          this.isProcessing = false
        })
    },
    getSearchQuery() {
      var searchQuery = `provider=${this.provider}&title=${this.searchTitle}`
      if (this.searchAuthor) searchQuery += `&author=${this.searchAuthor || ''}`
      if (this.isPodcast) searchQuery += '&podcast=1'
      return searchQuery
    },
    persistProvider() {
      try {
        localStorage.setItem('book-cover-provider', this.provider)
      } catch (error) {
        console.error('PersistProvider', error)
      }
    },
    async submitSearchForm() {
      // Store provider in local storage
      this.persistProvider()

      this.isProcessing = true
      const searchQuery = this.getSearchQuery()
      const results = await this.$axios
        .$get(`/api/search/covers?${searchQuery}`)
        .then((res) => res.results)
        .catch((error) => {
          console.error('Failed', error)
          return []
        })
      this.coversFound = results
      this.isProcessing = false
      this.hasSearched = true
    },
    setCover(coverFile) {
      this.isProcessing = true
      this.$axios
        .$patch(`/api/items/${this.libraryItemId}/cover`, { cover: coverFile.metadata.path })
        .catch((error) => {
          console.error('Failed to set local cover', error)
          this.$toast.error(error.response?.data || this.$strings.ToastCoverUpdateFailed)
        })
        .finally(() => {
          this.isProcessing = false
        })
    }
  }
}
</script>
