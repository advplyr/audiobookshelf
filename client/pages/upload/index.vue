<template>
  <div id="page-wrapper" class="page p-6" :class="streamAudiobook ? 'streaming' : ''">
    <main class="container mx-auto h-full max-w-screen-lg p-6">
      <article class="max-h-full overflow-y-auto relative flex flex-col rounded-md" @drop="drop" @dragover="dragover" @dragleave="dragleave" @dragenter="dragenter">
        <h1 class="text-xl font-book px-8 pt-4 pb-2">Audiobook Uploader</h1>

        <div class="flex my-2 px-6">
          <div class="w-1/3 px-2">
            <!-- <ui-text-input-with-label v-model="title" label="Title" /> -->
            <ui-dropdown v-model="selectedLibraryId" :items="libraryItems" label="Library" @input="libraryChanged" />
          </div>
          <div class="w-2/3 px-2">
            <ui-dropdown v-model="selectedFolderId" :items="folderItems" :disabled="!selectedLibraryId" label="Folder" />
          </div>
        </div>
        <div class="flex my-2 px-6">
          <div class="w-1/2 px-2">
            <ui-text-input-with-label v-model="title" label="Title" />
          </div>
          <div class="w-1/2 px-2">
            <ui-text-input-with-label v-model="author" label="Author" />
          </div>
        </div>
        <div class="flex my-2 px-6">
          <div class="w-1/2 px-2">
            <ui-text-input-with-label v-model="series" label="Series" note="(optional)" />
          </div>
          <div class="w-1/2 px-2">
            <div class="w-full">
              <p class="px-1 text-sm font-semibold">Directory <em class="font-normal text-xs pl-2">(auto)</em></p>
              <ui-text-input :value="directory" disabled class="w-full font-mono text-xs" style="height: 42px" />
            </div>
          </div>
        </div>

        <section v-if="showUploader" class="h-full overflow-auto p-8 w-full flex flex-col">
          <header class="border-dashed border-2 border-gray-400 py-12 flex flex-col justify-center items-center relative h-40" :class="isDragOver ? 'bg-white bg-opacity-10' : ''">
            <p v-show="isDragOver" class="mb-3 font-semibold text-gray-200 flex flex-wrap justify-center">Drop em'</p>
            <p v-show="!isDragOver" class="mb-3 font-semibold text-gray-200 flex flex-wrap justify-center">Drop your audio and image files or</p>

            <input ref="fileInput" id="hidden-input" type="file" multiple :accept="inputAccept" class="hidden" @change="inputChanged" />
            <ui-btn @click="clickSelectAudioFiles">Select files</ui-btn>
            <p class="text-xs text-gray-300 absolute bottom-3 right-3">{{ inputAccept }}</p>
          </header>
        </section>
        <section v-else class="h-full overflow-auto px-8 pb-8 w-full flex flex-col">
          <p v-if="!hasValidAudioFiles" class="text-error text-lg pt-4">* No valid audio tracks</p>

          <div v-if="validImageFiles.length">
            <h1 class="pt-8 pb-3 font-semibold sm:text-lg text-gray-200">Cover Image(s)</h1>
            <div class="flex">
              <template v-for="file in validImageFiles">
                <div :key="file.name" class="h-28 w-20 bg-bg">
                  <img :src="file.src" class="h-full w-full object-contain" />
                </div>
              </template>
            </div>
          </div>

          <div v-if="validAudioFiles.length">
            <h1 class="pt-8 pb-3 font-semibold sm:text-lg text-gray-200">Audio Tracks</h1>

            <table class="text-sm tracksTable">
              <tr class="font-book">
                <th class="text-left">Filename</th>
                <th class="text-left">Type</th>
                <th class="text-left">Size</th>
              </tr>
              <template v-for="file in validAudioFiles">
                <tr :key="file.name">
                  <td class="font-book">
                    <p class="truncate">{{ file.name }}</p>
                  </td>
                  <td class="font-sm">
                    {{ file.type }}
                  </td>
                  <td class="font-mono">
                    {{ $bytesPretty(file.size) }}
                  </td>
                </tr>
              </template>
            </table>
          </div>

          <div v-if="invalidFiles.length">
            <h1 class="pt-8 pb-3 font-semibold sm:text-lg text-gray-200">Invalid Files</h1>
            <table class="text-sm tracksTable">
              <tr class="font-book">
                <th class="text-left">Filename</th>
                <th class="text-left">Type</th>
                <th class="text-left">Size</th>
              </tr>
              <template v-for="file in invalidFiles">
                <tr :key="file.name">
                  <td class="font-book">
                    <p class="truncate">{{ file.name }}</p>
                  </td>
                  <td class="font-sm">
                    {{ file.type }}
                  </td>
                  <td class="font-mono">
                    {{ $bytesPretty(file.size) }}
                  </td>
                </tr>
              </template>
            </table>
          </div>
        </section>
        <footer v-show="!showUploader" class="flex justify-end px-8 pb-8 pt-4">
          <ui-btn :disabled="!hasValidAudioFiles" color="success" @click="submit">Upload Audiobook</ui-btn>
          <button id="cancel" class="ml-3 rounded-sm px-3 py-1 hover:bg-white hover:bg-opacity-10 focus:shadow-outline focus:outline-none" @click="cancel">Cancel</button>
        </footer>

        <div v-if="processing" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-20">
          <ui-loading-indicator text="Uploading..." />
        </div>
      </article>
    </main>
  </div>
