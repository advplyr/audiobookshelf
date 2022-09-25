<template>
  <div id="page-wrapper" class="bg-bg page p-8 overflow-auto relative" :class="streamLibraryItem ? 'streaming' : ''">
    <div class="flex justify-center mb-4">
      <div class="w-full max-w-2xl">
        <p class="text-xl mb-2">Metadata to embed</p>
        <p class="mb-4 text-base text-gray-300">audiobookshelf uses <a href="https://github.com/sandreas/tone" target="_blank" class="hover:underline text-blue-400 hover:text-blue-300">tone</a> to write metadata.</p>
      </div>
      <div class="w-full max-w-2xl"></div>
    </div>

    <div class="flex justify-center flex-wrap">
      <div class="w-full max-w-2xl border border-white border-opacity-10 bg-bg mx-2">
        <div class="flex py-2 px-4">
          <div class="w-1/3 text-xs font-semibold uppercase text-gray-200">Meta Tag</div>
          <div class="w-2/3 text-xs font-semibold uppercase text-gray-200">Value</div>
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
        <div class="flex py-2 px-4">
          <div class="flex-grow text-xs font-semibold uppercase text-gray-200">Chapter Title</div>
          <div class="w-24 text-xs font-semibold uppercase text-gray-200">Start</div>
          <div class="w-24 text-xs font-semibold uppercase text-gray-200">End</div>
        </div>
        <div class="w-full max-h-72 overflow-auto">
          <template v-for="(chapter, index) in metadataChapters">
            <div :key="index" class="flex py-1 px-4 text-sm" :class="index % 2 === 0 ? 'bg-primary bg-opacity-25' : ''">
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
      <div class="w-full flex justify-between items-center mb-2">
        <p class="text-warning text-lg font-semibold">Warning: Modifies your audio files</p>
        <ui-btn v-if="!embedFinished" color="primary" :loading="updatingMetadata" @click.stop="embedClick">Embed Metadata</ui-btn>
        <p v-else class="text-success text-lg font-semibold">Embed Finished!</p>
      </div>
      <div class="flex mb-4">
        <p class="text-gray-200">
          A backup of your audio files will be stored in <span class="rounded-md bg-neutral-600 text-sm text-white py-0.5 px-1 font-mono">/metadata/cache/items/{{ libraryItemId }}/</span> so you can restore the originals if necessary.
        </p>
      </div>
      <div class="w-full mx-auto border border-white border-opacity-10 bg-bg">
        <div class="flex py-2 px-4">
          <div class="w-10 text-xs font-semibold text-gray-200">#</div>
          <div class="flex-grow text-xs font-semibold uppercase text-gray-200">Filename</div>
          <div class="w-16 text-xs font-semibold uppercase text-gray-200">Size</div>
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
    var libraryItem = await app.$axios.$get(`/api/items/${params.id}?expanded=1`).catch((error) => {
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
      audiofilesEncoding: {},
      audiofilesFinished: {},
      updatingMetadata: false,
      embedFinished: false,
      toneObject: null
    }
  },
  computed: {
    libraryItemId() {
      return this.libraryItem.id
    },
    media() {
      return this.libraryItem.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    audioFiles() {
      return this.media.audioFiles || []
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    },
    metadataChapters() {
      var chapters = this.media.chapters || []
      return chapters.concat(chapters)
    }
  },
  methods: {
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
      this.updatingMetadata = true
      this.$axios
        .$get(`/api/items/${this.libraryItemId}/audio-metadata?tone=1`)
        .then(() => {
          console.log('Audio metadata encode started')
        })
        .catch((error) => {
          console.error('Audio metadata encode failed', error)
          this.updatingMetadata = false
        })
    },
    audioMetadataStarted(data) {
      console.log('audio metadata started', data)
      if (data.libraryItemId !== this.libraryItemId) return
      this.audiofilesFinished = {}
      this.updatingMetadata = true
    },
    audioMetadataFinished(data) {
      console.log('audio metadata finished', data)
      if (data.libraryItemId !== this.libraryItemId) return
      this.updatingMetadata = false
      this.embedFinished = true
      this.audiofilesEncoding = {}
      this.$toast.success('Audio file metadata updated')
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
    }
  },
  mounted() {
    this.fetchToneObject()
    this.$root.socket.on('audio_metadata_started', this.audioMetadataStarted)
    this.$root.socket.on('audio_metadata_finished', this.audioMetadataFinished)
    this.$root.socket.on('audiofile_metadata_started', this.audiofileMetadataStarted)
    this.$root.socket.on('audiofile_metadata_finished', this.audiofileMetadataFinished)
  },
  beforeDestroy() {
    this.$root.socket.off('audio_metadata_started', this.audioMetadataStarted)
    this.$root.socket.off('audio_metadata_finished', this.audioMetadataFinished)
    this.$root.socket.off('audiofile_metadata_started', this.audiofileMetadataStarted)
    this.$root.socket.off('audiofile_metadata_finished', this.audiofileMetadataFinished)
  }
}
</script>