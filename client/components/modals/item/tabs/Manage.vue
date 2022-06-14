<template>
  <div class="w-full h-full overflow-hidden overflow-y-auto px-4 py-6">
    <!-- Merge to m4b -->
    <div v-if="showM4bDownload" class="w-full border border-black-200 p-4 my-8">
      <div class="flex items-center">
        <div>
          <p class="text-lg">Make M4B Audiobook File <span class="text-error">*</span></p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">Generate a .M4B audiobook file with embedded metadata, cover image, and chapters. <br /><span class="text-warning">*</span> Does not delete existing audio files.</p>
        </div>
        <div class="flex-grow" />
        <div>
          <p v-if="abmergeStatus === $constants.DownloadStatus.FAILED" class="text-error mb-2">Download Failed</p>
          <p v-if="abmergeStatus === $constants.DownloadStatus.READY" class="text-success mb-2">Download Ready!</p>
          <p v-if="abmergeStatus === $constants.DownloadStatus.EXPIRED" class="text-error mb-2">Download Expired</p>

          <ui-btn v-if="abmergeStatus !== $constants.DownloadStatus.READY" :loading="abmergeStatus === $constants.DownloadStatus.PENDING" :disabled="tempDisable" @click="startAudiobookMerge">Start Merge</ui-btn>
          <div v-else>
            <div class="flex">
              <ui-btn @click="downloadWithProgress(abmergeDownload)">Download</ui-btn>
              <ui-icon-btn small icon="delete" bg-color="error" class="ml-2" @click="removeDownload" />
            </div>
            <p class="px-0.5 py-1 text-sm font-mono text-center">Size: {{ $bytesPretty(abmergeDownload.size) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Split to mp3 -->
    <div v-if="showMp3Split && showExperimentalFeatures" class="w-full border border-black-200 p-4 my-8">
      <div class="flex items-center">
        <div>
          <p class="text-lg">Split M4B to MP3's</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">Generate multiple MP3's split by chapters with embedded metadata, cover image, and chapters. <br /><span class="text-warning">*</span> Does not delete existing audio files.</p>
        </div>
        <div class="flex-grow" />
        <div>
          <p v-if="abmergeStatus === $constants.DownloadStatus.FAILED" class="text-error mb-2">Download Failed</p>
          <p v-if="abmergeStatus === $constants.DownloadStatus.READY" class="text-success mb-2">Download Ready!</p>
          <p v-if="abmergeStatus === $constants.DownloadStatus.EXPIRED" class="text-error mb-2">Download Expired</p>

          <ui-btn v-if="abmergeStatus !== $constants.DownloadStatus.READY" :loading="abmergeStatus === $constants.DownloadStatus.PENDING" :disabled="true" @click="startAudiobookMerge">Not yet implemented</ui-btn>
          <div v-else>
            <div class="flex">
              <ui-btn @click="downloadWithProgress(abmergeDownload)">Download</ui-btn>
              <ui-icon-btn small icon="delete" bg-color="error" class="ml-2" @click="removeDownload" />
            </div>
            <p class="px-0.5 py-1 text-sm font-mono text-center">Size: {{ $bytesPretty(abmergeDownload.size) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Embed Metadata -->
    <div v-if="mediaTracks.length && showExperimentalFeatures" class="w-full border border-black-200 p-4 my-8">
      <div class="flex items-center">
        <div>
          <p class="text-lg">Embed Metadata</p>
          <p class="max-w-sm text-sm pt-2 text-gray-300">Embed metadata into audio files including cover image and chapters. <br /><span class="text-warning">*</span> Modifies audio files.</p>
        </div>
        <div class="flex-grow" />
        <div>
          <ui-btn :to="`/item/${libraryItemId}/manage`" class="flex items-center"
            >Open Manager
            <span class="material-icons text-lg ml-2">launch</span>
          </ui-btn>
        </div>
      </div>
    </div>

    <p v-if="showM4bDownload" class="text-left text-base mb-4 py-4">
      <span class="text-error">* <strong>Experimental</strong></span
      >&nbsp;-&nbsp;M4b merge can take several minutes and will be stored in <span class="bg-primary bg-opacity-75 font-mono p-1 text-base">/metadata/downloads</span>. After the download is ready, it will remain available for 60 minutes, then be deleted. Download will timeout after 30 minutes.
    </p>

    <!-- <p v-if="isSingleM4b" class="text-lg text-center my-8">Audiobook is already a single m4b!</p> -->
    <p v-if="!mediaTracks.length" class="text-lg text-center my-8">No audio tracks to merge</p>

    <div v-if="isDownloading" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div class="w-80 border border-black-400 bg-bg rounded-xl h-20">
        <div class="w-full h-full flex items-center justify-center">
          <p class="text-lg">Download.... {{ downloadPercent }}%</p>
          <p class="w-24 font-mono pl-8 text-right">
            {{ downloadAmount }}
          </p>
        </div>
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
      tempDisable: false,
      isDownloading: false,
      downloadPercent: '0',
      downloadAmount: '0 KB'
    }
  },
  watch: {
    abmergeStatus(newVal) {
      if (newVal) {
        this.tempDisable = false
      }
    }
  },
  computed: {
    showExperimentalFeatures() {
      return this.$store.state.showExperimentalFeatures
    },
    libraryItemId() {
      return this.libraryItem ? this.libraryItem.id : null
    },
    media() {
      return this.libraryItem ? this.libraryItem.media || {} : {}
    },
    downloads() {
      return this.$store.getters['downloads/getDownloads'](this.libraryItemId)
    },
    abmergeDownload() {
      return this.downloads.find((d) => d.type === 'abmerge')
    },
    abmergeStatus() {
      return this.abmergeDownload ? this.abmergeDownload.status : false
    },
    libraryFiles() {
      return this.libraryItem.libraryFiles
    },
    totalFiles() {
      return this.libraryFiles.length
    },
    mediaTracks() {
      return this.media.tracks || []
    },
    isSingleM4b() {
      return this.mediaTracks.length === 1 && this.mediaTracks[0].metadata.ext.toLowerCase() === '.m4b'
    },
    chapters() {
      return this.media.chapters || []
    },
    showM4bDownload() {
      if (!this.mediaTracks.length) return false
      return !this.isSingleM4b
    },
    showMp3Split() {
      if (!this.mediaTracks.length) return false
      return this.isSingleM4b && this.chapters.length
    }
  },
  methods: {
    removeDownload() {
      if (!this.abmergeDownload) return
      if (!confirm(`Are you sure you want to remove this merge download?`)) return

      var downloadId = this.abmergeDownload.id

      this.tempDisable = true
      this.$axios
        .$delete(`/api/download/${downloadId}`)
        .then(() => {
          this.tempDisable = false
          this.$toast.success('Merge download deleted')
          this.$store.commit('downloads/removeDownload', { id: downloadId })
        })
        .catch((error) => {
          var errorMsg = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'
          this.$toast.error(errorMsg)
          this.tempDisable = false
        })
    },
    startAudiobookMerge() {
      this.tempDisable = true

      this.$axios
        .$get(`/api/audiobook-merge/${this.libraryItemId}`)
        .then(() => {
          this.tempDisable = false
        })
        .catch((error) => {
          var errorMsg = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'
          this.$toast.error(errorMsg)
          this.tempDisable = false
        })
    },
    downloadWithProgress(download) {
      var downloadId = download.id
      var downloadUrl = `${process.env.serverUrl}/api/download/${downloadId}`
      var filename = download.filename

      this.isDownloading = true

      var request = new XMLHttpRequest()
      request.responseType = 'blob'
      request.open('get', downloadUrl, true)
      request.setRequestHeader('Authorization', `Bearer ${this.$store.getters['user/getToken']}`)
      request.send()

      request.onreadystatechange = () => {
        if (request.readyState === 4) {
          this.isDownloading = false
        }
        if (request.readyState == 4 && request.status == 200) {
          const url = window.URL.createObjectURL(request.response)

          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = filename
          document.body.appendChild(anchor)
          anchor.click()
          setTimeout(() => {
            if (anchor) anchor.remove()
          }, 1000)
        }
      }

      request.onerror = (err) => {
        console.error('Download error', err)
        this.isDownloading = false
      }

      request.onprogress = (e) => {
        const percent_complete = Math.floor((e.loaded / e.total) * 100)
        this.downloadAmount = this.$bytesPretty(e.loaded)
        this.downloadPercent = percent_complete

        // const duration = (new Date().getTime() - startTime) / 1000
        // const bps = e.loaded / duration
        // const kbps = Math.floor(bps / 1024)
        // const time = (e.total - e.loaded) / bps
        // const seconds = Math.floor(time % 60)
        // const minutes = Math.floor(time / 60)
        // console.log(`${percent_complete}% - ${kbps} Kbps - ${minutes} min ${seconds} sec remaining`)
      }
    },
    loadDownloads() {
      this.$axios
        .$get(`/api/downloads`)
        .then((data) => {
          var pendingDownloads = data.pendingDownloads.map((pd) => {
            pd.download.status = this.$constants.DownloadStatus.PENDING
            return pd.download
          })
          var downloads = data.downloads.map((d) => {
            d.status = this.$constants.DownloadStatus.READY
            return d
          })
          var allDownloads = downloads.concat(pendingDownloads)
          this.$store.commit('downloads/setDownloads', allDownloads)
        })
        .catch((error) => {
          console.error('Failed to load downloads', error)
        })
    }
  },
  mounted() {
    this.loadDownloads()
  }
}
</script>