</template>

<script>
import Path from 'path'

export default {
  data() {
    return {
      processing: false,
      title: null,
      author: null,
      series: null,
      acceptedAudioFormats: ['.mp3', '.m4b', '.m4a', '.flac', '.opus'],
      acceptedImageFormats: ['.png', '.jpg', '.jpeg', '.webp'],
      inputAccept: '.png, .jpg, .jpeg, .webp, .mp3, .m4b, .m4a, .flac, .opus',
      isDragOver: false,
      showUploader: true,
      validAudioFiles: [],
      validImageFiles: [],
      invalidFiles: [],
      selectedLibraryId: null,
      selectedFolderId: null
    }
  },
  computed: {
    streamAudiobook() {
      return this.$store.state.streamAudiobook
    },
    hasValidAudioFiles() {
      return this.validAudioFiles.length
    },
    directory() {
      if (!this.author || !this.title) return ''
      if (this.series) {
        return Path.join(this.author, this.series, this.title)
      } else {
        return Path.join(this.author, this.title)
      }
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
    reset() {
      this.title = ''
      this.author = ''
      this.series = ''
      this.cancel()
    },
    cancel() {
      this.validAudioFiles = []
      this.validImageFiles = []
      this.invalidFiles = []
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
      this.showUploader = true
    },
    inputChanged(e) {
      if (!e.target || !e.target.files) return
      var _files = Array.from(e.target.files)
      if (_files && _files.length) {
        this.filesChanged(_files)
      }
    },
    drop(evt) {
      this.isDragOver = false
      this.preventDefaults(evt)
      const files = [...evt.dataTransfer.files]
      this.filesChanged(files)
    },
    dragover(evt) {
      this.isDragOver = true
      this.preventDefaults(evt)
    },
    dragleave(evt) {
      this.isDragOver = false
      this.preventDefaults(evt)
    },
    dragenter(evt) {
      this.isDragOver = true
      this.preventDefaults(evt)
    },
    preventDefaults(e) {
      e.preventDefault()
      e.stopPropagation()
    },
    filesChanged(files) {
      this.showUploader = false

      for (let i = 0; i < files.length; i++) {
        var file = files[i]
        var ext = Path.extname(file.name)

        if (this.acceptedAudioFormats.includes(ext)) {
          this.validAudioFiles.push(file)
        } else if (file.type.startsWith('image/')) {
          file.src = URL.createObjectURL(file)
          this.validImageFiles.push(file)
        } else {
          this.invalidFiles.push(file)
        }
      }
    },
    clickSelectAudioFiles() {
      if (this.$refs.fileInput) {
        this.$refs.fileInput.click()
      }
    },
    submit() {
      if (!this.title || !this.author) {
        this.$toast.error('Must enter a title and author')
        return
      }
      if (!this.selectedLibraryId || !this.selectedFolderId) {
        this.$toast.error('Must select a library and folder')
        return
      }
      this.processing = true

      var form = new FormData()
      form.set('title', this.title)
      form.set('author', this.author)
      form.set('series', this.series)
      form.set('library', this.selectedLibraryId)
      form.set('folder', this.selectedFolderId)

      var index = 0
      var files = this.validAudioFiles.concat(this.validImageFiles)
      files.forEach((file) => {
        form.set(`${index++}`, file)
      })

      this.$axios
        .$post('/upload', form)
        .then((data) => {
          this.$toast.success('Audiobook Uploaded Successfully')
          this.reset()
          this.processing = false
        })
        .catch((error) => {
          console.error('Failed', error)
          var errorMessage = error.response && error.response.data ? error.response.data : 'Oops, something went wrong...'
          this.$toast.error(errorMessage)
          this.processing = false
        })
    }
  },
  mounted() {
    this.selectedLibraryId = this.$store.state.libraries.currentLibraryId
    this.setDefaultFolder()
  }
}
</script>