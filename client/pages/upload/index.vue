<template>
  <div id="page-wrapper" class="page p-0 sm:p-6 overflow-y-auto" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="w-full max-w-6xl mx-auto">
      <!-- Library & folder picker -->
      <div class="flex my-6 -mx-2">
        <div class="w-1/5 px-2">
          <ui-dropdown v-model="selectedLibraryId" :items="libraryItems" label="Library" :disabled="!!items.length" @input="libraryChanged" />
        </div>
        <div class="w-3/5 px-2">
          <ui-dropdown v-model="selectedFolderId" :items="folderItems" :disabled="!selectedLibraryId || !!items.length" label="Folder" />
        </div>
        <div class="w-1/5 px-2">
          <ui-text-input-with-label :value="selectedLibraryMediaType" readonly label="Media Type" />
        </div>
      </div>

      <widgets-alert v-if="error" type="error">
        <p class="text-lg">{{ error }}</p>
      </widgets-alert>

      <!-- Picker display -->
      <div v-if="!items.length && !ignoredFiles.length" class="w-full mx-auto border border-white border-opacity-20 px-12 pt-12 pb-4 my-12 relative" :class="isDragging ? 'bg-primary bg-opacity-40' : 'border-dashed'">
        <p class="text-2xl text-center">{{ isDragging ? 'Drop files' : "Drag n' drop files or folders" }}</p>
        <p class="text-center text-sm my-5">or</p>
        <div class="w-full max-w-xl mx-auto">
          <div class="flex">
            <ui-btn class="w-full mx-1" @click="openFilePicker">Choose files</ui-btn>
            <ui-btn class="w-full mx-1" @click="openFolderPicker">Choose a folder</ui-btn>
          </div>
        </div>
        <div class="pt-8 text-center">
          <p class="text-xs text-white text-opacity-50 font-mono"><strong>Supported File Types: </strong>{{ inputAccept.join(', ') }}</p>
        </div>
      </div>
      <!-- Item list header -->
      <div v-else class="w-full flex items-center pb-4 border-b border-white border-opacity-10">
        <p class="text-lg">{{ items.length }} item{{ items.length === 1 ? '' : 's' }}</p>
        <p v-if="ignoredFiles.length" class="text-lg">&nbsp;|&nbsp;{{ ignoredFiles.length }} file{{ ignoredFiles.length === 1 ? '' : 's' }} ignored</p>
        <div class="flex-grow" />
        <ui-btn :disabled="processing" small @click="reset">Reset</ui-btn>
      </div>

      <!-- Alerts -->
      <widgets-alert v-if="!items.length && !uploadReady" type="error" class="my-4">
        <p class="text-lg">No items found</p>
      </widgets-alert>
      <widgets-alert v-if="ignoredFiles.length" type="warning" class="my-4">
        <div class="w-full pr-12">
          <p class="text-base mb-1">Unsupported files are ignored. When choosing or dropping a folder, other files that are not in an item folder are ignored.</p>
          <tables-uploaded-files-table :files="ignoredFiles" title="Ignored Files" class="text-white" />
          <p class="text-xs text-white text-opacity-50 font-mono pt-1"><strong>Supported File Types: </strong>{{ inputAccept.join(', ') }}</p>
        </div>
      </widgets-alert>

      <!-- Item Upload cards -->
      <template v-for="item in items">
        <cards-item-upload-card :ref="`itemCard-${item.index}`" :key="item.index" :media-type="selectedLibraryMediaType" :item="item" :processing="processing" @remove="removeItem(item)" />
      </template>

      <!-- Upload/Reset btns -->
      <div v-show="items.length" class="flex justify-end pb-8 pt-4">
        <ui-btn v-if="!uploadFinished" color="success" :loading="processing" @click="submit">Upload</ui-btn>
        <ui-btn v-else @click="reset">Reset</ui-btn>
      </div>
    </div>

    <input ref="fileInput" id="hidden-input" type="file" multiple :accept="inputAccept" class="hidden" @change="inputChanged" />
    <input ref="fileFolderInput" id="hidden-input" type="file" webkitdirectory multiple :accept="inputAccept" class="hidden" @change="inputChanged" />
  </div>
