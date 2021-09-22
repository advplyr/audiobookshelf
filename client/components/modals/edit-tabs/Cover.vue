<template>
  <div class="w-full h-full overflow-hidden overflow-y-auto px-4 py-6 relative">
    <div class="flex">
      <div class="relative">
        <cards-book-cover :audiobook="audiobook" />
        <!-- book cover overlay -->
        <div v-if="book.cover" class="absolute top-0 left-0 w-full h-full z-10 opacity-0 hover:opacity-100 transition-opacity duration-100">
          <div class="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-black-600 to-transparent" />
          <div class="p-1 absolute top-1 right-1 text-red-500 rounded-full w-8 h-8 cursor-pointer hover:text-red-400 shadow-sm" @click="removeCover">
            <span class="material-icons">delete</span>
          </div>
        </div>
      </div>
      <div class="flex-grow pl-6 pr-2">
        <div class="flex items-center">
          <div v-if="userCanUpload" class="w-40 pr-2" style="min-width: 160px">
            <ui-file-input ref="fileInput" @change="fileUploadSelected" />
          </div>
          <form @submit.prevent="submitForm" class="flex flex-grow">
            <ui-text-input-with-label v-model="imageUrl" label="Cover Image URL" />
            <ui-btn color="success" type="submit" :padding-x="4" class="mt-5 ml-3 w-24">Update</ui-btn>
          </form>
        </div>

        <div v-if="localCovers.length" class="mb-4 mt-6 border-t border-b border-primary">
          <div class="flex items-center justify-center py-2">
            <p>{{ localCovers.length }} local image(s)</p>
            <div class="flex-grow" />
            <ui-btn small @click="showLocalCovers = !showLocalCovers">{{ showLocalCovers ? 'Hide' : 'Show' }}</ui-btn>
          </div>

          <div v-if="showLocalCovers" class="flex items-center justify-center">
            <template v-for="cover in localCovers">
              <div :key="cover.path" class="m-0.5 border-2 border-transparent hover:border-yellow-300 cursor-pointer" :class="cover.localPath === imageUrl ? 'border-yellow-300' : ''" @click="setCover(cover.localPath)">
                <div class="h-24 bg-primary" style="width: 60px">
                  <img :src="cover.localPath" class="h-full w-full object-contain" />
                </div>
              </div>
            </template>
          </div>
        </div>

        <form @submit.prevent="submitSearchForm">
          <div class="flex items-center justify-start -mx-1 py-2 mt-2">
            <div class="flex-grow px-1">
              <ui-text-input-with-label v-model="searchTitle" label="Search Title" placeholder="Search" :disabled="processing" />
            </div>
            <div class="flex-grow px-1">
              <ui-text-input-with-label v-model="searchAuthor" label="Author" :disabled="processing" />
            </div>
            <div class="w-24 px-1">
              <ui-btn type="submit" class="mt-5 w-full" :padding-x="0">Search</ui-btn>
            </div>
          </div>
        </form>
        <div v-if="hasSearched" class="flex items-center flex-wrap justify-center max-h-60 overflow-y-scroll mt-2 max-w-full">
          <p v-if="!coversFound.length">No Covers Found</p>
          <template v-for="cover in coversFound">
            <div :key="cover" class="m-0.5 border-2 border-transparent hover:border-yellow-300 cursor-pointer" :class="cover === imageUrl ? 'border-yellow-300' : ''" @click="setCover(cover)">
              <div class="h-24 bg-primary" style="width: 60px">
                <img :src="cover" class="h-full w-full object-contain" />
              </div>
              <!-- <img :src="cover" class="h-24 object-cover" style="width: 60px" /> -->
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="previewUpload" class="absolute top-0 left-0 w-full h-full z-10 bg-bg p-8">
      <p class="text-lg">Preview Cover</p>
      <span class="absolute top-4 right-4 material-icons text-2xl cursor-pointer" @click="resetCoverPreview">close</span>
      <div class="flex justify-center py-4">
        <cards-preview-cover :src="previewUpload" :width="240" />
      </div>
      <div class="absolute bottom-0 right-0 flex py-4 px-5">
        <ui-btn :disabled="processingUpload" class="mx-2" @click="resetCoverPreview">Clear</ui-btn>
        <ui-btn :loading="processingUpload" color="success" @click="submitCoverUpload">Upload</ui-btn>
      </div>
    </div>
  </div>
</template>

<script>
import Path from 'path'

export default {
  props: {
    processing: Boolean,
    audiobook: {
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
      selectedFile: null
    }
  },
  watch: {
    audiobook: {
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
    book() {
      return this.audiobook ? this.audiobook.book || {} : {}
    },
    otherFiles() {
      return this.audiobook ? this.audiobook.otherFiles || [] : []
    },
    userCanUpload() {
      return this.$store.getters['user/getUserCanUpload']
    },
    localCovers() {
      return this.otherFiles
        .filter((f) => f.filetype === 'image')
        .map((file) => {
          var _file = { ...file }
          _file.localPath = Path.join('local', _file.path)
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
        .$post(`/api/audiobook/${this.audiobook.id}/cover`, form)
        .then((data) => {
          if (data.error) {
            this.$toast.error(data.error)
          } else {
            this.$toast.success('Cover Uploaded')
            this.resetCoverPreview()
          }
          this.processingUpload = false
        })
        .catch((error) => {
          console.error('Failed', error)
          this.$toast.error('Oops, something went wrong...')
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
      if (this.coversFound.length && (this.searchTitle !== this.book.title || this.searchAuthor !== this.book.author)) {
        this.coversFound = []
        this.hasSearched = false
      }
      this.imageUrl = this.book.cover || ''
      this.searchTitle = this.book.title || ''
      this.searchAuthor = this.book.author || ''
    },
    removeCover() {
      if (!this.book.cover) {
        this.imageUrl = ''
        return
      }
      this.updateCover('')
    },
    submitForm() {
      this.updateCover(this.imageUrl)
    },
    async updateCover(cover) {
      if (cover === this.book.cover) {
        console.warn('Cover has not changed..', cover)
        return
      }

      this.isProcessing = true
      const updatePayload = {
        book: {
          cover: cover
        }
      }
      var updatedAudiobook = await this.$axios.$patch(`/api/audiobook/${this.audiobook.id}`, updatePayload).catch((error) => {
        console.error('Failed to update', error)
        return false
      })
      this.isProcessing = false
      if (updatedAudiobook) {
        this.$toast.success('Update Successful')
        this.$emit('close')
      }
    },
    getSearchQuery() {
      var searchQuery = `provider=openlibrary&title=${this.searchTitle}`
      if (this.searchAuthor) searchQuery += `&author=${this.searchAuthor}`
      return searchQuery
    },
    async submitSearchForm() {
      this.isProcessing = true
      var searchQuery = this.getSearchQuery()
      var results = await this.$axios.$get(`/api/find/covers?${searchQuery}`).catch((error) => {
        console.error('Failed', error)
        return []
      })
      this.coversFound = results
      this.isProcessing = false
      this.hasSearched = true
    },
    setCover(cover) {
      this.updateCover(cover)
    }
  }
}
</script>