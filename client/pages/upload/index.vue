<template>
  <div id="page-wrapper" class="page p-0 sm:p-6 overflow-y-auto" :class="streamAudiobook ? 'streaming' : ''">
    <div class="w-full max-w-6xl mx-auto">
      <!-- Library & folder picker -->
      <div class="flex my-6 -mx-2">
        <div class="w-1/3 px-2">
          <ui-dropdown v-model="selectedLibraryId" :items="libraryItems" label="Library" :disabled="processing" @input="libraryChanged" />
        </div>
        <div class="w-2/3 px-2">
          <ui-dropdown v-model="selectedFolderId" :items="folderItems" :disabled="!selectedLibraryId || processing" label="Folder" />
        </div>
      </div>

      <widgets-alert v-if="error" type="error">
        <p class="text-lg">{{ error }}</p>
      </widgets-alert>

      <!-- Picker display -->
      <div v-if="!books.length && !ignoredFiles.length" class="w-full mx-auto border border-white border-opacity-20 px-12 pt-12 pb-4 my-12 relative" :class="isDragging ? 'bg-primary bg-opacity-40' : 'border-dashed'">
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
      <!-- Book list header -->
      <div v-else class="w-full flex items-center pb-4 border-b border-white border-opacity-10">
        <p class="text-lg">{{ books.length }} book{{ books.length === 1 ? '' : 's' }}</p>
        <p v-if="ignoredFiles.length" class="text-lg">&nbsp;|&nbsp;{{ ignoredFiles.length }} file{{ ignoredFiles.length === 1 ? '' : 's' }} ignored</p>
        <div class="flex-grow" />
        <ui-btn :disabled="processing" small @click="reset">Reset</ui-btn>
      </div>

      <!-- Alerts -->
      <widgets-alert v-if="!books.length && !uploadReady" type="error" class="my-4">
        <p class="text-lg">No books found</p>
      </widgets-alert>
      <widgets-alert v-if="ignoredFiles.length" type="warning" class="my-4">
        <div class="w-full pr-12">
          <p class="text-base mb-1">Unsupported files are ignored. When choosing or dropping a folder, other files that are not in a book folder are ignored.</p>
          <tables-uploaded-files-table :files="ignoredFiles" title="Ignored Files" class="text-white" />
          <p class="text-xs text-white text-opacity-50 font-mono pt-1"><strong>Supported File Types: </strong>{{ inputAccept.join(', ') }}</p>
        </div>
      </widgets-alert>

      <!-- Book Upload cards -->
      <template v-for="(book, index) in books">
        <cards-book-upload-card :ref="`bookCard-${book.index}`" :key="index" :book="book" :processing="processing" @remove="removeBook(book)" />
      </template>

      <!-- Upload/Reset btns -->
      <div v-show="books.length" class="flex justify-end pb-8 pt-4">
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
      books: [],
      ignoredFiles: [],
      selectedLibraryId: null,
      selectedFolderId: null,
      processing: false,
      uploadFinished: false
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
    streamAudiobook() {
      return this.$store.state.streamAudiobook
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
      return !this.books.length && !this.ignoredFiles.length && !this.uploadFinished
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
    removeBook(book) {
      this.books = this.books.filter((b) => b.index !== book.index)
      if (!this.books.length) {
        this.reset()
      }
    },
    reset() {
      this.error = ''
      this.books = []
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
      var bookResults = await this.uploadHelpers.getBooksFromDrop(items)
      this.setResults(bookResults)
    },
    inputChanged(e) {
      if (!e.target || !e.target.files) return
      var _files = Array.from(e.target.files)
      if (_files && _files.length) {
        var bookResults = this.uploadHelpers.getBooksFromPicker(_files)
        this.setResults(bookResults)
      }
    },
    setResults(bookResults) {
      if (bookResults.error) {
        this.error = bookResults.error
        this.books = []
        this.ignoredFiles = []
      } else {
        this.error = ''
        this.books = bookResults.books
        this.ignoredFiles = bookResults.ignoredFiles
      }
      console.log('Upload results', bookResults)
    },
    updateBookCardStatus(index, status) {
      var ref = this.$refs[`bookCard-${index}`]
      if (ref && ref.length) ref = ref[0]
      if (!ref) {
        console.error('Book card ref not found', index, this.$refs)
      } else {
        ref.setUploadStatus(status)
      }
    },
    uploadBook(book) {
      var form = new FormData()
      form.set('title', book.title)
      form.set('author', book.author)
      form.set('series', book.series)
      form.set('library', this.selectedLibraryId)
      form.set('folder', this.selectedFolderId)

      var index = 0
      book.files.forEach((file) => {
        form.set(`${index++}`, file)
      })

      return this.$axios
        .$post('/upload', form)
        .then(() => true)
        .catch((error) => {
          console.error('Failed', error)
          var errorMessage = error.response && error.response.data ? error.response.data : 'Oops, something went wrong...'
          this.$toast.error(errorMessage)
          return false
        })
    },
    validateBooks() {
      var bookData = []
      for (var book of this.books) {
        var bookref = this.$refs[`bookCard-${book.index}`]
        if (bookref && bookref.length) bookref = bookref[0]

        if (!bookref) {
          console.error('Invalid book index no ref', book.index, this.$refs.bookCard)
          return false
        } else {
          var data = bookref.getData()
          if (!data) {
            return false
          }
          bookData.push(data)
        }
      }
      return bookData
    },
    async submit() {
      if (!this.selectedFolderId || !this.selectedLibraryId) {
        this.$toast.error('Must select library and folder')
        document.getElementById('page-wrapper').scroll({ top: 0, left: 0, behavior: 'smooth' })
        return
      }

      var books = this.validateBooks()
      if (!books) {
        this.$toast.error('Some invalid books')
        return
      }
      this.processing = true
      var booksUploaded = 0
      var booksFailed = 0
      for (let i = 0; i < books.length; i++) {
        var book = books[i]
        this.updateBookCardStatus(book.index, 'uploading')
        var result = await this.uploadBook(book)
        if (result) booksUploaded++
        else booksFailed++
        this.updateBookCardStatus(book.index, result ? 'success' : 'failed')
      }
      if (booksUploaded) {
        this.$toast.success(`Successfully uploaded ${booksUploaded} book${booksUploaded > 1 ? 's' : ''}`)
      }
      if (booksFailed) {
        this.$toast.success(`Failed to upload ${booksFailed} book${booksFailed > 1 ? 's' : ''}`)
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