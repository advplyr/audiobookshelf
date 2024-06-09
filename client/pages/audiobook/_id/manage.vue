<template>
  <div id="page-wrapper" class="bg-bg page p-8 overflow-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex items-center justify-center mb-6">
      <div class="w-full max-w-2xl">
        <p class="text-2xl mb-2">{{ $strings.HeaderAudiobookTools }}</p>
      </div>
      <div class="w-full max-w-2xl">
        <div class="flex justify-end">
          <ui-dropdown v-model="selectedTool" :items="availableTools" :disabled="processing" class="max-w-sm" @input="selectedToolUpdated" />
        </div>
      </div>
    </div>

    <div class="flex justify-center">
      <div class="w-full max-w-2xl">
        <p class="text-xl mb-1">{{ $strings.HeaderMetadataToEmbed }}</p>
        <p class="mb-2 text-base text-gray-300">audiobookshelf uses <a href="https://github.com/sandreas/tone" target="_blank" class="hover:underline text-blue-400 hover:text-blue-300">tone</a> to write metadata.</p>
      </div>
      <div class="w-full max-w-2xl"></div>
    </div>

    <div class="flex justify-center flex-wrap">
      <div class="w-full max-w-2xl border border-white border-opacity-10 bg-bg mx-2">
        <div class="flex py-2 px-4">
          <div class="w-1/3 text-xs font-semibold uppercase text-gray-200">{{ $strings.LabelMetaTag }}</div>
          <div class="w-2/3 text-xs font-semibold uppercase text-gray-200">{{ $strings.LabelValue }}</div>
        </div>
        <div class="w-full max-h-72 overflow-auto">
          <template v-for="(value, key, index) in toneObject">
            <div :key="key" class="flex py-1 px-4 text-sm" :class="index % 2 === 0 ? 'bg-primary bg-opacity-25' : ''">
              <div class="w-1/3 font-semibold">{{ key }}</div>
              <div class="w-2/3">
                {{ value }}
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="w-full max-w-2xl border border-white border-opacity-10 bg-bg mx-2">
        <div class="flex py-2 px-4 bg-primary bg-opacity-25">
          <div class="flex-grow text-xs font-semibold uppercase text-gray-200">{{ $strings.LabelChapterTitle }}</div>
          <div class="w-24 text-xs font-semibold uppercase text-gray-200">{{ $strings.LabelStart }}</div>
          <div class="w-24 text-xs font-semibold uppercase text-gray-200">{{ $strings.LabelEnd }}</div>
        </div>
        <div class="w-full max-h-72 overflow-auto">
          <p v-if="!metadataChapters.length" class="py-5 text-center text-gray-200">{{ $strings.MessageNoChapters }}</p>
          <template v-for="(chapter, index) in metadataChapters">
            <div :key="index" class="flex py-1 px-4 text-sm" :class="index % 2 === 1 ? 'bg-primary bg-opacity-25' : ''">
              <div class="flex-grow font-semibold">{{ chapter.title }}</div>
              <div class="w-24">
                {{ $secondsToTimestamp(chapter.start) }}
              </div>
              <div class="w-24">
                {{ $secondsToTimestamp(chapter.end) }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="w-full h-px bg-white bg-opacity-10 my-8" />

    <div class="w-full max-w-4xl mx-auto">
      <!-- queued alert -->
      <widgets-alert v-if="isMetadataEmbedQueued" type="warning" class="mb-4">
        <p class="text-lg">Audiobook is queued for metadata embed ({{ queuedEmbedLIds.length }} in queue)</p>
      </widgets-alert>
      <!-- metadata embed action buttons -->
      <div v-else-if="isEmbedTool" class="w-full flex justify-end items-center mb-4">
        <ui-checkbox v-if="!isTaskFinished" v-model="shouldBackupAudioFiles" :disabled="processing" label="Backup audio files" medium checkbox-bg="bg" label-class="pl-2 text-base md:text-lg" @input="toggleBackupAudioFiles" />

        <div class="flex-grow" />

        <ui-btn v-if="!isTaskFinished" color="primary" :loading="processing" @click.stop="embedClick">{{ $strings.ButtonStartMetadataEmbed }}</ui-btn>
        <p v-else class="text-success text-lg font-semibold">{{ $strings.MessageEmbedFinished }}</p>
      </div>
      <!-- m4b embed action buttons -->
      <div v-else class="w-full flex items-center mb-4">
        <button :disabled="processing" class="text-sm uppercase text-gray-200 flex items-center pt-px pl-1 pr-2 hover:bg-white/5 rounded-md" @click="showEncodeOptions = !showEncodeOptions">
          <span class="material-icons text-xl">{{ showEncodeOptions ? 'check_box' : 'check_box_outline_blank' }}</span> <span class="pl-1">Use Advanced Options</span>
        </button>

        <div class="flex-grow" />

        <ui-btn v-if="!isTaskFinished && processing" color="error" :loading="isCancelingEncode" class="mr-2" @click.stop="cancelEncodeClick">{{ $strings.ButtonCancelEncode }}</ui-btn>
        <ui-btn v-if="!isTaskFinished" color="primary" :loading="processing" @click.stop="encodeM4bClick">{{ $strings.ButtonStartM4BEncode }}</ui-btn>
        <p v-else-if="taskFailed" class="text-error text-lg font-semibold">{{ $strings.MessageM4BFailed }} {{ taskError }}</p>
        <p v-else class="text-success text-lg font-semibold">{{ $strings.MessageM4BFinished }}</p>
      </div>

      <!-- advanced encoding options -->
      <div v-if="isM4BTool" class="overflow-hidden">
        <transition name="slide">
          <div v-if="showEncodeOptions" class="mb-4 pb-4 border-b border-white/10">
            <div class="flex flex-wrap -mx-2">
              <ui-text-input-with-label ref="bitrateInput" v-model="encodingOptions.bitrate" :disabled="processing || isTaskFinished" :label="'Audio Bitrate (e.g. 128k)'" class="m-2 max-w-40" />
              <ui-text-input-with-label ref="channelsInput" v-model="encodingOptions.channels" :disabled="processing || isTaskFinished" :label="'Audio Channels (1 or 2)'" class="m-2 max-w-40" />
              <ui-text-input-with-label ref="codecInput" v-model="encodingOptions.codec" :disabled="processing || isTaskFinished" :label="'Audio Codec'" class="m-2 max-w-40" />
            </div>
            <p class="text-sm text-warning">Warning: Do not update these settings unless you are familiar with ffmpeg encoding options.</p>
          </div>
        </transition>
      </div>

      <div class="mb-4">
        <div v-if="isEmbedTool" class="flex items-start mb-2">
          <span class="material-icons text-base text-warning pt-1">star</span>
          <p class="text-gray-200 ml-2">Metadata will be embedded in the audio tracks inside your audiobook folder.</p>
        </div>
        <div v-else class="flex items-start mb-2">
          <span class="material-icons text-base text-warning pt-1">star</span>
          <p class="text-gray-200 ml-2">
            Finished M4B will be put into your audiobook folder at <span class="rounded-md bg-neutral-600 text-sm text-white py-0.5 px-1 font-mono">.../{{ libraryItemRelPath }}/</span>.
          </p>
        </div>

        <div v-if="shouldBackupAudioFiles || isM4BTool" class="flex items-start mb-2">
          <span class="material-icons text-base text-warning pt-1">star</span>
          <p class="text-gray-200 ml-2">
            A backup of your original audio files will be stored in <span class="rounded-md bg-neutral-600 text-sm text-white py-0.5 px-1 font-mono">/metadata/cache/items/{{ libraryItemId }}/</span>. Make sure to periodically purge items cache.
          </p>
        </div>
        <div v-if="isEmbedTool && audioFiles.length > 1" class="flex items-start mb-2">
          <span class="material-icons text-base text-warning pt-1">star</span>
          <p class="text-gray-200 ml-2">Chapters are not embedded in multi-track audiobooks.</p>
        </div>
        <div v-if="isM4BTool" class="flex items-start mb-2">
          <span class="material-icons text-base text-warning pt-1">star</span>
          <p class="text-gray-200 ml-2">Encoding can take up to 30 minutes.</p>
        </div>
        <div v-if="isM4BTool" class="flex items-start mb-2">
          <span class="material-icons text-base text-warning pt-1">star</span>
          <p class="text-gray-200 ml-2">If you have the watcher disabled you will need to re-scan this audiobook afterwards.</p>
        </div>
        <div class="flex items-start mb-2">
          <span class="material-icons text-base text-warning pt-1">star</span>
          <p class="text-gray-200 ml-2">Once the task is started you can navigate away from this page.</p>
        </div>
      </div>
    </div>

    <div class="w-full max-w-4xl mx-auto">
      <p class="mb-2 font-semibold">{{ $strings.HeaderAudioTracks }}</p>
      <div class="w-full mx-auto border border-white border-opacity-10 bg-bg">
        <div class="flex py-2 px-4 bg-primary bg-opacity-25">
          <div class="w-10 text-xs font-semibold text-gray-200">#</div>
          <div class="flex-grow text-xs font-semibold uppercase text-gray-200">{{ $strings.LabelFilename }}</div>
          <div class="w-16 text-xs font-semibold uppercase text-gray-200">{{ $strings.LabelSize }}</div>
          <div class="w-24"></div>
        </div>
        <template v-for="file in audioFiles">
          <div :key="file.index" class="flex py-2 px-4 text-sm" :class="file.index % 2 === 0 ? 'bg-primary bg-opacity-25' : ''">
            <div class="w-10">{{ file.index }}</div>
            <div class="flex-grow">
              {{ file.metadata.filename }}
            </div>
            <div class="w-16 font-mono text-gray-200">
              {{ $bytesPretty(file.metadata.size) }}
            </div>
            <div class="w-24">
              <div class="flex justify-center">
                <span v-if="audiofilesFinished[file.ino]" class="material-icons text-xl text-success leading-none">check_circle</span>
                <div v-else-if="audiofilesEncoding[file.ino]">
                  <widgets-loading-spinner />
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ store, params, app, redirect, route }) {
    if (!store.state.user.user) {
      return redirect(`/login?redirect=${route.path}`)
    }
    if (!store.getters['user/getIsAdminOrUp']) {
      return redirect('/?error=unauthorized')
    }
    const libraryItem = await app.$axios.$get(`/api/items/${params.id}?expanded=1`).catch((error) => {
      console.error('Failed', error)
      return false
    })
    if (!libraryItem) {
      console.error('Not found...', params.id)
      return redirect('/?error=not found')
    }
    if (libraryItem.mediaType !== 'book') {
      console.error('Invalid media type')
      return redirect('/?error=invalid media type')
    }
    if (!libraryItem.media.audioFiles.length) {
      cnosole.error('No audio files')
      return redirect('/?error=no audio files')
    }

    return {
      libraryItem
    }
  },
  data() {
    return {
      processing: false,
      audiofilesEncoding: {},
      audiofilesFinished: {},
      toneObject: null,
      selectedTool: 'embed',
      isCancelingEncode: false,
      showEncodeOptions: false,
      shouldBackupAudioFiles: true,
      encodingOptions: {
        bitrate: '128k',
        channels: '2',
        codec: 'aac'
      }
    }
  },
  watch: {
    task: {
      handler(newVal) {
        if (newVal) {
          this.taskUpdated(newVal)
        }
      }
    }
  },
  computed: {
    isEmbedTool() {
      return this.selectedTool === 'embed'
    },
    isM4BTool() {
      return this.selectedTool === 'm4b'
    },
    libraryItemId() {
      return this.libraryItem.id
    },
    libraryItemRelPath() {
      return this.libraryItem.relPath
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    audioFiles() {
      return (this.media.audioFiles || []).filter((af) => !af.exclude)
    },
    isSingleM4b() {
      return this.audioFiles.length === 1 && this.audioFiles[0].metadata.ext.toLowerCase() === '.m4b'
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    metadataChapters() {
      return this.media.chapters || []
    },
    availableTools() {
      if (this.isSingleM4b) {
        return [{ value: 'embed', text: 'Embed Metadata' }]
      } else {
        return [
          { value: 'embed', text: 'Embed Metadata' },
          { value: 'm4b', text: 'M4B Encoder' }
        ]
      }
    },
    taskFailed() {
      return this.isTaskFinished && this.task.isFailed
    },
    taskError() {
      return this.taskFailed ? this.task.error || 'Unknown Error' : null
    },
    isTaskFinished() {
      return this.task && this.task.isFinished
    },
    tasks() {
      return this.$store.getters['tasks/getTasksByLibraryItemId'](this.libraryItemId)
    },
    embedTask() {
      return this.tasks.find((t) => t.action === 'embed-metadata')
    },
    encodeTask() {
      return this.tasks.find((t) => t.action === 'encode-m4b')
    },
    task() {
      if (this.isEmbedTool) return this.embedTask
      else if (this.isM4BTool) return this.encodeTask
      return null
    },
    taskRunning() {
      return this.task && !this.task.isFinished
    },
    queuedEmbedLIds() {
      return this.$store.state.tasks.queuedEmbedLIds || []
    },
    isMetadataEmbedQueued() {
      return this.queuedEmbedLIds.some((lid) => lid === this.libraryItemId)
    }
  },
  methods: {
    toggleBackupAudioFiles(val) {
      localStorage.setItem('embedMetadataShouldBackup', val ? 1 : 0)
    },
    cancelEncodeClick() {
      this.isCancelingEncode = true
      this.$axios
        .$delete(`/api/tools/item/${this.libraryItemId}/encode-m4b`)
        .then(() => {
          this.$toast.success('Encode canceled')
        })
        .catch((error) => {
          console.error('Failed to cancel encode', error)
          this.$toast.error('Failed to cancel encode')
        })
        .finally(() => {
          this.isCancelingEncode = false
        })
    },
    encodeM4bClick() {
      if (this.$refs.bitrateInput) this.$refs.bitrateInput.blur()
      if (this.$refs.channelsInput) this.$refs.channelsInput.blur()
      if (this.$refs.codecInput) this.$refs.codecInput.blur()

      let queryStr = ''
      if (this.showEncodeOptions) {
        const options = []
        if (this.encodingOptions.bitrate) options.push(`bitrate=${this.encodingOptions.bitrate}`)
        if (this.encodingOptions.channels) options.push(`channels=${this.encodingOptions.channels}`)
        if (this.encodingOptions.codec) options.push(`codec=${this.encodingOptions.codec}`)
        if (options.length) {
          queryStr = `?${options.join('&')}`
        }
      }
      this.processing = true
      this.$axios
        .$post(`/api/tools/item/${this.libraryItemId}/encode-m4b${queryStr}`)
        .then(() => {
          console.log('Ab m4b merge started')
        })
        .catch((error) => {
          var errorMsg = error.response ? error.response.data || 'Unknown Error' : 'Unknown Error'
          this.$toast.error(errorMsg)
          this.processing = false
        })
    },
    embedClick() {
      const payload = {
        message: `Are you sure you want to embed metadata in ${this.audioFiles.length} audio files?`,
        callback: (confirmed) => {
          if (confirmed) {
            this.updateAudioFileMetadata()
          }
        },
        type: 'yesNo'
      }
      this.$store.commit('globals/setConfirmPrompt', payload)
    },
    updateAudioFileMetadata() {
      this.processing = true
      this.$axios
        .$post(`/api/tools/item/${this.libraryItemId}/embed-metadata?backup=${this.shouldBackupAudioFiles ? 1 : 0}`)
        .then(() => {
          console.log('Audio metadata encode started')
        })
        .catch((error) => {
          console.error('Audio metadata encode failed', error)
          this.processing = false
        })
    },
    audiofileMetadataStarted(data) {
      if (data.libraryItemId !== this.libraryItemId) return
      this.$set(this.audiofilesEncoding, data.ino, true)
    },
    audiofileMetadataFinished(data) {
      if (data.libraryItemId !== this.libraryItemId) return
      this.$set(this.audiofilesEncoding, data.ino, false)
      this.$set(this.audiofilesFinished, data.ino, true)
    },
    selectedToolUpdated() {
      let newurl = window.location.protocol + '//' + window.location.host + window.location.pathname + `?tool=${this.selectedTool}`
      window.history.replaceState({ path: newurl }, '', newurl)
    },
    init() {
      this.fetchToneObject()
      if (this.$route.query.tool === 'm4b') {
        if (this.availableTools.some((t) => t.value === 'm4b')) {
          this.selectedTool = 'm4b'
        } else {
          this.selectedToolUpdated()
        }
      }

      if (this.task) this.taskUpdated(this.task)

      const shouldBackupAudioFiles = localStorage.getItem('embedMetadataShouldBackup')
      this.shouldBackupAudioFiles = shouldBackupAudioFiles != 0
    },
    fetchToneObject() {
      this.$axios
        .$get(`/api/items/${this.libraryItemId}/tone-object`)
        .then((toneObject) => {
          delete toneObject.CoverFile
          this.toneObject = toneObject
        })
        .catch((error) => {
          console.error('Failed to fetch tone object', error)
        })
    },
    taskUpdated(task) {
      this.processing = !task.isFinished
    }
  },
  mounted() {
    this.init()
    this.$root.socket.on('audiofile_metadata_started', this.audiofileMetadataStarted)
    this.$root.socket.on('audiofile_metadata_finished', this.audiofileMetadataFinished)
  },
  beforeDestroy() {
    this.$root.socket.off('audiofile_metadata_started', this.audiofileMetadataStarted)
    this.$root.socket.off('audiofile_metadata_finished', this.audiofileMetadataFinished)
  }
}
</script>