</template>

<script>
import uploadHelpers from '@/mixins/uploadHelpers'

export default {
  mixins: [uploadHelpers],
  data() {
    return {
      isDragging: false,
      error: '',
      items: [],
      ignoredFiles: [],
      selectedLibraryId: null,
      selectedFolderId: null,
      processing: false,
      uploadFinished: false
    }
  },
  watch: {
    selectedLibrary(newVal) {
      if (newVal && !this.selectedFolderId) {
        this.setDefaultFolder()
      }
    }
  },
  computed: {
    inputAccept() {
      var extensions = []
      Object.values(this.$constants.SupportedFileTypes).forEach((types) => {
        extensions = extensions.concat(types.map((t) => `.${t}`))
      })
      return extensions
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    libraries() {
      return this.$store.state.libraries.libraries
    },
    libraryItems() {
      return this.libraries.map((lib) => {
        return {
          value: lib.id,
          text: lib.name
        }
      })
    },
    selectedLibrary() {
      return this.libraries.find((lib) => lib.id === this.selectedLibraryId)
    },
    selectedLibraryMediaType() {
      return this.selectedLibrary ? this.selectedLibrary.mediaType : null
    },
    selectedLibraryIsPodcast() {
      return this.selectedLibraryMediaType === 'podcast'
    },
    selectedFolder() {
      if (!this.selectedLibrary) return null
      return this.selectedLibrary.folders.find((fold) => fold.id === this.selectedFolderId)
    },
    folderItems() {
      if (!this.selectedLibrary) return []
      return this.selectedLibrary.folders.map((fold) => {
        return {
          value: fold.id,
          text: fold.fullPath
        }
      })
    },
    uploadReady() {
      return !this.items.length && !this.ignoredFiles.length && !this.uploadFinished
    }
  },
  methods: {
    libraryChanged() {
      if (!this.selectedLibrary && this.selectedFolderId) {
        this.selectedFolderId = null
      } else if (this.selectedFolderId) {
        if (!this.selectedLibrary.folders.find((fold) => fold.id === this.selectedFolderId)) {
          this.selectedFolderId = null
        }
      }
      this.setDefaultFolder()
    },
    setDefaultFolder() {
      if (!this.selectedFolderId && this.selectedLibrary && this.selectedLibrary.folders.length) {
        this.selectedFolderId = this.selectedLibrary.folders[0].id
      }
    },
    removeItem(item) {
      this.items = this.items.filter((b) => b.index !== item.index)
      if (!this.items.length) {
        this.reset()
      }
    },
    reset() {
      this.error = ''
      this.items = []
      this.ignoredFiles = []
      this.uploadFinished = false
      if (this.$refs.fileInput) this.$refs.fileInput.value = ''
      if (this.$refs.fileFolderInput) this.$refs.fileFolderInput.value = ''
    },
    openFilePicker() {
      if (this.$refs.fileInput) this.$refs.fileInput.click()
    },
    openFolderPicker() {
      if (this.$refs.fileFolderInput) this.$refs.fileFolderInput.click()
    },
    isDraggingFile(e) {
      // Checks dragging file or folder and not an element on the page
      var dt = e.dataTransfer || {}
      return dt.types && dt.types.indexOf('Files') >= 0
    },
    dragenter(e) {
      e.preventDefault()
      if (this.uploadReady && this.isDraggingFile(e) && !this.isDragging) {
        this.isDragging = true
      }
    },
    dragleave(e) {
      e.preventDefault()
      if (!e.fromElement && this.isDragging) {
        this.isDragging = false
      }
    },
    dragover(e) {
      // This is required to catch the drop event
      e.preventDefault()
    },
    async drop(e) {
      e.preventDefault()
      this.isDragging = false
      var items = e.dataTransfer.items || []

      var itemResults = await this.uploadHelpers.getItemsFromDrop(items, this.selectedLibraryMediaType)
      this.setResults(itemResults)
    },
    inputChanged(e) {
      if (!e.target || !e.target.files) return
      var _files = Array.from(e.target.files)
      if (_files && _files.length) {
        var itemResults = this.uploadHelpers.getItemsFromPicker(_files, this.selectedLibraryMediaType)
        this.setResults(itemResults)
      }
    },
    setResults(itemResults) {
      if (itemResults.error) {
        this.error = itemResults.error
        this.items = []
        this.ignoredFiles = []
      } else {
        this.error = ''
        this.items = itemResults.items
        this.ignoredFiles = itemResults.ignoredFiles
      }
      console.log('Upload results', itemResults)
    },
    updateItemCardStatus(index, status) {
      var ref = this.$refs[`itemCard-${index}`]
      if (ref && ref.length) ref = ref[0]
      if (!ref) {
        console.error('Book card ref not found', index, this.$refs)
      } else {
        ref.setUploadStatus(status)
      }
    },
    uploadItem(item) {
      var form = new FormData()
      form.set('title', item.title)
      if (!this.selectedLibraryIsPodcast) {
        form.set('author', item.author)
        form.set('series', item.series)
      }
      form.set('library', this.selectedLibraryId)
      form.set('folder', this.selectedFolderId)

      var index = 0
      item.files.forEach((file) => {
        form.set(`${index++}`, file)
      })

      return this.$axios
        .$post('/api/upload', form)
        .then(() => true)
        .catch((error) => {
          console.error('Failed', error)
          var errorMessage = error.response && error.response.data ? error.response.data : 'Oops, something went wrong...'
          this.$toast.error(errorMessage)
          return false
        })
    },
    validateItems() {
      var itemData = []
      for (var item of this.items) {
        var itemref = this.$refs[`itemCard-${item.index}`]
        if (itemref && itemref.length) itemref = itemref[0]

        if (!itemref) {
          console.error('Invalid item index no ref', item.index, this.$refs.itemCard)
          return false
        } else {
          var data = itemref.getData()
          if (!data) {
            return false
          }
          itemData.push(data)
        }
      }
      return itemData
    },
    async submit() {
      if (!this.selectedFolderId || !this.selectedLibraryId) {
        this.$toast.error('Must select library and folder')
        document.getElementById('page-wrapper').scroll({ top: 0, left: 0, behavior: 'smooth' })
        return
      }

      var items = this.validateItems()
      if (!items) {
        this.$toast.error('Some invalid items')
        return
      }
      this.processing = true
      var itemsUploaded = 0
      var itemsFailed = 0
      for (let i = 0; i < items.length; i++) {
        var item = items[i]
        this.updateItemCardStatus(item.index, 'uploading')
        var result = await this.uploadItem(item)
        if (result) itemsUploaded++
        else itemsFailed++
        this.updateItemCardStatus(item.index, result ? 'success' : 'failed')
      }
      if (itemsUploaded) {
        this.$toast.success(`Successfully uploaded ${itemsUploaded} item${itemsUploaded > 1 ? 's' : ''}`)
      }
      if (itemsFailed) {
        this.$toast.success(`Failed to upload ${itemsFailed} item${itemsFailed > 1 ? 's' : ''}`)
      }
      this.processing = false
      this.uploadFinished = true
    }
  },
  mounted() {
    this.selectedLibraryId = this.$store.state.libraries.currentLibraryId
    this.setDefaultFolder()
    window.addEventListener('dragenter', this.dragenter)
    window.addEventListener('dragleave', this.dragleave)
    window.addEventListener('dragover', this.dragover)
    window.addEventListener('drop', this.drop)
  },
  beforeDestroy() {
    window.removeEventListener('dragenter', this.dragenter)
    window.removeEventListener('dragleave', this.dragleave)
    window.removeEventListener('dragover', this.dragover)
    window.removeEventListener('drop', this.drop)
  }
}
</script>