<template>
  <div class="w-full h-full overflow-hidden overflow-y-auto px-4 py-6">
    <p class="text-center text-lg mb-4 py-8">Preparing downloads can take several minutes and will be stored in <span class="bg-primary bg-opacity-75 font-mono p-1 text-base">/metadata/downloads</span>. After the download is ready, it will remain available for 60 minutes, then be deleted.<br />Download will timeout after 15 minutes.</p>
    <div class="w-full border border-black-200 p-4 my-4">
      <div class="flex items-center">
        <div>
          <p class="text-lg">M4B Audiobook File <span class="text-error">*</span></p>
          <p class="max-w-xs text-sm pt-2 text-gray-300">Generate a .M4B audiobook file with embedded cover image and chapters.</p>
        </div>
        <div class="flex-grow" />
        <div>
          <p v-if="singleDownloadStatus === $constants.DownloadStatus.FAILED" class="text-error mb-2">Download Failed</p>
          <p v-if="singleDownloadStatus === $constants.DownloadStatus.READY" class="text-success mb-2">Download Ready!</p>
          <p v-if="singleDownloadStatus === $constants.DownloadStatus.EXPIRED" class="text-error mb-2">Download Expired</p>

          <ui-btn v-if="singleDownloadStatus !== $constants.DownloadStatus.READY" :loading="singleDownloadStatus === $constants.DownloadStatus.PENDING" :disabled="tempDisable" @click="startSingleAudioDownload">Start Download</ui-btn>
          <div v-else>
            <ui-btn @click="downloadWithProgress(singleAudioDownload)">Download</ui-btn>
            <p class="px-0.5 py-1 text-sm font-mono text-center">Size: {{ $bytesPretty(singleAudioDownload.size) }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="w-full border border-black-200 p-4 my-4">
      <div class="flex items-center">
        <div>
          <p v-if="totalFiles > 1" class="text-lg">Zip {{ totalFiles }} Files</p>
          <p v-else>Zip 1 File</p>
          <p class="max-w-xs text-sm pt-2 text-gray-300">Generate a .ZIP file from the contents of the audiobook directory.</p>
        </div>

        <div class="flex-grow" />
        <div>
          <p v-if="zipDownloadStatus === $constants.DownloadStatus.FAILED" class="text-error mb-2">Download Failed</p>
          <p v-if="zipDownloadStatus === $constants.DownloadStatus.READY" class="text-success mb-2">Download Ready!</p>
          <p v-if="zipDownloadStatus === $constants.DownloadStatus.EXPIRED" class="text-error mb-2">Download Expired</p>

          <ui-btn v-if="zipDownloadStatus !== $constants.DownloadStatus.READY" :loading="zipDownloadStatus === $constants.DownloadStatus.PENDING" :disabled="tempDisable" @click="startZipDownload">Start Download</ui-btn>
          <div v-else>
            <ui-btn @click="downloadWithProgress(zipDownload)">Download</ui-btn>
            <p class="px-0.5 py-1 text-sm font-mono text-center">Size: {{ $bytesPretty(zipDownload.size) }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="w-full flex items-center justify-center absolute bottom-4 left-0 right-0 text-center">
      <p class="text-error text-lg">* <strong>Experimental:</strong> Merging multiple .m4b files may have issues. <a href="https://github.com/advplyr/audiobookshelf/issues" class="underline text-blue-600" target="_blank">Report issues here.</a></p>
    </div>

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
    audiobook: {
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
    singleDownloadStatus(newVal) {
      if (newVal) {
        this.tempDisable = false
      }
    }
  },
  computed: {
    audiobookId() {
      return this.audiobook ? this.audiobook.id : null
    },
    downloads() {
      return this.$store.getters['downloads/getDownloads'](this.audiobookId)
    },
    singleAudioDownload() {
      return this.downloads.find((d) => d.type === 'singleAudio')
    },
    singleDownloadStatus() {
      return this.singleAudioDownload ? this.singleAudioDownload.status : false
    },
    zipDownload() {
      return this.downloads.find((d) => d.type === 'zip')
    },
    zipDownloadStatus() {
      return this.zipDownload ? this.zipDownload.status : false
    },
    isSingleTrack() {
      if (!this.audiobook.tracks) return false
      return this.audiobook.tracks.length === 1
    },
    singleTrackPath() {
      if (!this.isSingleTrack) return null
      return this.audiobook.tracks[0].path
    },
    audioFiles() {
      return this.audiobook ? this.audiobook.audioFiles || [] : []
    },
    otherFiles() {
      return this.audiobook ? this.audiobook.otherFiles || [] : []
    },
    totalFiles() {
      return this.audioFiles.length + this.otherFiles.length
    }
  },
  methods: {
    startZipDownload() {
      // console.log('Download request received', this.audiobook)

      this.tempDisable = true
      setTimeout(() => {
        this.tempDisable = false
      }, 1000)

      var downloadPayload = {
        audiobookId: this.audiobook.id,
        type: 'zip'
      }
      this.$root.socket.emit('download', downloadPayload)
    },
    startSingleAudioDownload() {
      // console.log('Download request received', this.audiobook)

      this.tempDisable = true
      setTimeout(() => {
        this.tempDisable = false
      }, 1000)

      var downloadPayload = {
        audiobookId: this.audiobook.id,
        type: 'singleAudio',
        includeMetadata: true,
        includeCover: true
      }
      this.$root.socket.emit('download', downloadPayload)
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
    }
  },
  mounted() {}
}
</script>