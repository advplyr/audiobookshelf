<template>
  <div class="w-full h-full overflow-hidden overflow-y-auto px-4 py-6">
    <div class="w-full border border-black-200 p-4 my-4">
      <!-- <p class="text-center text-lg mb-4 pb-8 border-b border-black-200">
        <span class="text-error">Experimental Feature!</span> If your audiobook is made up of multiple audio files, this will concatenate them into a single file. The file type will be the same as the first track. Preparing downloads can take anywhere from a few seconds to several minutes and will be stored in
        <span class="bg-primary bg-opacity-75 font-mono p-1 text-base">/metadata/downloads</span>. After the download is ready, it will remain available for 10 minutes then get deleted.
      </p> -->
      <p class="text-center text-lg mb-4 pb-8 border-b border-black-200">
        <span class="text-error">Experimental Feature!</span> If your audiobook has multiple tracks, this will merge them into a single M4B audiobook file.<br />Preparing downloads can take several minutes and will be stored in <span class="bg-primary bg-opacity-75 font-mono p-1 text-base">/metadata/downloads</span>. After the download is ready, it will remain available for 60 minutes, then be
        deleted.
      </p>

      <div class="flex items-center">
        <p class="text-lg">{{ isSingleTrack ? 'Single Track' : 'M4B Audiobook File' }}</p>
        <div class="flex-grow" />
        <div>
          <p v-if="singleAudioDownloadFailed" class="text-error mb-2">Download Failed</p>
          <p v-if="singleAudioDownloadReady" class="text-success mb-2">Download Ready!</p>
          <p v-if="singleAudioDownloadExpired" class="text-error mb-2">Download Expired</p>
          <a v-if="isSingleTrack" :href="`/local/${singleTrackPath}`" class="btn outline-none rounded-md shadow-md relative border border-gray-600 px-4 py-2 bg-primary">Download Track</a>
          <ui-btn v-else-if="!singleAudioDownloadReady" :loading="singleAudioDownloadPending" :disabled="tempDisable" @click="startSingleAudioDownload">Start Download</ui-btn>
          <ui-btn v-else @click="downloadWithProgress">Download</ui-btn>
        </div>
      </div>
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
    singleAudioDownloadPending(newVal) {
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
    singleAudioDownloadPending() {
      return this.singleAudioDownload && this.singleAudioDownload.isPending
    },
    singleAudioDownloadFailed() {
      return this.singleAudioDownload && this.singleAudioDownload.isFailed
    },
    singleAudioDownloadReady() {
      return this.singleAudioDownload && this.singleAudioDownload.isReady
    },
    singleAudioDownloadExpired() {
      return this.singleAudioDownload && this.singleAudioDownload.isExpired
    },
    zipBundleDownload() {
      return this.downloads.find((d) => d.type === 'zipBundle')
    },
    isSingleTrack() {
      if (!this.audiobook.tracks) return false
      return this.audiobook.tracks.length === 1
    },
    singleTrackPath() {
      if (!this.isSingleTrack) return null
      return this.audiobook.tracks[0].path
    }
  },
  methods: {
    startSingleAudioDownload() {
      console.log('Download request received', this.audiobook)

      this.tempDisable = true
      setTimeout(() => {
        this.tempDisable = false
      }, 1000)

      var downloadPayload = {
        audiobookId: this.audiobook.id,
        type: 'singleAudio'
      }
      this.$root.socket.emit('download', downloadPayload)
    },
    downloadWithProgress() {
      var downloadId = this.singleAudioDownload.id
      var downloadUrl = `${process.env.serverUrl}/api/download/${downloadId}`
      var filename = this.singleAudioDownload.filename

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